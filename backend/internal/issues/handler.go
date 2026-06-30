package issues

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"pms/backend/internal/auth"
	"pms/backend/internal/notifications"
	"pms/backend/pkg/response"
	"pms/backend/pkg/validator"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"
)

type Handler struct {
	db     *sqlx.DB
	notifs *notifications.Service
}

func NewHandler(db *sqlx.DB, notifs *notifications.Service) *Handler {
	return &Handler{db: db, notifs: notifs}
}

// List GET /issues
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromCtx(r.Context())
	var issues []Issue
	var err error
	if claims.Role == "layer3" {
		err = h.db.Select(&issues, `
			SELECT * FROM issues WHERE raised_by_dept_id=$1::uuid ORDER BY created_at DESC`,
			claims.DepartmentID)
	} else {
		err = h.db.Select(&issues, `SELECT * FROM issues ORDER BY created_at DESC`)
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	response.JSON(w, http.StatusOK, issues)
}

// GetByID GET /issues/:id
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var issue Issue
	if err := h.db.Get(&issue, `SELECT * FROM issues WHERE id=$1`, id); err != nil {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "issue not found", "")
		return
	}
	response.JSON(w, http.StatusOK, issue)
}

// Create POST /issues (L3 only)
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromCtx(r.Context())
	var req CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "invalid request body", "")
		return
	}
	if ve := validator.Validate(req); ve != nil {
		response.Error(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", ve.Message, ve.Field)
		return
	}

	if req.TaskID != nil {
		var ownsTask bool
		if err := h.db.Get(&ownsTask, `
			SELECT EXISTS(
				SELECT 1 FROM project_department_tasks
				WHERE id=$1::uuid AND project_id=$2::uuid AND department_id=NULLIF($3,'')::uuid
			)`, *req.TaskID, req.ProjectID, claims.DepartmentID); err != nil || !ownsTask {
			response.Error(w, http.StatusForbidden, "FORBIDDEN", "task does not belong to your department", "")
			return
		}
	} else {
		var ownsProject bool
		if err := h.db.Get(&ownsProject, `
			SELECT EXISTS(
				SELECT 1 FROM project_department_tasks
				WHERE project_id=$1::uuid AND department_id=NULLIF($2,'')::uuid
			)`, req.ProjectID, claims.DepartmentID); err != nil || !ownsProject {
			response.Error(w, http.StatusForbidden, "FORBIDDEN", "project is not assigned to your department", "")
			return
		}
	}

	var issue Issue
	err := h.db.QueryRowx(`
		INSERT INTO issues (project_id, task_id, raised_by_dept_id, raised_by_user_id, issue_type, status, description, addon)
		VALUES ($1::uuid, NULLIF($2, '')::uuid, NULLIF($3, '')::uuid, $4::uuid, $5, 'pending_approval', $6, $7)
		RETURNING *`,
		req.ProjectID, nullableString(req.TaskID), claims.DepartmentID, claims.UserID,
		req.IssueType, req.Description, req.Addon,
	).StructScan(&issue)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}

	// If task exists, set to issue_hold
	if req.TaskID != nil {
		_, _ = h.db.Exec(`
			UPDATE project_department_tasks
			SET status='issue_hold', updated_at=NOW()
			WHERE id=$1::uuid AND department_id=NULLIF($2,'')::uuid`, *req.TaskID, claims.DepartmentID)
	}

	// Notify L2-Production for approval
	go h.notifyProduction(issue.ID, req.ProjectID, "issue_raised",
		"Issue Raised", "A new issue requires your approval")

	response.JSON(w, http.StatusCreated, issue)
}

