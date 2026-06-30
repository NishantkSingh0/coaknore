package tasks

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"pms/backend/internal/auth"
	"pms/backend/internal/notifications"
	"pms/backend/internal/projects"
	"pms/backend/pkg/response"
	"pms/backend/pkg/validator"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"
)

type Handler struct {
	db       *sqlx.DB
	notifs   *notifications.Service
	projRepo *projects.Repository
}

func NewHandler(db *sqlx.DB, notifs *notifications.Service, projRepo *projects.Repository) *Handler {
	return &Handler{db: db, notifs: notifs, projRepo: projRepo}
}

const taskCols = `
	pdt.id, pdt.routing_id, pdt.project_id, pdt.department_id::text,
	pdt.assigned_to_user_id::text, pdt.start_date, pdt.due_date, pdt.status,
	pdt.completed_at,
	(pdt.due_date IS NOT NULL AND pdt.due_date < CURRENT_DATE AND pdt.status != 'completed') AS is_overdue,
	pdt.addon, pdt.created_at, pdt.updated_at,
	p.project_name, p.po_number, d.name AS dept_name, pdr.sequence_order`

// List GET /tasks — scoped to current user's department
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromCtx(r.Context())
	var tasks []Task
	err := h.db.Select(&tasks, fmt.Sprintf(`
		SELECT %s
		FROM project_department_tasks pdt
		JOIN projects p ON p.id = pdt.project_id
		JOIN departments d ON d.id = pdt.department_id
		JOIN project_department_routing pdr ON pdr.id = pdt.routing_id
		WHERE pdt.department_id = $1::uuid
		ORDER BY pdt.due_date ASC NULLS LAST`, taskCols), claims.DepartmentID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	response.JSON(w, http.StatusOK, tasks)
}

// GetByID GET /tasks/:id
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var t Task
	err := h.db.Get(&t, fmt.Sprintf(`
		SELECT %s
		FROM project_department_tasks pdt
		JOIN projects p ON p.id = pdt.project_id
		JOIN departments d ON d.id = pdt.department_id
		JOIN project_department_routing pdr ON pdr.id = pdt.routing_id
		WHERE pdt.id = $1`, taskCols), id)
	if err != nil {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "task not found", "")
		return
	}
	// L3 can only see own dept's tasks
	claims := auth.ClaimsFromCtx(r.Context())
	if claims.Role == "layer3" && t.DepartmentID != claims.DepartmentID {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "access denied", "")
		return
	}
	response.JSON(w, http.StatusOK, t)
}

// Update PUT /tasks/:id (L3 only)
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req UpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "invalid request body", "")
		return
	}
	if ve := validator.Validate(req); ve != nil {
		response.Error(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", ve.Message, ve.Field)
		return
	}

	query := `UPDATE project_department_tasks SET updated_at=NOW()`
	args := []interface{}{}
	i := 1
	addField := func(col string, val interface{}) {
		query += fmt.Sprintf(", %s=$%d", col, i)
		args = append(args, val)
		i++
	}
	if req.StartDate != nil {
		addField("start_date", *req.StartDate)
	}
	if req.DueDate != nil {
		addField("due_date", *req.DueDate)
	}
	if req.AssignedToUserID != nil {
		addField("assigned_to_user_id", *req.AssignedToUserID)
	}
	if req.Addon != nil {
		addField("addon", *req.Addon)
	}

	completing := req.Status != nil && *req.Status == "completed"
	if req.Status != nil {
		if *req.Status == "completed" && (req.Addon == nil || *req.Addon == "") {
			response.Error(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", "completion proof is required", "addon")
			return
		}
		addField("status", *req.Status)
		if completing {
			addField("completed_at", time.Now())
		}
	}

	claims := auth.ClaimsFromCtx(r.Context())
	query += fmt.Sprintf(` WHERE id=$%d::uuid
		AND ($%d != 'layer3' OR department_id = NULLIF($%d, '')::uuid)
		RETURNING project_id, department_id::text,
		(SELECT sequence_order FROM project_department_routing WHERE id=routing_id)`, i, i+1, i+2)
	args = append(args, id)
	args = append(args, claims.Role, claims.DepartmentID)

	var result struct {
		ProjectID    string `db:"project_id"`
		DepartmentID string `db:"department_id"`
		SeqOrder     int    `db:"sequence_order"`
	}
	if err := h.db.QueryRowx(query, args...).StructScan(&result); err != nil {
		if err == sql.ErrNoRows {
			response.Error(w, http.StatusNotFound, "NOT_FOUND", "task not found", "")
			return
		}
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}

	// If completed, check parallel flow advancement
	if completing {
		_, _ = h.db.Exec(`
			UPDATE project_department_routing
			SET status='completed', completed_at=NOW(), updated_at=NOW()
			WHERE id=(SELECT routing_id FROM project_department_tasks WHERE id=$1::uuid)`, id)
		go func() {
			done, _ := h.projRepo.AdvanceRouting(h.db, result.ProjectID, result.SeqOrder)
			if done {
				h.notifs.NotifyAllLayer2(result.ProjectID, "", "task_completed",
					"Project Completed", "All departments have completed this project")
			} else {
				h.notifs.NotifyAllLayer2(result.ProjectID, "", "task_completed",
					"Department Task Completed", "A department finished their task")
			}
		}()
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "task updated"})
}
