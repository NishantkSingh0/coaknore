package dashboard

import (
	"net/http"
	"time"

	"pms/backend/internal/auth"
	"pms/backend/internal/files"
	"pms/backend/pkg/response"

	"github.com/jmoiron/sqlx"
)

type Handler struct {
	db *sqlx.DB
	s3 *files.S3Client
}

func NewHandler(db *sqlx.DB, s3 *files.S3Client) *Handler { return &Handler{db: db, s3: s3} }

// ── Admin ──────────────────────────────────────────────────────────────────

type adminStats struct {
	TotalProjects     int `db:"total_projects"     json:"total_projects"`
	PendingProjects   int `db:"pending_projects"   json:"pending_projects"`
	ActiveProjects    int `db:"active_projects"    json:"active_projects"`
	CompletedProjects int `db:"completed_projects" json:"completed_projects"`
	OpenIssues        int `db:"open_issues"        json:"open_issues"`
	OverdueTasks      int `db:"overdue_tasks"      json:"overdue_tasks"`
	TotalEmployees    int `db:"total_employees"    json:"total_employees"`
	TodayReports      int `db:"today_reports"      json:"today_reports"`
}

type recentProject struct {
	ID            string    `db:"id"             json:"id"`
	PONumber      string    `db:"po_number"      json:"po_number"`
	ProjectName   string    `db:"project_name"   json:"project_name"`
	CurrentStatus string    `db:"current_status" json:"current_status"`
	CreatedAt     time.Time `db:"created_at"     json:"created_at"`
}

// AdminDashboard GET /dashboard/admin
func (h *Handler) AdminDashboard(w http.ResponseWriter, r *http.Request) {
	var stats adminStats
	_ = h.db.Get(&stats, `
		SELECT
			(SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL)                                                     AS total_projects,
			(SELECT COUNT(*) FROM projects WHERE current_status='pending'      AND deleted_at IS NULL)                   AS pending_projects,
			(SELECT COUNT(*) FROM projects WHERE current_status IN ('routing_set','in_progress') AND deleted_at IS NULL) AS active_projects,
			(SELECT COUNT(*) FROM projects WHERE current_status='completed'    AND deleted_at IS NULL)                   AS completed_projects,
			(SELECT COUNT(*) FROM issues   WHERE status NOT IN ('closed','rejected'))                                    AS open_issues,
			(SELECT COUNT(*) FROM project_department_tasks WHERE due_date < CURRENT_DATE AND status != 'completed')      AS overdue_tasks,
			(SELECT COUNT(*) FROM users    WHERE deleted_at IS NULL AND role != 'admin')                                 AS total_employees,
			(SELECT COUNT(*) FROM daily_reports WHERE report_date = CURRENT_DATE)                                        AS today_reports
	`)

	var recentProjects []recentProject
	_ = h.db.Select(&recentProjects, `
		SELECT id::text, po_number, project_name, current_status, created_at
		FROM projects
		WHERE deleted_at IS NULL
		ORDER BY created_at DESC
		LIMIT 10`)

	if recentProjects == nil {
		recentProjects = []recentProject{}
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"stats":           stats,
		"recent_projects": recentProjects,
	})
}

// ── Layer 2 ────────────────────────────────────────────────────────────────

type todayReport struct {
	ID          string    `db:"id"           json:"id"`
	ReportDate  time.Time `db:"report_date"  json:"report_date"`
	Description string    `db:"description"  json:"description"`
	ImageURL    *string   `db:"image_url"    json:"image_url"`
	ProjectName string    `db:"project_name" json:"project_name"`
	PONumber    string    `db:"po_number"    json:"po_number"`
	DeptName    string    `db:"dept_name"    json:"dept_name"`
	UserName    string    `db:"user_name"    json:"user_name"`
}

type pendingIssue struct {
	ID          string    `db:"id"           json:"id"`
	IssueType   string    `db:"issue_type"   json:"issue_type"`
	Status      string    `db:"status"       json:"status"`
	Description *string   `db:"description"  json:"description"`
	CreatedAt   time.Time `db:"created_at"   json:"created_at"`
	ProjectName string    `db:"project_name" json:"project_name"`
	DeptName    string    `db:"dept_name"    json:"dept_name"`
}

// Layer2Dashboard GET /dashboard/layer2
func (h *Handler) Layer2Dashboard(w http.ResponseWriter, r *http.Request) {
	var todayReports []todayReport
	_ = h.db.Select(&todayReports, `
		SELECT dr.id::text, dr.report_date, dr.description, dr.image_url,
		       p.project_name, p.po_number, d.name AS dept_name, u.name AS user_name
		FROM daily_reports dr
		JOIN projects    p ON p.id = dr.project_id
		JOIN departments d ON d.id = dr.department_id
		JOIN users       u ON u.id = dr.submitted_by
		WHERE dr.report_date = CURRENT_DATE
		ORDER BY d.name, p.project_name`)

	var pendingIssues []pendingIssue
	_ = h.db.Select(&pendingIssues, `
		SELECT i.id::text, i.issue_type, i.status, i.description, i.created_at,
		       p.project_name, d.name AS dept_name
		FROM issues i
		JOIN projects    p ON p.id = i.project_id
		JOIN departments d ON d.id = i.raised_by_dept_id
		WHERE i.status IN ('open','pending_approval')
		ORDER BY i.created_at DESC
		LIMIT 20`)

	if todayReports == nil {
		todayReports = []todayReport{}
	}
	if pendingIssues == nil {
		pendingIssues = []pendingIssue{}
	}

	if h.s3 != nil {
		for i := range todayReports {
			todayReports[i].ImageURL = h.s3.ResolveURL(r.Context(), todayReports[i].ImageURL)
		}
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"today_reports":  todayReports,
		"pending_issues": pendingIssues,
	})
}

// ── Layer 3 ────────────────────────────────────────────────────────────────

type deptTask struct {
	ID          string  `db:"id"           json:"id"`
	Status      string  `db:"status"       json:"status"`
	StartDate   *string `db:"start_date"   json:"start_date"`
	DueDate     *string `db:"due_date"     json:"due_date"`
	IsOverdue   bool    `db:"is_overdue"   json:"is_overdue"`
	ProjectName string  `db:"project_name" json:"project_name"`
	PONumber    string  `db:"po_number"    json:"po_number"`
}

// Layer3Dashboard GET /dashboard/layer3
func (h *Handler) Layer3Dashboard(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromCtx(r.Context())

	var tasks []deptTask
	_ = h.db.Select(&tasks, `
		SELECT pdt.id::text, pdt.status,
		       pdt.start_date::text,
		       pdt.due_date::text,
		       (pdt.due_date IS NOT NULL AND pdt.due_date < CURRENT_DATE AND pdt.status != 'completed') AS is_overdue,
		       p.project_name, p.po_number
		FROM project_department_tasks pdt
		JOIN projects p ON p.id = pdt.project_id
		WHERE pdt.department_id = NULLIF($1,'')::uuid
		  AND pdt.status != 'completed'
		ORDER BY pdt.due_date ASC NULLS LAST`, claims.DepartmentID)

	if tasks == nil {
		tasks = []deptTask{}
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"tasks": tasks,
	})
}