// Approve PUT /issues/:id/approve
func (h *Handler) Approve(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	claims := auth.ClaimsFromCtx(r.Context())
	now := time.Now()

	var issue Issue
	if err := h.db.Get(&issue, `SELECT * FROM issues WHERE id=$1::uuid`, id); err != nil {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "issue not found", "")
		return
	}

	_, err := h.db.Exec(`
		UPDATE issues SET status='approved', approved_by_user_id=$1::uuid, approved_at=$2, updated_at=$2 WHERE id=$3::uuid`,
		claims.UserID, now, id)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}

	// Notify raising dept
	go h.notifs.NotifyDept(issue.RaisedByDeptID, issue.ProjectID, id,
		"issue_approved", "Issue Approved", "Your issue has been approved")
	// Notify all L2
	go h.notifs.NotifyAllLayer2(issue.ProjectID, id, "issue_approved",
		"Issue Approved", "An issue has been approved")

	response.JSON(w, http.StatusOK, map[string]string{"message": "issue approved"})
}

// Reject PUT /issues/:id/reject
func (h *Handler) Reject(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	now := time.Now()

	var issue Issue
	if err := h.db.Get(&issue, `SELECT * FROM issues WHERE id=$1::uuid`, id); err != nil {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "issue not found", "")
		return
	}

	_, _ = h.db.Exec(`UPDATE issues SET status='rejected', updated_at=$1 WHERE id=$2::uuid`, now, id)

	// Notify raising dept
	go h.notifs.NotifyDept(issue.RaisedByDeptID, issue.ProjectID, id,
		"issue_approved", "Issue Rejected", "Your issue has been rejected")

	response.JSON(w, http.StatusOK, map[string]string{"message": "issue rejected"})
}

// Close PUT /issues/:id/close (raiser dept only)
func (h *Handler) Close(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	claims := auth.ClaimsFromCtx(r.Context())

	var issue Issue
	if err := h.db.Get(&issue, `SELECT * FROM issues WHERE id=$1::uuid`, id); err != nil {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "issue not found", "")
		return
	}
	if issue.RaisedByDeptID != claims.DepartmentID {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "only the raising department can close this issue", "")
		return
	}

	now := time.Now()
	_, _ = h.db.Exec(`UPDATE issues SET status='closed', closed_at=$1, updated_at=$1 WHERE id=$2::uuid`, now, id)

	// If there was a task in issue_hold, revert to in_progress
	if issue.TaskID != nil {
		_, _ = h.db.Exec(`
			UPDATE project_department_tasks
			SET status='in_progress', updated_at=NOW()
			WHERE id=$1::uuid AND status='issue_hold' AND department_id=NULLIF($2,'')::uuid`, *issue.TaskID, claims.DepartmentID)
	}

	go h.notifyProduction(issue.ID, issue.ProjectID, "issue_closed",
		"Issue Closed", "An issue has been closed by the raising department")

	response.JSON(w, http.StatusOK, map[string]string{"message": "issue closed"})
}

// CreateMaterialRequisition POST /issues/:id/material-requisition
func (h *Handler) CreateMaterialRequisition(w http.ResponseWriter, r *http.Request) {
	issueID := chi.URLParam(r, "id")
	claims := auth.ClaimsFromCtx(r.Context())
	var req MaterialRequisitionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "invalid request body", "")
		return
	}
	if ve := validator.Validate(req); ve != nil {
		response.Error(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", ve.Message, ve.Field)
		return
	}
	if !h.issueBelongsToDept(issueID, claims.DepartmentID) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "issue does not belong to your department", "")
		return
	}

	var mrID string
	if err := h.db.QueryRow(`
		INSERT INTO material_requisitions (issue_id, department, request_date)
		VALUES ($1::uuid, $2, $3::date) RETURNING id`,
		issueID, req.Department, req.RequestDate,
	).Scan(&mrID); err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}

	for _, item := range req.Items {
		_, _ = h.db.Exec(`
			INSERT INTO material_requisition_items (requisition_id, material_name, material_description, quantity_required, unit)
			VALUES ($1::uuid, $2, $3, $4, $5)`,
			mrID, item.MaterialName, item.MaterialDescription, item.QuantityRequired, item.Unit)
	}

	response.JSON(w, http.StatusCreated, map[string]string{"requisition_id": mrID})
}

