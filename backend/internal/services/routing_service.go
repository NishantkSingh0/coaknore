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

	// Get the next version number for this project
	var nextVersion int
	s.db.QueryRow(`SELECT COALESCE(MAX(version), 0) + 1 FROM routings WHERE project_id = $1`, projectID).Scan(&nextVersion)

	// Version is the next available number
	version := nextVersion

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
		rIsLatest                               bool
		rCreatedAt, rUpdatedAt                  interface{}
	)

	err = tx.QueryRow(`
		INSERT INTO routings (project_id, version, name, description, status, routing_type, created_by, is_latest)
		VALUES ($1, $2, $3, $4, 'draft', 'standard', $5, TRUE)
		RETURNING id, project_id, version, name, description, status, routing_type, created_by, is_latest, created_at, updated_at
	`, projectID, version, nullStr(req.Name), nullStr(req.Description), createdBy).Scan(
		&rID, &rProjectID, &rVersion,
		&rName, &rDesc, &rStatus, &rRoutingType, &rCreatedBy,
		&rIsLatest,
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
		IsLatest:    rIsLatest,
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

// ── CreateNewRoutingVersion ───────────────────────────────────────────────────
// Creates a new routing version instead of editing the existing one.
// This is the new approach for routing modifications.

type CreateNewRoutingVersionRequest struct {
	Name           string             `json:"name"`
	Description    string             `json:"description"`
	ChangeReason   string             `json:"change_reason"` // Required: reason for creating new version
	Steps          []RoutingStepInput `json:"steps"`
}

func (s *RoutingService) CreateNewRoutingVersion(orgID, previousRoutingID, creatorID uuid.UUID, req CreateNewRoutingVersionRequest, creatorEmail, creatorName string) (*models.Routing, error) {
	if req.ChangeReason == "" {
		return nil, errors.New("change_reason is required when creating a new routing version")
	}
	if len(req.Steps) == 0 {
		return nil, errors.New("routing must have at least one step")
	}

	// Get previous routing details
	var projectID uuid.UUID
	var previousVersion int
	var previousStatus models.RoutingStatus
	err := s.db.QueryRow(`SELECT project_id, version, status FROM routings WHERE id = $1`, previousRoutingID).Scan(&projectID, &previousVersion, &previousStatus)
	if err != nil {
		return nil, errors.New("previous routing not found")
	}

	// Get the next version number for this project
	var nextVersion int
	s.db.QueryRow(`SELECT COALESCE(MAX(version), 0) + 1 FROM routings WHERE project_id = $1`, projectID).Scan(&nextVersion)

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Mark previous routing as not latest and supersede it
	_, err = tx.Exec(`
		UPDATE routings SET is_latest = FALSE, status = 'superseded', updated_at = NOW() 
		WHERE id = $1
	`, previousRoutingID)
	if err != nil {
		return nil, fmt.Errorf("failed to mark previous routing as superseded: %w", err)
	}

	// ── Insert new routing header ────────────────────────────────────────────────
	var (
		rID, rProjectID, rCreatedBy             uuid.UUID
		rVersion                                int
		rName, rDesc, rStatus, rRoutingType     sql.NullString
		rIsLatest                               bool
		rCreatedAt, rUpdatedAt                  interface{}
	)

	err = tx.QueryRow(`
		INSERT INTO routings (project_id, version, name, description, status, routing_type, created_by, parent_routing_id, is_latest, change_reason)
		VALUES ($1, $2, $3, $4, 'draft', 'standard', $5, $6, TRUE, $7)
		RETURNING id, project_id, version, name, description, status, routing_type, created_by, is_latest, created_at, updated_at
	`, projectID, nextVersion, nullStr(req.Name), nullStr(req.Description), creatorID, previousRoutingID, req.ChangeReason).Scan(
		&rID, &rProjectID, &rVersion,
		&rName, &rDesc, &rStatus, &rRoutingType, &rCreatedBy,
		&rIsLatest,
		&rCreatedAt, &rUpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create new routing version: %w", err)
	}

	routing := &models.Routing{
		ID:              rID,
		ProjectID:       rProjectID,
		Version:         rVersion,
		Status:          models.RoutingStatus(rStatus.String),
		RoutingType:     rRoutingType.String,
		CreatedBy:       rCreatedBy,
		ParentRoutingID: &previousRoutingID,
		IsLatest:        rIsLatest,
		ChangeReason:    req.ChangeReason,
	}
	if rName.Valid {
		routing.Name = rName.String
	}
	if rDesc.Valid {
		routing.Description = rDesc.String
	}

	// ── Create routing steps ───────────────────────────────────────────────────────
	for _, stepInput := range req.Steps {
		if stepInput.DependencyPolicy == "" {
			stepInput.DependencyPolicy = models.RequireAll
		}
		var stepID uuid.UUID
		err := tx.QueryRow(`
			INSERT INTO routing_steps (routing_id, step_order, name, dependency_policy)
			VALUES ($1, $2, $3, $4)
			RETURNING id
		`, rID, stepInput.StepOrder, nullStr(stepInput.Name), stepInput.DependencyPolicy).Scan(&stepID)
		if err != nil {
			return nil, fmt.Errorf("failed to create routing step %d: %w", stepInput.StepOrder, err)
		}

		step := models.RoutingStep{
			ID: stepID, RoutingID: rID,
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

	// ── Record in routing edit timeline ───────────────────────────────────────────
	tx.Exec(`
		INSERT INTO routing_edit_timeline (routing_id, previous_routing_id, new_routing_id, edited_by, editor_email, editor_name, edit_reason, change_type)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'new_version')
	`, previousRoutingID, previousRoutingID, rID, creatorID, creatorEmail, creatorName, req.ChangeReason)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// ── Handle Level3 task cleanup ─────────────────────────────────────────────────
	// Remove tasks from the previous routing from Level3 MyTasks and UpcomingTasks
	// This effectively "resets" the project for Level3 departments
	go s.handleRoutingVersionChangeForLevel3(projectID, previousRoutingID, rID)

	s.auditSvc.Log(AuditEntry{
		OrgID: orgID, ProjectID: &projectID, ActorID: &creatorID,
		Action: models.AuditCreated, EntityType: "routing_version", EntityID: &rID,
		EntityName: fmt.Sprintf("New routing version %d created by %s with Reason: %s", nextVersion, creatorEmail, req.ChangeReason),
		Metadata: map[string]string{
			"previous_routing_id": previousRoutingID.String(),
			"change_reason":        req.ChangeReason,
		},
	})

	return s.GetRouting(rID)
}

// ── handleRoutingVersionChangeForLevel3 ─────────────────────────────────────────
// Handles the cleanup of Level3 tasks when a new routing version is created.
// This removes old tasks from MyTasks and UpcomingTasks, effectively resetting the project for Level3.

func (s *RoutingService) handleRoutingVersionChangeForLevel3(projectID, previousRoutingID, newRoutingID uuid.UUID) {
	// Mark tasks from previous routing as archived/historical
	_, err := s.db.Exec(`
		UPDATE department_tasks 
		SET status = 'archived', 
		    completed_at = NOW()
		WHERE routing_id = $1 AND status NOT IN ('completed', 'archived')
	`, previousRoutingID)
	if err != nil {
		fmt.Printf("Error archiving previous routing tasks: %v\n", err)
	}

	// Remove upcoming tasks for the previous routing
	_, err = s.db.Exec(`
		DELETE FROM upcoming_tasks 
		WHERE routing_id = $1
	`, previousRoutingID)
	if err != nil {
		fmt.Printf("Error removing previous routing upcoming tasks: %v\n", err)
	}

	// Generate new upcoming tasks for the new routing
	// This will be done when the new routing is published
	fmt.Printf("Routing version change handled: Previous routing %s archived, new routing %s ready for task generation\n", previousRoutingID, newRoutingID)
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

	// Set project status to in_progress 
	tx.Exec(`
		UPDATE projects
		SET status = 'in_progress', updated_at = NOW()
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
	// Check if this is the latest routing version for the project
	var isLatest bool
	err := s.db.QueryRow(`SELECT is_latest FROM routings WHERE id = $1`, routingID).Scan(&isLatest)
	if err != nil || !isLatest {
		// Only generate tasks for the latest routing version
		fmt.Printf("Skipping task generation for routing %s (not latest version)\n", routingID)
		return
	}

	steps, err := s.GetRoutingSteps(routingID)
	if err != nil {
		return
	}

	if len(steps) == 0 {
		return
	}

	var pName string
	s.db.QueryRow(`SELECT project_name FROM projects WHERE id = $1`, projectID).Scan(&pName)

	// Sequential routing flow for Level3:
	// - First step: create tasks with 'on_hold' status
	// - Other steps: create upcoming_tasks entries
	for _, step := range steps {
		for _, dept := range step.Departments {
			if step.StepOrder == 1 {
				// First step: create tasks with 'on_hold' status
				var taskID uuid.UUID
				err := s.db.QueryRow(`
					INSERT INTO department_tasks (project_id, routing_id, routing_step_id, department_id, status, routed_to_dept_at)
					VALUES ($1, $2, $3, $4, 'on_hold', NOW())
					ON CONFLICT DO NOTHING
					RETURNING id
				`, projectID, routingID, step.ID, dept.ID).Scan(&taskID)
				if err != nil {
					continue
				}
				// Notify first step departments
				go s.notifSvc.NotifyDepartment(orgID, dept.ID, models.NotifTaskAssigned,
					"New Task Assigned",
					fmt.Sprintf("You have a new task for project: %s. Please set expected completion date to start.", pName),
					&projectID, "task", &taskID,
				)
			} else {
				// Other steps: create upcoming_tasks entries
				_, err := s.db.Exec(`
					INSERT INTO upcoming_tasks (project_id, routing_id, routing_step_id, department_id, step_order)
					VALUES ($1, $2, $3, $4, $5)
					ON CONFLICT DO NOTHING
				`, projectID, routingID, step.ID, dept.ID, step.StepOrder)
				if err != nil {
					fmt.Printf("Error creating upcoming task: %v\n", err)
				}
				// Notify upcoming departments
				go s.notifSvc.NotifyDepartment(orgID, dept.ID, models.NotifTaskAssigned,
					"Upcoming Project",
					fmt.Sprintf("Project %s is coming soon to your department. You will be notified when it's your turn.", pName),
					&projectID, "project", &projectID,
				)
			}
		}
	}
}

// ── GetRouting ────────────────────────────────────────────────────────────────

func (s *RoutingService) GetRouting(id uuid.UUID) (*models.Routing, error) {
	var r models.Routing
	var rName, rDesc, rParentID, rCreatedByName, rChangeReason sql.NullString
	var rPubAt sql.NullTime

	err := s.db.QueryRow(`
		SELECT r.id, r.project_id, r.version,
		       r.name, r.description, r.status,
		       r.parent_routing_id, r.routing_type, r.created_by, r.published_at,
		       r.is_latest, r.change_reason,
		       r.created_at, r.updated_at,
		       COALESCE(CONCAT(e.first_name, ' ', e.last_name), '') AS created_by_name
		FROM routings r
		LEFT JOIN employees e ON e.id = r.created_by
		WHERE r.id = $1
	`, id).Scan(
		&r.ID, &r.ProjectID, &r.Version,
		&rName, &rDesc, &r.Status,
		&rParentID, &r.RoutingType, &r.CreatedBy, &rPubAt,
		&r.IsLatest, &rChangeReason,
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
	if rChangeReason.Valid {
		r.ChangeReason = rChangeReason.String
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
		       r.published_at, r.is_latest, r.change_reason, r.parent_routing_id,
		       r.created_at, r.updated_at,
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
		var rCreatedByName, rParentID, rChangeReason sql.NullString
		rows.Scan(
			&r.ID, &r.ProjectID, &r.Version,
			&r.Name, &r.Status, &r.RoutingType, &r.CreatedBy,
			&rPubAt, &r.IsLatest, &rChangeReason, &rParentID,
			&r.CreatedAt, &r.UpdatedAt, &rCreatedByName,
		)
		if rPubAt.Valid {
			r.PublishedAt = &rPubAt.Time
		}
		if rCreatedByName.Valid {
			r.CreatedByName = rCreatedByName.String
		}
		if rParentID.Valid {
			pid, _ := uuid.Parse(rParentID.String)
			r.ParentRoutingID = &pid
		}
		if rChangeReason.Valid {
			r.ChangeReason = rChangeReason.String
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
			fmt.Sprintf("Your department has a new task for: %s. Please set expected completion date to start.", pName),
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
		JOIN routings r ON r.id = ut.routing_id
		LEFT JOIN department_tasks dt ON dt.routing_id = ut.routing_id 
			AND dt.routing_step_id = (SELECT rs2.id FROM routing_steps rs2 WHERE rs2.routing_id = ut.routing_id AND rs2.step_order = ut.step_order - 1 LIMIT 1)
		LEFT JOIN current_step cs ON cs.routing_id = ut.routing_id
		WHERE ut.department_id = $1 AND r.is_latest = TRUE
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
