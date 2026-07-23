package services

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/pms/backend/internal/models"
)

type RoutingService struct {
	db       *sql.DB
	auditSvc *AuditService
	notifSvc *NotificationService
	taskSvc  *TaskService
}

func NewRoutingService(db *sql.DB, audit *AuditService, notif *NotificationService) *RoutingService {
	return &RoutingService{db: db, auditSvc: audit, notifSvc: notif}
}

func (s *RoutingService) SetTaskService(ts *TaskService) {
	s.taskSvc = ts
}

// ── Request types ─────────────────────────────────────────────────────────────

type RoutingStepInput struct {
	StepOrder        int                     `json:"step_order"`
	Name             string                  `json:"name"`
	DependencyPolicy models.DependencyPolicy `json:"dependency_policy"`
	DepartmentIDs    []string                `json:"department_ids"`
}

type CreateRoutingRequest struct {
	Name        string             `json:"name"`
	Description string             `json:"description"`
	Steps       []RoutingStepInput `json:"steps"`
}

// ── CreateRouting ─────────────────────────────────────────────────────────────

func (s *RoutingService) CreateRouting(orgID, projectID, createdBy uuid.UUID, req CreateRoutingRequest) (*models.Routing, error) {
	if len(req.Steps) == 0 {
		return nil, errors.New("routing must have at least one step")
	}

	// Enforce one-routing-per-project: if an active routing exists, reject creation
	var existingCount int
	s.db.QueryRow(`SELECT COUNT(*) FROM routings WHERE project_id = $1 AND status IN ('active','draft')`, projectID).Scan(&existingCount)
	if existingCount > 0 {
		return nil, errors.New("a routing already exists for this project — use UpdateRouting to modify it")
	}

	// Version is always 1 for first creation
	version := 1

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// ── Insert routing header ────────────────────────────────────────────────
	// name and description are TEXT NULL in the schema.
	// We must scan them into sql.NullString so a NULL return doesn't panic.
	var (
		rID, rProjectID, rCreatedBy             uuid.UUID
		rVersion                                int
		rName, rDesc, rStatus, rRoutingType     sql.NullString
		rCreatedAt, rUpdatedAt                  interface{}
	)

	err = tx.QueryRow(`
		INSERT INTO routings (project_id, version, name, description, status, routing_type, created_by)
		VALUES ($1, $2, $3, $4, 'draft', 'standard', $5)
		RETURNING id, project_id, version, name, description, status, routing_type, created_by, created_at, updated_at
	`, projectID, version, nullStr(req.Name), nullStr(req.Description), createdBy).Scan(
		&rID, &rProjectID, &rVersion,
		&rName, &rDesc, &rStatus, &rRoutingType, &rCreatedBy,
		&rCreatedAt, &rUpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create routing: %w", err)
	}

	routing := &models.Routing{
		ID:          rID,
		ProjectID:   rProjectID,
		Version:     rVersion,
		Status:      models.RoutingStatus(rStatus.String),
		RoutingType: rRoutingType.String,
		CreatedBy:   rCreatedBy,
	}
	if rName.Valid {
		routing.Name = rName.String
	}
	if rDesc.Valid {
		routing.Description = rDesc.String
	}

	// ── Insert steps ─────────────────────────────────────────────────────────
	for _, stepInput := range req.Steps {
		if stepInput.DependencyPolicy == "" {
			stepInput.DependencyPolicy = models.RequireAll
		}

		var stepID uuid.UUID
		err = tx.QueryRow(`
			INSERT INTO routing_steps (routing_id, step_order, name, dependency_policy)
			VALUES ($1, $2, $3, $4)
			RETURNING id
		`, routing.ID, stepInput.StepOrder, nullStr(stepInput.Name), stepInput.DependencyPolicy).Scan(&stepID)
		if err != nil {
			return nil, fmt.Errorf("failed to create routing step %d: %w", stepInput.StepOrder, err)
		}

		step := models.RoutingStep{
			ID:               stepID,
			RoutingID:        routing.ID,
			StepOrder:        stepInput.StepOrder,
			Name:             stepInput.Name,
			DependencyPolicy: stepInput.DependencyPolicy,
			IsActive:         true,
		}

		for _, deptIDStr := range stepInput.DepartmentIDs {
			deptID, err := uuid.Parse(deptIDStr)
			if err != nil {
				return nil, fmt.Errorf("invalid department_id '%s': %w", deptIDStr, err)
			}
			tx.Exec(`INSERT INTO routing_step_departments (routing_step_id, department_id) VALUES ($1, $2)`, stepID, deptID)

			// Load dept name for the response object.
			var dept models.Department
			tx.QueryRow(`SELECT id, name, layer FROM departments WHERE id = $1`, deptID).Scan(&dept.ID, &dept.Name, &dept.Layer)
			step.Departments = append(step.Departments, dept)
		}

		routing.Steps = append(routing.Steps, step)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	s.auditSvc.Log(AuditEntry{
		OrgID: orgID, ProjectID: &projectID, ActorID: &createdBy,
		Action:     models.AuditCreated,
		EntityType: "routing",
		EntityID:   &routing.ID,
		EntityName: fmt.Sprintf("Routing v%d", routing.Version),
	})

	return routing, nil
}

// ── UpdateRouting ─────────────────────────────────────────────────────────────
// Edits the steps of the existing (draft or active) routing for a project.
// Records every change in routing_edit_timeline.

type UpdateRoutingRequest struct {
	Name           string             `json:"name"`
	Description    string             `json:"description"`
	EditReason     string             `json:"edit_reason"`
	Steps          []RoutingStepInput `json:"steps"`
}

func (s *RoutingService) UpdateRouting(orgID, routingID, editorID uuid.UUID, req UpdateRoutingRequest, editorEmail, editorName string) (*models.Routing, error) {
	if req.EditReason == "" {
		return nil, errors.New("edit_reason is required when modifying routing")
	}
	if len(req.Steps) == 0 {
		return nil, errors.New("routing must have at least one step")
	}

	var projectID uuid.UUID
	var currentStatus models.RoutingStatus
	err := s.db.QueryRow(`SELECT project_id, status FROM routings WHERE id = $1`, routingID).Scan(&projectID, &currentStatus)
	if err != nil {
		return nil, errors.New("routing not found")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Update routing header
	tx.Exec(`
		UPDATE routings SET name = $1, description = $2, updated_at = NOW() WHERE id = $3
	`, nullStr(req.Name), nullStr(req.Description), routingID)

	// Delete existing steps and regenerate (simpler than diffing)
	tx.Exec(`DELETE FROM routing_steps WHERE routing_id = $1`, routingID)

	var routing models.Routing
	routing.ID = routingID
	routing.ProjectID = projectID

	for _, stepInput := range req.Steps {
		if stepInput.DependencyPolicy == "" {
			stepInput.DependencyPolicy = models.RequireAll
		}
		var stepID uuid.UUID
		err := tx.QueryRow(`
			INSERT INTO routing_steps (routing_id, step_order, name, dependency_policy)
			VALUES ($1, $2, $3, $4)
			RETURNING id
		`, routingID, stepInput.StepOrder, nullStr(stepInput.Name), stepInput.DependencyPolicy).Scan(&stepID)
		if err != nil {
			return nil, fmt.Errorf("failed to create routing step %d: %w", stepInput.StepOrder, err)
		}

		step := models.RoutingStep{
			ID: stepID, RoutingID: routingID,
			StepOrder: stepInput.StepOrder, Name: stepInput.Name,
			DependencyPolicy: stepInput.DependencyPolicy, IsActive: true,
		}
		for _, deptIDStr := range stepInput.DepartmentIDs {
			deptID, err := uuid.Parse(deptIDStr)
			if err != nil {
				return nil, fmt.Errorf("invalid department_id '%s': %w", deptIDStr, err)
			}
			tx.Exec(`INSERT INTO routing_step_departments (routing_step_id, department_id) VALUES ($1, $2)`, stepID, deptID)
			var dept models.Department
			tx.QueryRow(`SELECT id, name, layer FROM departments WHERE id = $1`, deptID).Scan(&dept.ID, &dept.Name, &dept.Layer)
			step.Departments = append(step.Departments, dept)
		}
		routing.Steps = append(routing.Steps, step)
	}

	// Record in edit timeline
	tx.Exec(`
		INSERT INTO routing_edit_timeline (routing_id, edited_by, editor_email, editor_name, edit_reason)
		VALUES ($1, $2, $3, $4, $5)
	`, routingID, editorID, editorEmail, editorName, req.EditReason)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	s.auditSvc.Log(AuditEntry{
		OrgID: orgID, ProjectID: &projectID, ActorID: &editorID,
		Action: models.AuditUpdated, EntityType: "routing", EntityID: &routingID,
		EntityName: fmt.Sprintf("Routing updated by %s", editorEmail),
		Metadata:   map[string]string{"edit_reason": req.EditReason},
	})

	return s.GetRouting(routingID)
}

// ── GetEditTimeline ──────────────────────────────────────────────────────────

func (s *RoutingService) GetEditTimeline(routingID uuid.UUID) ([]models.RoutingEditTimeline, error) {
	rows, err := s.db.Query(`
		SELECT id, routing_id, edited_by, editor_email, editor_name, edit_reason,
		       COALESCE(changes_summary, ''), created_at
		FROM routing_edit_timeline
		WHERE routing_id = $1
		ORDER BY created_at DESC
	`, routingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var timeline []models.RoutingEditTimeline
	for rows.Next() {
		var e models.RoutingEditTimeline
		rows.Scan(&e.ID, &e.RoutingID, &e.EditedBy, &e.EditorEmail, &e.EditorName,
			&e.EditReason, &e.ChangesSummary, &e.CreatedAt)
		timeline = append(timeline, e)
	}
	return timeline, nil
}

// ── PublishRouting ─────────────────────────────────────────────────────────────

func (s *RoutingService) PublishRouting(orgID, routingID, publishedBy uuid.UUID) (*models.Routing, error) {
	var projectID uuid.UUID
	var version int
	err := s.db.QueryRow(`SELECT project_id, version FROM routings WHERE id = $1`, routingID).Scan(&projectID, &version)
	if err != nil {
		return nil, errors.New("routing not found")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Supersede any currently active routing.
	tx.Exec(`
		UPDATE routings SET status = 'superseded', updated_at = NOW()
		WHERE project_id = $1 AND status = 'active' AND id != $2
	`, projectID, routingID)

	// Activate the requested routing.
	// Scan every nullable column with the appropriate nullable type.
	var (
		rID, rProjectID, rCreatedBy         uuid.UUID
		rVersion                            int
		rName, rDesc, rStatus, rRoutingType sql.NullString
		rPubAt                              sql.NullTime
		rCreatedAt, rUpdatedAt              interface{}
	)

	err = tx.QueryRow(`
		UPDATE routings
		SET status = 'active', published_at = NOW(), updated_at = NOW()
		WHERE id = $1
		RETURNING id, project_id, version, name, description, status, routing_type, created_by, published_at, created_at, updated_at
	`, routingID).Scan(
		&rID, &rProjectID, &rVersion,
		&rName, &rDesc, &rStatus, &rRoutingType, &rCreatedBy,
		&rPubAt, &rCreatedAt, &rUpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to activate routing: %w", err)
	}

	routing := &models.Routing{
		ID:          rID,
		ProjectID:   rProjectID,
		Version:     rVersion,
		Status:      models.RoutingStatus(rStatus.String),
		RoutingType: rRoutingType.String,
		CreatedBy:   rCreatedBy,
	}
	if rName.Valid {
		routing.Name = rName.String
	}
	if rDesc.Valid {
		routing.Description = rDesc.String
	}
	if rPubAt.Valid {
		routing.PublishedAt = &rPubAt.Time
	}

	// Set project status to on_hold (routing is set but not started yet)
	tx.Exec(`
		UPDATE projects
		SET status = 'on_hold', updated_at = NOW()
		WHERE id = $1 AND status IN ('created', 'routing')
	`, projectID)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Generate tasks in the background.
	go s.generateTasksFromRouting(orgID, projectID, routingID, publishedBy)

	s.auditSvc.Log(AuditEntry{
		OrgID: orgID, ProjectID: &projectID, ActorID: &publishedBy,
		Action:     models.AuditRoutingPublished,
		EntityType: "routing",
		EntityID:   &routingID,
		EntityName: fmt.Sprintf("Routing v%d published", version),
	})

	return routing, nil
}

// ── Task generation ───────────────────────────────────────────────────────────

func (s *RoutingService) generateTasksFromRouting(orgID, projectID, routingID, _ uuid.UUID) {
	steps, err := s.GetRoutingSteps(routingID)
	if err != nil {
		return
	}

	if len(steps) == 0 {
		return
	}

	var pName string
	s.db.QueryRow(`SELECT project_name FROM projects WHERE id = $1`, projectID).Scan(&pName)

	// Only create tasks for the first step (step_order = 1)
	// Subsequent steps will be activated when previous steps complete
	firstStep := steps[0]
	for _, dept := range firstStep.Departments {
		var taskID uuid.UUID
		err := s.db.QueryRow(`
			INSERT INTO department_tasks (project_id, routing_id, routing_step_id, department_id, status, routed_to_dept_at)
			VALUES ($1, $2, $3, $4, 'on_hold', NOW())
			ON CONFLICT DO NOTHING
			RETURNING id
		`, projectID, routingID, firstStep.ID, dept.ID).Scan(&taskID)
		if err != nil {
			continue
		}
		go s.notifSvc.NotifyDepartment(orgID, dept.ID, models.NotifTaskAssigned,
			"New Task Assigned",
			fmt.Sprintf("You have a new task for project: %s", pName),
			&projectID, "task", &taskID,
		)
	}

	// Create upcoming tasks for all subsequent steps (step_order > 1)
	for i := 1; i < len(steps); i++ {
		step := steps[i]
		for _, dept := range step.Departments {
			s.db.Exec(`
				INSERT INTO upcoming_tasks (project_id, routing_id, routing_step_id, department_id, step_order)
				VALUES ($1, $2, $3, $4, $5)
				ON CONFLICT DO NOTHING
			`, projectID, routingID, step.ID, dept.ID, step.StepOrder)
		}
	}
}

// ── GetRouting ────────────────────────────────────────────────────────────────

func (s *RoutingService) GetRouting(id uuid.UUID) (*models.Routing, error) {
	var r models.Routing
	var rName, rDesc, rParentID, rCreatedByName sql.NullString
	var rPubAt sql.NullTime

	err := s.db.QueryRow(`
		SELECT r.id, r.project_id, r.version,
		       r.name, r.description, r.status,
		       r.parent_routing_id, r.routing_type, r.created_by, r.published_at,
		       r.created_at, r.updated_at,
		       COALESCE(CONCAT(e.first_name, ' ', e.last_name), '') AS created_by_name
		FROM routings r
		LEFT JOIN employees e ON e.id = r.created_by
		WHERE r.id = $1
	`, id).Scan(
		&r.ID, &r.ProjectID, &r.Version,
		&rName, &rDesc, &r.Status,
		&rParentID, &r.RoutingType, &r.CreatedBy, &rPubAt,
		&r.CreatedAt, &r.UpdatedAt, &rCreatedByName,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("routing not found")
	}
	if err != nil {
		return nil, err
	}

	if rName.Valid {
		r.Name = rName.String
	}
	if rDesc.Valid {
		r.Description = rDesc.String
	}
	if rPubAt.Valid {
		r.PublishedAt = &rPubAt.Time
	}
	if rParentID.Valid {
		pid, _ := uuid.Parse(rParentID.String)
		r.ParentRoutingID = &pid
	}
	if rCreatedByName.Valid {
		r.CreatedByName = rCreatedByName.String
	}

	r.Steps, _ = s.GetRoutingSteps(r.ID)
	return &r, nil
}

// ── GetRoutingSteps ───────────────────────────────────────────────────────────

func (s *RoutingService) GetRoutingSteps(routingID uuid.UUID) ([]models.RoutingStep, error) {
	rows, err := s.db.Query(`
		SELECT id, routing_id, step_order,
		       COALESCE(name, '') AS name,
		       dependency_policy, is_active, created_at
		FROM routing_steps
		WHERE routing_id = $1
		ORDER BY step_order
	`, routingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var steps []models.RoutingStep
	for rows.Next() {
		var step models.RoutingStep
		rows.Scan(
			&step.ID, &step.RoutingID, &step.StepOrder,
			&step.Name, &step.DependencyPolicy, &step.IsActive, &step.CreatedAt,
		)

		deptRows, _ := s.db.Query(`
			SELECT d.id, d.name, d.layer, d.is_active
			FROM departments d
			JOIN routing_step_departments rsd ON rsd.department_id = d.id
			WHERE rsd.routing_step_id = $1
		`, step.ID)
		if deptRows != nil {
			for deptRows.Next() {
				var d models.Department
				deptRows.Scan(&d.ID, &d.Name, &d.Layer, &d.IsActive)
				step.Departments = append(step.Departments, d)
			}
			deptRows.Close()
		}

		steps = append(steps, step)
	}
	return steps, nil
}

// ── ListProjectRoutings ───────────────────────────────────────────────────────

func (s *RoutingService) ListProjectRoutings(projectID uuid.UUID) ([]models.Routing, error) {
	rows, err := s.db.Query(`
		SELECT r.id, r.project_id, r.version,
		       COALESCE(r.name, '') AS name,
		       r.status, r.routing_type, r.created_by,
		       r.published_at, r.created_at, r.updated_at,
		       COALESCE(CONCAT(e.first_name, ' ', e.last_name), '') AS created_by_name
		FROM routings r
		LEFT JOIN employees e ON e.id = r.created_by
		WHERE r.project_id = $1
		ORDER BY r.version DESC
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var routings []models.Routing
	for rows.Next() {
		var r models.Routing
		var rPubAt sql.NullTime
		var rCreatedByName sql.NullString
		rows.Scan(
			&r.ID, &r.ProjectID, &r.Version,
			&r.Name, &r.Status, &r.RoutingType, &r.CreatedBy,
			&rPubAt, &r.CreatedAt, &r.UpdatedAt, &rCreatedByName,
		)
		if rPubAt.Valid {
			r.PublishedAt = &rPubAt.Time
		}
		if rCreatedByName.Valid {
			r.CreatedByName = rCreatedByName.String
		}
		r.Steps, _ = s.GetRoutingSteps(r.ID)
		routings = append(routings, r)
	}
	return routings, nil
}

// ── EvaluateRoutingGate ───────────────────────────────────────────────────────
func (s *RoutingService) EvaluateRoutingGate(routingID, completedStepID uuid.UUID) (bool, *models.RoutingStep, error) {
	var stepOrder int
	var depPolicy models.DependencyPolicy
	err := s.db.QueryRow(
		`SELECT step_order, dependency_policy FROM routing_steps WHERE id = $1`, completedStepID,
	).Scan(&stepOrder, &depPolicy)
	if err != nil {
		return false, nil, err
	}

	// Check if all tasks in this step are completed
	// Also need to check if all subtasks are completed for each task
	rows, err := s.db.Query(`
		SELECT dt.id, dt.status FROM department_tasks dt
		WHERE dt.routing_step_id = $1 AND dt.routing_id = $2
	`, completedStepID, routingID)
	if err != nil {
		return false, nil, err
	}
	defer rows.Close()

	var taskIDs []uuid.UUID
	var statuses []string
	for rows.Next() {
		var taskID uuid.UUID
		var st string
		rows.Scan(&taskID, &st)
		taskIDs = append(taskIDs, taskID)
		statuses = append(statuses, st)
	}

	canProceed := false
	switch depPolicy {
	case models.RequireAll:
		canProceed = true
		for i, st := range statuses {
			// Task must be completed
			if st != "completed" {
				canProceed = false
				break
			}
			// All required subtasks must be completed
			var totalRequired, completedRequired int
			s.db.QueryRow(`SELECT COUNT(*) FROM subtasks WHERE task_id = $1 AND is_required = TRUE`, taskIDs[i]).Scan(&totalRequired)
			if totalRequired > 0 {
				s.db.QueryRow(`SELECT COUNT(*) FROM subtasks WHERE task_id = $1 AND is_required = TRUE AND status = 'completed'`, taskIDs[i]).Scan(&completedRequired)
				if completedRequired < totalRequired {
					canProceed = false
					break
				}
			}
		}
	case models.RequireAny:
		for i, st := range statuses {
			if st == "completed" {
				// Check if all required subtasks are completed for this task
				var totalRequired, completedRequired int
				s.db.QueryRow(`SELECT COUNT(*) FROM subtasks WHERE task_id = $1 AND is_required = TRUE`, taskIDs[i]).Scan(&totalRequired)
				if totalRequired > 0 {
					s.db.QueryRow(`SELECT COUNT(*) FROM subtasks WHERE task_id = $1 AND is_required = TRUE AND status = 'completed'`, taskIDs[i]).Scan(&completedRequired)
					if completedRequired >= totalRequired {
						canProceed = true
						break
					}
				} else {
					// No required subtasks, task completion is enough
					canProceed = true
					break
				}
			}
		}
	}

	if !canProceed {
		return false, nil, nil
	}

	// Find next step.
	var nextStep models.RoutingStep
	err = s.db.QueryRow(`
		SELECT id, routing_id, step_order,
		       COALESCE(name, '') AS name,
		       dependency_policy, is_active, created_at
		FROM routing_steps
		WHERE routing_id = $1 AND step_order = $2 AND is_active = TRUE
	`, routingID, stepOrder+1).Scan(
		&nextStep.ID, &nextStep.RoutingID, &nextStep.StepOrder,
		&nextStep.Name, &nextStep.DependencyPolicy, &nextStep.IsActive, &nextStep.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return true, nil, nil // all steps complete
	}
	if err != nil {
		return false, nil, err
	}

	deptRows, _ := s.db.Query(`
		SELECT d.id, d.name FROM departments d
		JOIN routing_step_departments rsd ON rsd.department_id = d.id
		WHERE rsd.routing_step_id = $1
	`, nextStep.ID)
	if deptRows != nil {
		for deptRows.Next() {
			var d models.Department
			deptRows.Scan(&d.ID, &d.Name)
			nextStep.Departments = append(nextStep.Departments, d)
		}
		deptRows.Close()
	}

	return true, &nextStep, nil
}

// ── ActivateNextStep ──────────────────────────────────────────────────────────
func (s *RoutingService) ActivateNextStep(orgID, projectID, routingID uuid.UUID, nextStep *models.RoutingStep, _ uuid.UUID) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var pName string
	s.db.QueryRow(`SELECT project_name FROM projects WHERE id = $1`, projectID).Scan(&pName)

	// Check if this step has already been activated (to prevent re-routing)
	var alreadyActivated bool
	err = tx.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM department_tasks
			WHERE project_id = $1
			AND routing_step_id = $2
			AND routing_id = $3
		)
	`, projectID, nextStep.ID, routingID).Scan(&alreadyActivated)

	if err != nil {
		return err
	}

	if alreadyActivated {
		// Step already activated - skip to prevent re-routing
		tx.Rollback()
		return nil
	}

	for _, dept := range nextStep.Departments {
		var taskID uuid.UUID
		tx.QueryRow(`
			INSERT INTO department_tasks (project_id, routing_id, routing_step_id, department_id, status, routed_to_dept_at)
			VALUES ($1, $2, $3, $4, 'on_hold', NOW())
			RETURNING id
		`, projectID, routingID, nextStep.ID, dept.ID).Scan(&taskID)

		// Remove from upcoming_tasks since it's now an active task
		tx.Exec(`
			DELETE FROM upcoming_tasks
			WHERE project_id = $1 AND routing_step_id = $2 AND department_id = $3
		`, projectID, nextStep.ID, dept.ID)

		go s.notifSvc.NotifyDepartment(orgID, dept.ID, models.NotifTaskAssigned,
			"New Task Activated",
			fmt.Sprintf("Your department has a new task for: %s", pName),
			&projectID, "task", &taskID,
		)
	}
	return tx.Commit()
}

// ── GetRoutingTemplates ───────────────────────────────────────────────────────

func (s *RoutingService) GetRoutingTemplates(orgID uuid.UUID) ([]models.RoutingTemplate, error) {
	rows, err := s.db.Query(`
		SELECT id, organization_id, name, description, template_data,
		       created_by, is_active, created_at, updated_at
		FROM routing_templates
		WHERE organization_id = $1 AND is_active = TRUE
		ORDER BY name
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []models.RoutingTemplate
	for rows.Next() {
		var t models.RoutingTemplate
		var desc sql.NullString
		var data []byte
		rows.Scan(
			&t.ID, &t.OrganizationID, &t.Name, &desc, &data,
			&t.CreatedBy, &t.IsActive, &t.CreatedAt, &t.UpdatedAt,
		)
		if desc.Valid {
			t.Description = desc.String
		}
		if len(data) > 0 {
			json.Unmarshal(data, &t.TemplateData)
		}
		templates = append(templates, t)
	}
	return templates, nil
}

// ── GetUpcomingTasksForDepartment ───────────────────────────────────────────────

func (s *RoutingService) GetUpcomingTasksForDepartment(departmentID uuid.UUID) ([]models.UpcomingTask, error) {
	// First, get the current active step for this routing to determine if this department is next
	rows, err := s.db.Query(`
		WITH current_step AS (
			SELECT dt.routing_step_id, dt.routing_id
			FROM department_tasks dt
			WHERE dt.department_id = $1
			AND dt.status IN ('pending', 'in_progress', 'on_hold')
			ORDER BY dt.created_at DESC
			LIMIT 1
		)
		SELECT ut.id, ut.project_id, ut.routing_id, ut.routing_step_id,
		       ut.department_id, ut.step_order, ut.created_at,
		       p.project_name, rs.name AS step_name, d.name AS dept_name,
		       dt.expected_completion_date AS assignment_date,
		       cs.routing_step_id AS current_routing_step_id
		FROM upcoming_tasks ut
		JOIN projects p ON p.id = ut.project_id
		JOIN routing_steps rs ON rs.id = ut.routing_step_id
		JOIN departments d ON d.id = ut.department_id
		LEFT JOIN department_tasks dt ON dt.routing_id = ut.routing_id 
			AND dt.routing_step_id = (SELECT rs2.id FROM routing_steps rs2 WHERE rs2.routing_id = ut.routing_id AND rs2.step_order = ut.step_order - 1 LIMIT 1)
		LEFT JOIN current_step cs ON cs.routing_id = ut.routing_id
		WHERE ut.department_id = $1
		ORDER BY ut.step_order ASC, ut.created_at ASC
	`, departmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var upcomingTasks []models.UpcomingTask
	for rows.Next() {
		var ut models.UpcomingTask
		var stepName, deptName sql.NullString
		var assignmentDate sql.NullTime
		var currentRoutingStepID sql.NullString
		rows.Scan(
			&ut.ID, &ut.ProjectID, &ut.RoutingID, &ut.RoutingStepID,
			&ut.DepartmentID, &ut.StepOrder, &ut.CreatedAt,
			&ut.ProjectName, &stepName, &deptName, &assignmentDate, &currentRoutingStepID,
		)
		if stepName.Valid {
			ut.StepName = stepName.String
		}
		if deptName.Valid {
			ut.DeptName = deptName.String
		}
		
		// Only show assignment date if this department is the next in sequence
		// (i.e., the current step is the previous step in the routing)
		if currentRoutingStepID.Valid {
			// Check if the current step is the previous step
			var isNextStep bool
			s.db.QueryRow(`
				SELECT EXISTS (
					SELECT 1 FROM routing_steps 
					WHERE routing_id = $1 AND step_order = $2 - 1 AND id = $3
				)
			`, ut.RoutingID, ut.StepOrder, currentRoutingStepID).Scan(&isNextStep)
			
			if isNextStep && assignmentDate.Valid {
				ut.AssignmentDate = &assignmentDate.Time
			}
		}
		
		upcomingTasks = append(upcomingTasks, ut)
	}
	return upcomingTasks, nil
}