// GetMaterialRequisition GET /issues/:id/material-requisition
func (h *Handler) GetMaterialRequisition(w http.ResponseWriter, r *http.Request) {
	issueID := chi.URLParam(r, "id")

	var mr struct {
		ID          string     `db:"id"           json:"id"`
		IssueID     string     `db:"issue_id"     json:"issue_id"`
		Department  string     `db:"department"   json:"department"`
		RequestDate time.Time  `db:"request_date" json:"request_date"`
		IsApproved  bool       `db:"is_approved"  json:"is_approved"`
		ApprovedBy  *string    `db:"approved_by"  json:"approved_by"`
		ApprovedAt  *time.Time `db:"approved_at"  json:"approved_at"`
		Addon       *string    `db:"addon"        json:"addon"`
		CreatedAt   time.Time  `db:"created_at"   json:"created_at"`
		UpdatedAt   time.Time  `db:"updated_at"   json:"updated_at"`
	}
	if err := h.db.Get(&mr, `SELECT * FROM material_requisitions WHERE issue_id=$1::uuid LIMIT 1`, issueID); err != nil {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "no requisition found", "")
		return
	}

	var items []struct {
		ID                  string    `db:"id"                   json:"id"`
		RequisitionID       string    `db:"requisition_id"       json:"requisition_id"`
		MaterialName        string    `db:"material_name"        json:"material_name"`
		MaterialDescription *string   `db:"material_description" json:"material_description"`
		QuantityRequired    float64   `db:"quantity_required"    json:"quantity_required"`
		Unit                *string   `db:"unit"                 json:"unit"`
		Addon               *string   `db:"addon"                json:"addon"`
		CreatedAt           time.Time `db:"created_at"           json:"created_at"`
	}
	_ = h.db.Select(&items, `SELECT * FROM material_requisition_items WHERE requisition_id=$1::uuid`, mr.ID)

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"requisition": mr,
		"items":       items,
	})
}

// CreateReworkRequest PUT /issues/:id/rework-request
func (h *Handler) CreateReworkRequest(w http.ResponseWriter, r *http.Request) {
	issueID := chi.URLParam(r, "id")
	claims := auth.ClaimsFromCtx(r.Context())
	var req ReworkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "invalid request body", "")
		return
	}
	if ve := validator.Validate(req); ve != nil {
		response.Error(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", ve.Message, ve.Field)
		return
	}
	if !h.issueBelongsToDept(issueID, claims.DepartmentID) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "issue does not belong to your department", "")
		return
	}
	_, err := h.db.Exec(`
		INSERT INTO rework_requests (issue_id, description)
		VALUES ($1::uuid, $2) ON CONFLICT DO NOTHING`, issueID, req.Description)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	response.JSON(w, http.StatusCreated, map[string]string{"message": "rework request saved"})
}

func nullableString(value *string) sql.NullString {
	if value == nil || *value == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: *value, Valid: true}
}

func (h *Handler) issueBelongsToDept(issueID, deptID string) bool {
	var belongs bool
	err := h.db.Get(&belongs, `
		SELECT EXISTS(
			SELECT 1 FROM issues
			WHERE id=$1::uuid AND raised_by_dept_id=NULLIF($2,'')::uuid
		)`, issueID, deptID)
	return err == nil && belongs
}

// notifyProduction is a helper to notify the Production department.
func (h *Handler) notifyProduction(issueID, projectID, nType, title, body string) {
	var productionDeptID string
	if err := h.db.Get(&productionDeptID, `SELECT id::text FROM departments WHERE name='Production' AND deleted_at IS NULL LIMIT 1`); err != nil {
		return
	}
	h.notifs.NotifyDept(productionDeptID, projectID, issueID, nType, title, body)
}
