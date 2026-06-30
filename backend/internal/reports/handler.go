package reports

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"pms/backend/internal/auth"
	"pms/backend/internal/files"
	"pms/backend/internal/notifications"
	"pms/backend/pkg/response"
	"pms/backend/pkg/validator"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"
)

type DailyReport struct {
	ID           string    `db:"id"            json:"id"`
	ProjectID    string    `db:"project_id"    json:"project_id"`
	DepartmentID string    `db:"department_id" json:"department_id"`
	SubmittedBy  string    `db:"submitted_by"  json:"submitted_by"`
	ReportDate   time.Time `db:"report_date"   json:"report_date"`
	Description  string    `db:"description"   json:"description"`
	ImageURL     *string   `db:"image_url"     json:"image_url"`
	Addon        *string   `db:"addon"         json:"addon"`
	CreatedAt    time.Time `db:"created_at"    json:"created_at"`
	// Joined
	ProjectName string `db:"project_name"  json:"project_name"`
	DeptName    string `db:"dept_name"     json:"dept_name"`
	UserName    string `db:"user_name"     json:"user_name"`
}

type CreateRequest struct {
	ProjectID   string  `json:"project_id"  validate:"required"`
	Description string  `json:"description" validate:"required,min=5"`
	ImageURL    *string `json:"image_url"`
	Addon       *string `json:"addon"`
}

type Handler struct {
	db     *sqlx.DB
	notifs *notifications.Service
	s3     *files.S3Client
}

func NewHandler(db *sqlx.DB, notifs *notifications.Service, s3 *files.S3Client) *Handler {
	return &Handler{db: db, notifs: notifs, s3: s3}
}

func (h *Handler) enrichReport(ctx context.Context, rpt *DailyReport) {
	if h.s3 != nil {
		rpt.ImageURL = h.s3.ResolveURL(ctx, rpt.ImageURL)
	}
}

func (h *Handler) enrichReports(ctx context.Context, reports []DailyReport) {
	for i := range reports {
		h.enrichReport(ctx, &reports[i])
	}
}

const reportCols = `
	dr.id, dr.project_id, dr.department_id::text, dr.submitted_by::text,
	dr.report_date, dr.description, dr.image_url, dr.addon, dr.created_at,
	p.project_name, d.name AS dept_name, u.name AS user_name`

// List GET /reports
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromCtx(r.Context())
	var reports []DailyReport
	var err error

	if claims.Role == "layer3" {
		err = h.db.Select(&reports, `
			SELECT `+reportCols+`
			FROM daily_reports dr
			JOIN projects p ON p.id = dr.project_id
			JOIN departments d ON d.id = dr.department_id
			JOIN users u ON u.id = dr.submitted_by
			WHERE dr.department_id = $1::uuid
			ORDER BY dr.report_date DESC`, claims.DepartmentID)
	} else {
		err = h.db.Select(&reports, `
			SELECT `+reportCols+`
			FROM daily_reports dr
			JOIN projects p ON p.id = dr.project_id
			JOIN departments d ON d.id = dr.department_id
			JOIN users u ON u.id = dr.submitted_by
			ORDER BY dr.report_date DESC LIMIT 100`)
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	h.enrichReports(r.Context(), reports)
	response.JSON(w, http.StatusOK, reports)
}

// GetByID GET /reports/:id
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var rpt DailyReport
	err := h.db.Get(&rpt, `
		SELECT `+reportCols+`
		FROM daily_reports dr
		JOIN projects p ON p.id = dr.project_id
		JOIN departments d ON d.id = dr.department_id
		JOIN users u ON u.id = dr.submitted_by
		WHERE dr.id = $1`, id)
	if err != nil {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "report not found", "")
		return
	}
	h.enrichReport(r.Context(), &rpt)
	response.JSON(w, http.StatusOK, rpt)
}

// Create POST /reports (L3 only)
// Attendance is a side-effect — never let L3 mark it manually.
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

	// Server-side day check — no Sunday submissions allowed
	today := time.Now()
	if today.Weekday() == time.Sunday {
		response.Error(w, http.StatusForbidden, "NO_SUNDAY", "report submissions are not allowed on Sundays", "")
		return
	}

	req.ImageURL = files.StorageKey(req.ImageURL)

	var rpt DailyReport
	err := h.db.QueryRowx(`
		INSERT INTO daily_reports (project_id, department_id, submitted_by, description, image_url, addon)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, project_id, department_id::text, submitted_by::text, report_date, description, image_url, addon, created_at`,
		req.ProjectID, claims.DepartmentID, claims.UserID, req.Description, req.ImageURL, req.Addon,
	).StructScan(&rpt)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}

	// --- Attendance side-effect ---
	// Insert attendance for today; ignore conflict (already present = already marked)
	_, _ = h.db.Exec(`
		INSERT INTO attendance (user_id, department_id, report_id, date)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, date) DO NOTHING`,
		claims.UserID, claims.DepartmentID, rpt.ID, today.Format("2006-01-02"))

	// Notify all L2 + admin
	go h.notifs.NotifyAllLayer2(req.ProjectID, "", "daily_report",
		"Daily Report Submitted", rpt.UserName+" submitted a daily report")

	h.enrichReport(r.Context(), &rpt)
	response.JSON(w, http.StatusCreated, rpt)
}
