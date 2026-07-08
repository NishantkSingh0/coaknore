package services

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/pms/backend/internal/models"
)

type ReworkService struct {
	db         *sql.DB
	auditSvc   *AuditService
	notifSvc   *NotificationService
	routingSvc *RoutingService
}

func NewReworkService(db *sql.DB, audit *AuditService, notif *NotificationService, routing *RoutingService) *ReworkService {
	return &ReworkService{db: db, auditSvc: audit, notifSvc: notif, routingSvc: routing}
}

type CreateReworkRequest struct {
	RequestingTaskID   string `json:"requesting_task_id"`
	TargetDepartmentID string `json:"target_department_id"`
	Reason             string `json:"reason"`
	Description        string `json:"description"`
}

func (s *ReworkService) RequestRework(orgID, projectID, deptID, requestedBy uuid.UUID, req CreateReworkRequest) (*models.ReworkRequest, error) {
	if req.Reason == "" {
		return nil, errors.New("reason is required")
	}

	taskID, err := uuid.Parse(req.RequestingTaskID)
	if err != nil {
		return nil, errors.New("invalid requesting_task_id")
	}
	targetDeptID, err := uuid.Parse(req.TargetDepartmentID)
	if err != nil {
		return nil, errors.New("invalid target_department_id")
	}

	rework := &models.ReworkRequest{}
	var rDescription sql.NullString
	err = s.db.QueryRow(`
		INSERT INTO rework_requests (project_id, requesting_task_id, requesting_dept_id, requested_by, target_department_id, reason, description, status)
		VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
		RETURNING id, project_id, requesting_task_id, requesting_dept_id, requested_by,
		          target_department_id, reason, description, status, created_at, updated_at
	`, projectID, taskID, deptID, requestedBy, targetDeptID, req.Reason, nullStr(req.Description)).Scan(
		&rework.ID, &rework.ProjectID, &rework.RequestingTaskID, &rework.RequestingDeptID, &rework.RequestedBy,
		&rework.TargetDepartmentID, &rework.Reason, &rDescription, &rework.Status, &rework.CreatedAt, &rework.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create rework request: %w", err)
	}
	if rDescription.Valid {
		rework.Description = rDescription.String
	}

	s.auditSvc.Log(AuditEntry{
		OrgID: orgID, ProjectID: &projectID, ActorID: &requestedBy,
		Action: models.AuditCreated, EntityType: "rework_request", EntityID: &rework.ID,
		EntityName: "Rework Request",
	})

	go s.notifSvc.NotifyLayer(orgID, []models.LayerType{models.LayerTwo}, models.NotifReworkRequest,
		"Rework Request",
		fmt.Sprintf("A rework request has been submitted for a project"),
		&projectID, "rework_request", &rework.ID)

	return rework, nil
}

type ApproveReworkRequest struct {
	Notes           string             `json:"notes"`
	NewRoutingSteps []RoutingStepInput `json:"new_routing_steps"`
}

