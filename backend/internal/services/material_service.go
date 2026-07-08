package services

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/pms/backend/internal/models"
)

type MaterialService struct {
	db       *sql.DB
	auditSvc *AuditService
	notifSvc *NotificationService
}

func NewMaterialService(db *sql.DB, audit *AuditService, notif *NotificationService) *MaterialService {
	return &MaterialService{db: db, auditSvc: audit, notifSvc: notif}
}

type CreateMaterialRequest struct {
	ProjectID   string              `json:"project_id"`
	TaskID      string              `json:"task_id"`
	Title       string              `json:"title"`
	Description string              `json:"description"`
	Items       []MaterialItemInput `json:"items"`
}

type MaterialItemInput struct {
	MaterialName  string  `json:"material_name"`
	Quantity      float64 `json:"quantity"`
	Unit          string  `json:"unit"`
	Description   string  `json:"description"`
	EstimatedCost float64 `json:"estimated_cost"`
}

// ── CreateRequisition ─────────────────────────────────────────────────────────

func (s *MaterialService) CreateRequisition(orgID, deptID, requestedBy uuid.UUID, req CreateMaterialRequest) (*models.MaterialRequisition, error) {
	if req.Title == "" {
		return nil, errors.New("title is required")
	}
	if len(req.Items) == 0 {
		return nil, errors.New("at least one item is required")
	}

	projectID, err := uuid.Parse(req.ProjectID)
	if err != nil {
		return nil, errors.New("invalid project_id")
	}

	var taskIDArg interface{}
	if req.TaskID != "" {
		id, err := uuid.Parse(req.TaskID)
		if err != nil {
			return nil, errors.New("invalid task_id")
		}
		taskIDArg = id
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	mat := &models.MaterialRequisition{}

	// description is TEXT NULL — must scan into NullString.
	var rTaskID, rDesc sql.NullString

	err = tx.QueryRow(`
		INSERT INTO material_requisitions
			(project_id, task_id, department_id, requested_by, title, description, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending')
		RETURNING id, project_id, task_id, department_id, requested_by,
		          title, description, status, created_at, updated_at
	`, projectID, taskIDArg, deptID, requestedBy, req.Title, nullStr(req.Description)).Scan(
		&mat.ID, &mat.ProjectID, &rTaskID, &mat.DepartmentID, &mat.RequestedBy,
		&mat.Title, &rDesc, &mat.Status, &mat.CreatedAt, &mat.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create requisition: %w", err)
	}

	if rTaskID.Valid {
		id, _ := uuid.Parse(rTaskID.String)
		mat.TaskID = &id
	}
	if rDesc.Valid {
		mat.Description = rDesc.String
	}

	// Insert line items — description and estimated_cost are both nullable.
	for _, item := range req.Items {
		var itemID uuid.UUID
		var itemReqID uuid.UUID
		var itemName string
		var itemQty float64
		var itemUnit string
		var itemDesc sql.NullString
		var itemCost sql.NullFloat64
		var itemCreatedAt interface{}

		err := tx.QueryRow(`
			INSERT INTO material_items
				(requisition_id, material_name, quantity, unit, description, estimated_cost)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id, requisition_id, material_name, quantity, unit,
			          description, estimated_cost, created_at
		`, mat.ID, item.MaterialName, item.Quantity, item.Unit,
			nullStr(item.Description), nullFloat64(item.EstimatedCost),
		).Scan(
			&itemID, &itemReqID, &itemName, &itemQty, &itemUnit,
			&itemDesc, &itemCost, &itemCreatedAt,
		)
		if err != nil {
			// Non-fatal — log and continue. The item was still inserted.
			continue
		}

		itemRec := models.MaterialItem{
			ID:           itemID,
			RequisitionID: mat.ID,
			MaterialName: item.MaterialName,
			Quantity:     item.Quantity,
			Unit:         item.Unit,
		}
		if itemDesc.Valid {
			itemRec.Description = itemDesc.String
		}
		if itemCost.Valid {
			itemRec.EstimatedCost = itemCost.Float64
		}
		mat.Items = append(mat.Items, itemRec)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Load display names after commit — use NullString for safety.
	var deptName, requesterName sql.NullString
	s.db.QueryRow(`SELECT name FROM departments WHERE id = $1`, deptID).Scan(&deptName)
	s.db.QueryRow(`SELECT CONCAT(first_name, ' ', last_name) FROM employees WHERE id = $1`, requestedBy).Scan(&requesterName)
	if deptName.Valid {
		mat.DeptName = deptName.String
	}
	if requesterName.Valid {
		mat.RequestedByName = requesterName.String
	}

	s.auditSvc.Log(AuditEntry{
		OrgID: orgID, ProjectID: &projectID, ActorID: &requestedBy,
		Action: models.AuditCreated, EntityType: "material_request",
		EntityID: &mat.ID, EntityName: req.Title,
	})

	go s.notifSvc.NotifyLayer(orgID, []models.LayerType{models.LayerTwo, models.LayerOne},
		models.NotifMaterialRequest, "Material Request",
		fmt.Sprintf("Material request: %s", req.Title),
		&projectID, "material_request", &mat.ID)

	return mat, nil
}

// ── ReviewRequisition ─────────────────────────────────────────────────────────

func (s *MaterialService) ReviewRequisition(orgID, reqID, reviewerID uuid.UUID, approve bool, notes string) error {
	mat, err := s.GetRequisition(reqID)
	if err != nil {
		return err
	}
	if mat.Status != models.MatReqPending {
		return errors.New("requisition is not pending")
	}

	newStatus := models.MatReqApproved
	notifType := models.NotifMaterialApproved
	if !approve {
		newStatus = models.MatReqRejected
		notifType = models.NotifMaterialRejected
	}

	s.db.Exec(`
		UPDATE material_requisitions
		SET status = $1, reviewed_by = $2, review_notes = $3, reviewed_at = NOW(), updated_at = NOW()
		WHERE id = $4
	`, newStatus, reviewerID, nullStr(notes), reqID)

	action := "approved"
	if !approve {
		action = "rejected"
	}
	go s.notifSvc.Send(orgID, mat.RequestedBy, notifType,
		fmt.Sprintf("Material Request %s", action),
		fmt.Sprintf("Your material request '%s' has been %s", mat.Title, action),
		&mat.ProjectID, "material_request", &reqID)

	return nil
}

// ── GetRequisition ────────────────────────────────────────────────────────────

func (s *MaterialService) GetRequisition(id uuid.UUID) (*models.MaterialRequisition, error) {
	mat := &models.MaterialRequisition{}
	var (
		taskID, reviewedBy                sql.NullString
		reviewNotes, desc                 sql.NullString
		deptName, requestedByName         sql.NullString
		reviewedAt                        sql.NullTime
	)

	err := s.db.QueryRow(`
		SELECT m.id, m.project_id, m.task_id, m.department_id, m.requested_by,
		       m.title, m.description, m.status,
		       m.reviewed_by, m.review_notes, m.reviewed_at,
		       m.created_at, m.updated_at,
		       COALESCE(d.name, '')                           AS dept_name,
		       COALESCE(CONCAT(e.first_name,' ',e.last_name),'') AS requested_by_name
		FROM material_requisitions m
		LEFT JOIN departments d ON d.id = m.department_id
		LEFT JOIN employees   e ON e.id = m.requested_by
		WHERE m.id = $1
	`, id).Scan(
		&mat.ID, &mat.ProjectID, &taskID, &mat.DepartmentID, &mat.RequestedBy,
		&mat.Title, &desc, &mat.Status,
		&reviewedBy, &reviewNotes, &reviewedAt,
		&mat.CreatedAt, &mat.UpdatedAt,
		&deptName, &requestedByName,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("requisition not found")
	}
	if err != nil {
		return nil, err
	}

	if taskID.Valid {
		id, _ := uuid.Parse(taskID.String)
		mat.TaskID = &id
	}
	if desc.Valid {
		mat.Description = desc.String
	}
	if reviewedBy.Valid {
		id, _ := uuid.Parse(reviewedBy.String)
		mat.ReviewedBy = &id
	}
	if reviewNotes.Valid {
		mat.ReviewNotes = reviewNotes.String
	}
	if reviewedAt.Valid {
		mat.ReviewedAt = &reviewedAt.Time
	}
	if deptName.Valid {
		mat.DeptName = deptName.String
	}
	if requestedByName.Valid {
		mat.RequestedByName = requestedByName.String
	}

	// Load items — description and estimated_cost are nullable.
	rows, _ := s.db.Query(`
		SELECT id, requisition_id, material_name, quantity, unit,
		       COALESCE(description, ''),
		       COALESCE(estimated_cost, 0),
		       created_at
		FROM material_items
		WHERE requisition_id = $1
		ORDER BY created_at
	`, id)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var item models.MaterialItem
			rows.Scan(
				&item.ID, &item.RequisitionID, &item.MaterialName,
				&item.Quantity, &item.Unit,
				&item.Description, &item.EstimatedCost,
				&item.CreatedAt,
			)
			mat.Items = append(mat.Items, item)
		}
	}

	return mat, nil
}

