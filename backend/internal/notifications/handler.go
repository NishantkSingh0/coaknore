package notifications

import (
	"net/http"
	"time"

	"pms/backend/internal/auth"
	"pms/backend/pkg/response"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"
)

type Handler struct {
	db *sqlx.DB
	svc *Service
}

func NewHandler(db *sqlx.DB, svc *Service) *Handler { return &Handler{db: db, svc: svc} }

// List GET /notifications — returns notifs for the current user or their dept.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromCtx(r.Context())
	var notifs []Notification
	// NULLIF converts empty string to NULL so the uuid cast doesn't fail for admin users
	err := h.db.Select(&notifs, `
		SELECT * FROM notifications
		WHERE (recipient_id = $1::uuid
		   OR dept_id = NULLIF($2, '')::uuid)
		ORDER BY created_at DESC LIMIT 50`,
		claims.UserID, claims.DepartmentID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	response.JSON(w, http.StatusOK, notifs)
}

// MarkRead PUT /notifications/:id/read
func (h *Handler) MarkRead(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	now := time.Now()
	_, _ = h.db.Exec(`UPDATE notifications SET is_read=true, read_at=$1 WHERE id=$2`, now, id)
	response.NoContent(w)
}

// MarkAllRead PUT /notifications/read-all
func (h *Handler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromCtx(r.Context())
	now := time.Now()
	_, _ = h.db.Exec(`
		UPDATE notifications SET is_read=true, read_at=$1
		WHERE (recipient_id = $2::uuid
		   OR dept_id = NULLIF($3, '')::uuid)
		  AND is_read=false`,
		now, claims.UserID, claims.DepartmentID)
	response.NoContent(w)
}