func (s *ReworkService) ApproveRework(orgID, reworkID, reviewerID uuid.UUID, req ApproveReworkRequest) (*models.ReworkRequest, error) {
	rework, err := s.GetRework(reworkID)
	if err != nil {
		return nil, err
	}
	if rework.Status != models.ReworkPending {
		return nil, errors.New("rework request is not in pending state")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Get current active routing to base the new one on
	var currentRoutingID uuid.UUID
	var currentVersion int
	err = s.db.QueryRow(`
		SELECT id, version FROM routings WHERE project_id = $1 AND status = 'active'
	`, rework.ProjectID).Scan(&currentRoutingID, &currentVersion)
	if err != nil {
		return nil, errors.New("no active routing found for project")
	}

	// Create new routing version
	newVersion := currentVersion + 1
	var newRoutingID uuid.UUID
	err = tx.QueryRow(`
		INSERT INTO routings (project_id, version, name, description, status, parent_routing_id, routing_type, created_by)
		VALUES ($1,$2,$3,'Rework routing','draft',$4,'rework',$5)
		RETURNING id
	`, rework.ProjectID, newVersion,
		fmt.Sprintf("Rework v%d - Back to %s", newVersion, rework.TargetDeptName),
		currentRoutingID, reviewerID,
	).Scan(&newRoutingID)
	if err != nil {
		return nil, fmt.Errorf("failed to create rework routing: %w", err)
	}

	// Copy steps from original routing that come before the target department,
	// then add target department forward
	if len(req.NewRoutingSteps) > 0 {
		for _, stepInput := range req.NewRoutingSteps {
			if stepInput.DependencyPolicy == "" {
				stepInput.DependencyPolicy = models.RequireAll
			}
			var stepID uuid.UUID
			tx.QueryRow(`
				INSERT INTO routing_steps (routing_id, step_order, name, dependency_policy)
				VALUES ($1,$2,$3,$4)
				RETURNING id
			`, newRoutingID, stepInput.StepOrder, nullStr(stepInput.Name), stepInput.DependencyPolicy).Scan(&stepID)

			for _, deptIDStr := range stepInput.DepartmentIDs {
				deptID, _ := uuid.Parse(deptIDStr)
				tx.Exec(`INSERT INTO routing_step_departments (routing_step_id, department_id) VALUES ($1,$2)`, stepID, deptID)
			}
		}
	} else {
		// Default: just add target department as first step, then copy subsequent steps
		var stepID uuid.UUID
		tx.QueryRow(`
			INSERT INTO routing_steps (routing_id, step_order, dependency_policy)
			VALUES ($1,1,'require_all')
			RETURNING id
		`, newRoutingID).Scan(&stepID)
		tx.Exec(`INSERT INTO routing_step_departments (routing_step_id, department_id) VALUES ($1,$2)`, stepID, rework.TargetDepartmentID)
	}

	// Update rework request
	tx.Exec(`
		UPDATE rework_requests SET status = 'approved', reviewed_by = $1, review_notes = $2,
		       reviewed_at = NOW(), new_routing_id = $3, updated_at = NOW()
		WHERE id = $4
	`, reviewerID, nullStr(req.Notes), newRoutingID, reworkID)

	// Supersede current routing
	tx.Exec(`UPDATE routings SET status = 'superseded', updated_at = NOW() WHERE id = $1`, currentRoutingID)

	// Activate new routing
	tx.Exec(`UPDATE routings SET status = 'active', published_at = NOW(), updated_at = NOW() WHERE id = $1`, newRoutingID)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Generate tasks for new routing
	go s.routingSvc.generateTasksFromRouting(orgID, rework.ProjectID, newRoutingID, reviewerID)

	// Notify requesting department
	go s.notifSvc.NotifyDepartment(orgID, rework.RequestingDeptID, models.NotifReworkApproved,
		"Rework Request Approved",
		"Your rework request has been approved and new routing has been created",
		&rework.ProjectID, "rework_request", &reworkID)

	s.auditSvc.Log(AuditEntry{
		OrgID: orgID, ProjectID: &rework.ProjectID, ActorID: &reviewerID,
		Action: models.AuditApproved, EntityType: "rework_request", EntityID: &reworkID,
	})

	return s.GetRework(reworkID)
}

func (s *ReworkService) RejectRework(orgID, reworkID, reviewerID uuid.UUID, notes string) error {
	rework, err := s.GetRework(reworkID)
	if err != nil {
		return err
	}
	if rework.Status != models.ReworkPending {
		return errors.New("rework request is not in pending state")
	}

	_, err = s.db.Exec(`
		UPDATE rework_requests SET status = 'rejected', reviewed_by = $1, review_notes = $2,
		       reviewed_at = NOW(), updated_at = NOW()
		WHERE id = $3
	`, reviewerID, nullStr(notes), reworkID)
	if err != nil {
		return err
	}

	go s.notifSvc.NotifyDepartment(orgID, rework.RequestingDeptID, models.NotifReworkRejected,
		"Rework Request Rejected",
		"Your rework request has been rejected",
		&rework.ProjectID, "rework_request", &reworkID)

	return nil
}

func (s *ReworkService) GetRework(id uuid.UUID) (*models.ReworkRequest, error) {
	rework := &models.ReworkRequest{}
	var (
		reviewedBy, newRoutingID          sql.NullString
		reviewNotes                       sql.NullString
		reviewedAt                        sql.NullTime
		reqDeptName, targetDeptName       sql.NullString
		requestedByName, reviewedByName   sql.NullString
		description                       sql.NullString
	)

	err := s.db.QueryRow(`
		SELECT r.id, r.project_id, r.requesting_task_id, r.requesting_dept_id, r.requested_by,
		       r.target_department_id, r.reason, r.description, r.status,
		       r.reviewed_by, r.review_notes, r.reviewed_at, r.new_routing_id,
		       r.created_at, r.updated_at,
		       COALESCE(rd.name,'') as req_dept_name,
		       COALESCE(td.name,'') as target_dept_name,
		       COALESCE(CONCAT(rb.first_name,' ',rb.last_name),'') as requested_by_name,
		       COALESCE(CONCAT(rv.first_name,' ',rv.last_name),'') as reviewed_by_name
		FROM rework_requests r
		LEFT JOIN departments rd ON rd.id = r.requesting_dept_id
		LEFT JOIN departments td ON td.id = r.target_department_id
		LEFT JOIN employees rb ON rb.id = r.requested_by
		LEFT JOIN employees rv ON rv.id = r.reviewed_by
		WHERE r.id = $1
	`, id).Scan(
		&rework.ID, &rework.ProjectID, &rework.RequestingTaskID, &rework.RequestingDeptID, &rework.RequestedBy,
		&rework.TargetDepartmentID, &rework.Reason, &description, &rework.Status,
		&reviewedBy, &reviewNotes, &reviewedAt, &newRoutingID,
		&rework.CreatedAt, &rework.UpdatedAt,
		&reqDeptName, &targetDeptName, &requestedByName, &reviewedByName,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("rework request not found")
	}
	if err != nil {
		return nil, err
	}

	if description.Valid {
		rework.Description = description.String
	}
	if reviewedBy.Valid {
		id, _ := uuid.Parse(reviewedBy.String)
		rework.ReviewedBy = &id
	}
	if reviewNotes.Valid {
		rework.ReviewNotes = reviewNotes.String
	}
	if reviewedAt.Valid {
		rework.ReviewedAt = &reviewedAt.Time
	}
	if newRoutingID.Valid {
		id, _ := uuid.Parse(newRoutingID.String)
		rework.NewRoutingID = &id
	}
	if reqDeptName.Valid {
		rework.RequestingDeptName = reqDeptName.String
	}
	if targetDeptName.Valid {
		rework.TargetDeptName = targetDeptName.String
	}
	if requestedByName.Valid {
		rework.RequestedByName = requestedByName.String
	}
	if reviewedByName.Valid {
		rework.ReviewedByName = reviewedByName.String
	}

	return rework, nil
}

func (s *ReworkService) ListReworks(orgID uuid.UUID, projectID *uuid.UUID, status string, page, pageSize int) ([]models.ReworkRequest, int, error) {
	conditions := []string{}
	args := []interface{}{}
	argIdx := 1

	if projectID != nil {
		conditions = append(conditions, fmt.Sprintf("r.project_id = $%d", argIdx))
		args = append(args, *projectID)
		argIdx++
	} else {
		conditions = append(conditions, fmt.Sprintf(`r.project_id IN (
			SELECT id FROM projects WHERE organization_id = $%d
		)`, argIdx))
		args = append(args, orgID)
		argIdx++
	}

	if status != "" {
		conditions = append(conditions, fmt.Sprintf("r.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	where := "WHERE " + joinConditions(conditions, " AND ")
	var total int
	s.db.QueryRow(`SELECT COUNT(*) FROM rework_requests r `+where, args...).Scan(&total)

	query := fmt.Sprintf(`
		SELECT r.id, r.project_id, r.requesting_dept_id, r.requested_by,
		       r.target_department_id, r.reason, r.status, r.created_at, r.updated_at,
		       COALESCE(rd.name,'') as req_dept_name,
		       COALESCE(td.name,'') as target_dept_name,
		       COALESCE(CONCAT(rb.first_name,' ',rb.last_name),'') as requested_by_name,
		       COALESCE(p.project_name,'') as project_name
		FROM rework_requests r
		LEFT JOIN departments rd ON rd.id = r.requesting_dept_id
		LEFT JOIN departments td ON td.id = r.target_department_id
		LEFT JOIN employees rb ON rb.id = r.requested_by
		LEFT JOIN projects p ON p.id = r.project_id
		%s
		ORDER BY r.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, pageSize, (page-1)*pageSize)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var reworks []models.ReworkRequest
	for rows.Next() {
		var r models.ReworkRequest
		var reqDeptName, targetDeptName, requestedByName, projName sql.NullString
		rows.Scan(
			&r.ID, &r.ProjectID, &r.RequestingDeptID, &r.RequestedBy,
			&r.TargetDepartmentID, &r.Reason, &r.Status, &r.CreatedAt, &r.UpdatedAt,
			&reqDeptName, &targetDeptName, &requestedByName, &projName,
		)
		if reqDeptName.Valid {
			r.RequestingDeptName = reqDeptName.String
		}
		if targetDeptName.Valid {
			r.TargetDeptName = targetDeptName.String
		}
		if requestedByName.Valid {
			r.RequestedByName = requestedByName.String
		}
		reworks = append(reworks, r)
	}
	return reworks, total, nil
}