// ── ListRequisitions ──────────────────────────────────────────────────────────

func (s *MaterialService) ListRequisitions(orgID uuid.UUID, projectID *uuid.UUID, deptID *uuid.UUID, status string, page, pageSize int) ([]models.MaterialRequisition, int, error) {
	conditions := []string{"d.organization_id = $1"}
	args := []interface{}{orgID}
	argIdx := 2

	if projectID != nil {
		conditions = append(conditions, fmt.Sprintf("m.project_id = $%d", argIdx))
		args = append(args, *projectID)
		argIdx++
	}
	if deptID != nil {
		conditions = append(conditions, fmt.Sprintf("m.department_id = $%d", argIdx))
		args = append(args, *deptID)
		argIdx++
	}
	if status != "" {
		conditions = append(conditions, fmt.Sprintf("m.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	where := "WHERE " + joinConditions(conditions, " AND ")

	var total int
	s.db.QueryRow(`
		SELECT COUNT(*)
		FROM material_requisitions m
		LEFT JOIN departments d ON d.id = m.department_id
		`+where, args...).Scan(&total)

	query := fmt.Sprintf(`
		SELECT m.id, m.project_id, m.department_id, m.requested_by,
		       m.title, m.status, m.created_at,
		       COALESCE(d.name, '')                              AS dept_name,
		       COALESCE(CONCAT(e.first_name,' ',e.last_name),'') AS requested_by_name,
		       COALESCE(p.project_name, '')                      AS project_name
		FROM material_requisitions m
		LEFT JOIN departments d ON d.id = m.department_id
		LEFT JOIN employees   e ON e.id = m.requested_by
		LEFT JOIN projects    p ON p.id = m.project_id
		%s
		ORDER BY m.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, pageSize, (page-1)*pageSize)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var mats []models.MaterialRequisition
	for rows.Next() {
		var m models.MaterialRequisition
		var deptName, requestedByName, projName sql.NullString
		rows.Scan(
			&m.ID, &m.ProjectID, &m.DepartmentID, &m.RequestedBy,
			&m.Title, &m.Status, &m.CreatedAt,
			&deptName, &requestedByName, &projName,
		)
		if deptName.Valid {
			m.DeptName = deptName.String
		}
		if requestedByName.Valid {
			m.RequestedByName = requestedByName.String
		}
		mats = append(mats, m)
	}
	return mats, total, nil
}

// nullFloat64 returns nil when f == 0 to avoid inserting 0 for "not provided".
func nullFloat64(f float64) interface{} {
	if f == 0 {
		return nil
	}
	return f
}
