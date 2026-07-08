package services

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/pms/backend/internal/models"
)

type DailyReportService struct {
	db       *sql.DB
	auditSvc *AuditService
	notifSvc *NotificationService
}

func NewDailyReportService(db *sql.DB, audit *AuditService, notif *NotificationService) *DailyReportService {
	return &DailyReportService{db: db, auditSvc: audit, notifSvc: notif}
}

type CreateReportRequest struct {
	ProjectID   string `json:"project_id"`
	TaskID      string `json:"task_id"`
	Description string `json:"description"`
	ReportDate  string `json:"report_date"`
}

// ── CreateReport ──────────────────────────────────────────────────────────────

func (s *DailyReportService) CreateReport(orgID, deptID, submittedBy uuid.UUID, req CreateReportRequest) (*models.DailyReport, error) {
	if req.Description == "" {
		return nil, errors.New("description is required")
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

	reportDate := time.Now()
	if req.ReportDate != "" {
		reportDate, err = time.Parse("2006-01-02", req.ReportDate)
		if err != nil {
			return nil, errors.New("invalid report_date format, use YYYY-MM-DD")
		}
	}

	report := &models.DailyReport{}
	var rTaskID sql.NullString

	err = s.db.QueryRow(`
		INSERT INTO daily_reports (project_id, department_id, submitted_by, task_id, description, report_date)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, project_id, department_id, submitted_by, task_id, description, report_date, created_at
	`, projectID, deptID, submittedBy, taskIDArg, req.Description, reportDate).Scan(
		&report.ID, &report.ProjectID, &report.DepartmentID, &report.SubmittedBy,
		&rTaskID, &report.Description, &report.ReportDate, &report.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create report: %w", err)
	}

	if rTaskID.Valid {
		id, _ := uuid.Parse(rTaskID.String)
		report.TaskID = &id
	}

	// Load display names safely — all columns are potentially NULL.
	var dName, subName, projName sql.NullString
	s.db.QueryRow(`SELECT name FROM departments WHERE id = $1`, deptID).Scan(&dName)
	s.db.QueryRow(`SELECT CONCAT(first_name,' ',last_name) FROM employees WHERE id = $1`, submittedBy).Scan(&subName)
	s.db.QueryRow(`SELECT project_name FROM projects WHERE id = $1`, projectID).Scan(&projName)

	if dName.Valid {
		report.DeptName = dName.String
	}
	if subName.Valid {
		report.SubmittedByName = subName.String
	}
	if projName.Valid {
		report.ProjectName = projName.String
	}

	s.auditSvc.Log(AuditEntry{
		OrgID: orgID, ProjectID: &projectID, ActorID: &submittedBy,
		Action:     models.AuditCreated,
		EntityType: "daily_report",
		EntityID:   &report.ID,
		EntityName: fmt.Sprintf("Daily Report - %s", reportDate.Format("2006-01-02")),
	})

	go s.notifSvc.NotifyLayer(
		orgID,
		[]models.LayerType{models.LayerOne, models.LayerSuperAdmin, models.LayerTwo},
		models.NotifDailyReportSubmitted,
		"Daily Report Submitted",
		fmt.Sprintf("%s submitted a report for %s", report.DeptName, report.ProjectName),
		&projectID, "daily_report", &report.ID,
	)

	return report, nil
}

// ── GetReport ─────────────────────────────────────────────────────────────────

func (s *DailyReportService) GetReport(id uuid.UUID) (*models.DailyReport, error) {
	report := &models.DailyReport{}
	var taskID, deptName, submittedByName, projName sql.NullString

	err := s.db.QueryRow(`
		SELECT r.id, r.project_id, r.department_id, r.submitted_by, r.task_id, r.description,
		       r.report_date, r.created_at,
		       COALESCE(d.name,'')                              AS dept_name,
		       COALESCE(CONCAT(e.first_name,' ',e.last_name),'') AS submitted_by_name,
		       COALESCE(p.project_name,'')                      AS project_name
		FROM daily_reports r
		LEFT JOIN departments d ON d.id = r.department_id
		LEFT JOIN employees   e ON e.id = r.submitted_by
		LEFT JOIN projects    p ON p.id = r.project_id
		WHERE r.id = $1
	`, id).Scan(
		&report.ID, &report.ProjectID, &report.DepartmentID, &report.SubmittedBy, &taskID,
		&report.Description, &report.ReportDate, &report.CreatedAt,
		&deptName, &submittedByName, &projName,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("report not found")
	}
	if err != nil {
		return nil, err
	}

	if taskID.Valid {
		id, _ := uuid.Parse(taskID.String)
		report.TaskID = &id
	}
	if deptName.Valid {
		report.DeptName = deptName.String
	}
	if submittedByName.Valid {
		report.SubmittedByName = submittedByName.String
	}
	if projName.Valid {
		report.ProjectName = projName.String
	}
	return report, nil
}

// ── ListReports ───────────────────────────────────────────────────────────────

func (s *DailyReportService) ListReports(orgID uuid.UUID, projectID *uuid.UUID, deptID *uuid.UUID, dateFrom, dateTo string, page, pageSize int) ([]models.DailyReport, int, error) {
	conditions := []string{"d.organization_id = $1"}
	args := []interface{}{orgID}
	argIdx := 2

	if projectID != nil {
		conditions = append(conditions, fmt.Sprintf("r.project_id = $%d", argIdx))
		args = append(args, *projectID)
		argIdx++
	}
	if deptID != nil {
		conditions = append(conditions, fmt.Sprintf("r.department_id = $%d", argIdx))
		args = append(args, *deptID)
		argIdx++
	}
	if dateFrom != "" {
		conditions = append(conditions, fmt.Sprintf("r.report_date >= $%d", argIdx))
		args = append(args, dateFrom)
		argIdx++
	}
	if dateTo != "" {
		conditions = append(conditions, fmt.Sprintf("r.report_date <= $%d", argIdx))
		args = append(args, dateTo)
		argIdx++
	}

	where := "WHERE " + joinConditions(conditions, " AND ")

	var total int
	s.db.QueryRow(`
		SELECT COUNT(*) FROM daily_reports r
		LEFT JOIN departments d ON d.id = r.department_id
		`+where, args...).Scan(&total)

	query := fmt.Sprintf(`
		SELECT r.id, r.project_id, r.department_id, r.submitted_by,
		       r.description, r.report_date, r.created_at,
		       COALESCE(d.name,'')                              AS dept_name,
		       COALESCE(CONCAT(e.first_name,' ',e.last_name),'') AS submitted_by_name,
		       COALESCE(p.project_name,'')                      AS project_name
		FROM daily_reports r
		LEFT JOIN departments d ON d.id = r.department_id
		LEFT JOIN employees   e ON e.id = r.submitted_by
		LEFT JOIN projects    p ON p.id = r.project_id
		%s
		ORDER BY r.report_date DESC, r.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, pageSize, (page-1)*pageSize)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var reports []models.DailyReport
	for rows.Next() {
		var r models.DailyReport
		var deptName, submittedByName, projName sql.NullString
		rows.Scan(
			&r.ID, &r.ProjectID, &r.DepartmentID, &r.SubmittedBy,
			&r.Description, &r.ReportDate, &r.CreatedAt,
			&deptName, &submittedByName, &projName,
		)
		if deptName.Valid {
			r.DeptName = deptName.String
		}
		if submittedByName.Valid {
			r.SubmittedByName = submittedByName.String
		}
		if projName.Valid {
			r.ProjectName = projName.String
		}
		reports = append(reports, r)
	}
	return reports, total, nil
}
