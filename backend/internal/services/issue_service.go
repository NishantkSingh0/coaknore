package services

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/pms/backend/internal/models"
)

type IssueService struct {
	db       *sql.DB
	auditSvc *AuditService
	notifSvc *NotificationService
}

func NewIssueService(db *sql.DB, audit *AuditService, notif *NotificationService) *IssueService {
	return &IssueService{db: db, auditSvc: audit, notifSvc: notif}
}

type CreateIssueRequest struct {
	TaskID           string           `json:"task_id"`
	Type             models.IssueType `json:"type"`
	Title            string           `json:"title"`
	Description      string           `json:"description"`
	AssignedToDeptID string           `json:"assigned_to_dept_id"`
	// Material Missing specific fields
	MaterialName        string  `json:"material_name"`
	MaterialDescription string  `json:"material_description"`
	RequiredQuantity    float64 `json:"required_quantity"`
	MaterialUnit        string  `json:"material_unit"`
	MaterialRemarks     string  `json:"material_remarks"`
}

func (s *IssueService) RaiseIssue(orgID, projectID, deptID, raisedBy uuid.UUID, req CreateIssueRequest) (*models.Issue, error) {
	if req.Title == "" {
		return nil, errors.New("title is required")
	}
	if req.Description == "" {
		return nil, errors.New("description is required")
	}

	var taskID interface{}
	if req.TaskID != "" {
		id, err := uuid.Parse(req.TaskID)
		if err != nil {
			return nil, errors.New("invalid task_id")
		}
		taskID = id

		// Check if task belongs to a superseded routing
		var routingIsLatest bool
		s.db.QueryRow(`
			SELECT COALESCE(r.is_latest, TRUE) as routing_is_latest
			FROM department_tasks t
			LEFT JOIN routings r ON r.id = t.routing_id
			WHERE t.id = $1
		`, id).Scan(&routingIsLatest)
		
		if !routingIsLatest {
			return nil, errors.New("cannot raise issues for tasks from superseded routing versions")
		}

		// Set task to issue_hold
		s.db.Exec(`UPDATE department_tasks SET status = 'issue_hold', updated_at = NOW() WHERE id = $1`, id)
	}

	var assignedDeptID interface{}
	if req.AssignedToDeptID != "" {
		id, err := uuid.Parse(req.AssignedToDeptID)
		if err != nil {
			return nil, errors.New("invalid assigned_to_dept_id")
		}
		assignedDeptID = id
	}

	issue := &models.Issue{}
	var issueTaskID, issueAssignedDept sql.NullString

	err := s.db.QueryRow(`
		INSERT INTO issues (project_id, task_id, department_id, raised_by, type, title, description,
		                    assigned_to_dept, status,
		                    material_name, material_description, required_quantity, material_unit, material_remarks)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open',$9,$10,$11,$12,$13)
		RETURNING id, project_id, task_id, department_id, raised_by, type, title, description,
		          status, assigned_to_dept,
		          COALESCE(material_name,''), COALESCE(material_description,''), COALESCE(required_quantity,0),
		          COALESCE(material_unit,''), COALESCE(material_remarks,''),
		          created_at, updated_at
	`, projectID, taskID, deptID, raisedBy, req.Type, req.Title, req.Description, assignedDeptID,
		nullStr(req.MaterialName), nullStr(req.MaterialDescription), nullFloat64(req.RequiredQuantity),
		nullStr(req.MaterialUnit), nullStr(req.MaterialRemarks),
	).Scan(
		&issue.ID, &issue.ProjectID, &issueTaskID, &issue.DepartmentID, &issue.RaisedBy,
		&issue.Type, &issue.Title, &issue.Description,
		&issue.Status, &issueAssignedDept,
		&issue.MaterialName, &issue.MaterialDescription, &issue.RequiredQuantity,
		&issue.MaterialUnit, &issue.MaterialRemarks,
		&issue.CreatedAt, &issue.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to raise issue: %w", err)
	}

	if issueTaskID.Valid {
		id, _ := uuid.Parse(issueTaskID.String)
		issue.TaskID = &id
	}
	if issueAssignedDept.Valid {
		id, _ := uuid.Parse(issueAssignedDept.String)
		issue.AssignedToDeptID = &id
	}

	// Audit
	s.auditSvc.Log(AuditEntry{
		OrgID: orgID, ProjectID: &projectID, ActorID: &raisedBy,
		Action: models.AuditCreated, EntityType: "issue", EntityID: &issue.ID, EntityName: issue.Title,
	})

	// Notify both upper levels when any issue is raised.
	go s.notifSvc.NotifyLayer(orgID, upperIssueLayers(), models.NotifIssueRaised,
		"Issue Raised",
		fmt.Sprintf("New issue: %s (%s)", issue.Title, issue.Type),
		&projectID, "issue", &issue.ID)

	return issue, nil
}

func (s *IssueService) ReviewIssue(orgID, issueID, reviewerID uuid.UUID, approve bool, notes string) error {
	var projectID uuid.UUID
	var taskID sql.NullString
	var currentStatus models.IssueStatus

	err := s.db.QueryRow(`SELECT project_id, task_id, status FROM issues WHERE id = $1`, issueID).Scan(
		&projectID, &taskID, &currentStatus,
	)
	if err != nil {
		return errors.New("issue not found")
	}

	if currentStatus != models.IssueOpen && currentStatus != models.IssuePendingApproval {
		return errors.New("issue cannot be reviewed in its current state")
	}

	newStatus := models.IssueApproved
	notifType := models.NotifIssueApproved
	if !approve {
		newStatus = models.IssueRejected
		notifType = models.NotifIssueRejected
	}

	_, err = s.db.Exec(`
		UPDATE issues SET status = $1, reviewed_by = $2, review_notes = $3, reviewed_at = NOW(), updated_at = NOW()
		WHERE id = $4
	`, newStatus, reviewerID, nullStr(notes), issueID)
	if err != nil {
		return err
	}

	// If rejected and task was on issue_hold, revert to in_progress
	if !approve && taskID.Valid {
		s.db.Exec(`
			UPDATE department_tasks SET status = 'in_progress', updated_at = NOW() WHERE id = $1
		`, taskID.String)
	}

	// Get the issue raiser to notify them
	var raisedBy uuid.UUID
	s.db.QueryRow(`SELECT raised_by FROM issues WHERE id = $1`, issueID).Scan(&raisedBy)

	var issueTitle, reviewerName string
	s.db.QueryRow(`SELECT title FROM issues WHERE id = $1`, issueID).Scan(&issueTitle)
	s.db.QueryRow(`SELECT CONCAT(first_name,' ',last_name) FROM employees WHERE id = $1`, reviewerID).Scan(&reviewerName)

	action := "Approved"
	if !approve {
		action = "Rejected"
	}
	go s.notifSvc.Send(orgID, raisedBy, notifType,
		fmt.Sprintf("Issue %s", action),
		fmt.Sprintf("Your issue '%s' has been %s by %s", issueTitle, action, reviewerName),
		&projectID, "issue", &issueID)
	go s.notifSvc.NotifyLayer(orgID, upperIssueLayers(), notifType,
		fmt.Sprintf("Issue %s", action),
		fmt.Sprintf("Issue '%s' was %s by %s", issueTitle, action, reviewerName),
		&projectID, "issue", &issueID)

	s.auditSvc.Log(AuditEntry{
		OrgID: orgID, ProjectID: &projectID, ActorID: &reviewerID,
		Action: func() models.AuditAction {
			if approve {
				return models.AuditApproved
			}
			return models.AuditRejected
		}(),
		EntityType: "issue", EntityID: &issueID, EntityName: issueTitle,
	})

	return nil
}

func (s *IssueService) ResolveIssue(orgID, issueID, resolvedBy uuid.UUID, resolutionNotes string) error {
	var projectID uuid.UUID
	var taskID sql.NullString
	var currentStatus models.IssueStatus

	err := s.db.QueryRow(`SELECT project_id, task_id, status FROM issues WHERE id = $1`, issueID).Scan(
		&projectID, &taskID, &currentStatus,
	)
	if err != nil {
		return errors.New("issue not found")
	}

	if currentStatus != models.IssueApproved {
		return errors.New("only approved issues can be resolved")
	}

	_, err = s.db.Exec(`
		UPDATE issues SET status = 'resolved', resolved_by = $1, resolved_at = NOW(),
		       resolution_notes = $2, updated_at = NOW()
		WHERE id = $3
	`, resolvedBy, nullStr(resolutionNotes), issueID)
	if err != nil {
		return err
	}

	// Revert task to in_progress
	if taskID.Valid {
		s.db.Exec(`UPDATE department_tasks SET status = 'in_progress', updated_at = NOW() WHERE id = $1`, taskID.String)
	}

	// Close the issue
	s.db.Exec(`UPDATE issues SET status = 'closed', updated_at = NOW() WHERE id = $1`, issueID)

	var issueTitle, resolverName string
	s.db.QueryRow(`SELECT title FROM issues WHERE id = $1`, issueID).Scan(&issueTitle)
	s.db.QueryRow(`SELECT CONCAT(first_name,' ',last_name) FROM employees WHERE id = $1`, resolvedBy).Scan(&resolverName)

	go s.notifSvc.NotifyLayer(orgID, upperIssueLayers(), models.NotifIssueClosed,
		"Issue Resolved & Closed",
		fmt.Sprintf("Issue '%s' has been resolved by %s", issueTitle, resolverName),
		&projectID, "issue", &issueID)

	s.auditSvc.Log(AuditEntry{
		OrgID: orgID, ProjectID: &projectID, ActorID: &resolvedBy,
		Action: models.AuditResolved, EntityType: "issue", EntityID: &issueID, EntityName: issueTitle,
	})

	return nil
}

func (s *IssueService) GetIssue(id uuid.UUID) (*models.Issue, error) {
	issue := &models.Issue{}
	var (
		taskID, assignedDept, reviewedBy, resolvedBy sql.NullString
		reviewedAt, resolvedAt                       sql.NullTime
		reviewNotes, resolutionNotes                 sql.NullString
		deptName, assignedDeptName, raisedByName     sql.NullString
		reviewedByName, resolvedByName               sql.NullString
	)

	err := s.db.QueryRow(`
		SELECT i.id, i.project_id, i.task_id, i.department_id, i.raised_by, i.type, i.title, i.description,
		       i.status, i.assigned_to_dept, i.reviewed_by, i.review_notes, i.reviewed_at,
		       i.resolved_by, i.resolved_at, i.resolution_notes, i.created_at, i.updated_at,
		       COALESCE(d.name,'') as dept_name,
		       COALESCE(ad.name,'') as assigned_dept_name,
		       COALESCE(CONCAT(re.first_name,' ',re.last_name),'') as raised_by_name,
		       COALESCE(CONCAT(rv.first_name,' ',rv.last_name),'') as reviewed_by_name,
		       COALESCE(CONCAT(rs.first_name,' ',rs.last_name),'') as resolved_by_name,
		       COALESCE(i.material_name,''), COALESCE(i.material_description,''),
		       COALESCE(i.required_quantity,0), COALESCE(i.material_unit,''), COALESCE(i.material_remarks,'')
		FROM issues i
		LEFT JOIN departments d ON d.id = i.department_id
		LEFT JOIN departments ad ON ad.id = i.assigned_to_dept
		LEFT JOIN employees re ON re.id = i.raised_by
		LEFT JOIN employees rv ON rv.id = i.reviewed_by
		LEFT JOIN employees rs ON rs.id = i.resolved_by
		WHERE i.id = $1
	`, id).Scan(
		&issue.ID, &issue.ProjectID, &taskID, &issue.DepartmentID, &issue.RaisedBy,
		&issue.Type, &issue.Title, &issue.Description,
		&issue.Status, &assignedDept, &reviewedBy, &reviewNotes, &reviewedAt,
		&resolvedBy, &resolvedAt, &resolutionNotes, &issue.CreatedAt, &issue.UpdatedAt,
		&deptName, &assignedDeptName, &raisedByName, &reviewedByName, &resolvedByName,
		&issue.MaterialName, &issue.MaterialDescription, &issue.RequiredQuantity,
		&issue.MaterialUnit, &issue.MaterialRemarks,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("issue not found")
	}
	if err != nil {
		return nil, err
	}

	if taskID.Valid {
		id, _ := uuid.Parse(taskID.String)
		issue.TaskID = &id
	}
	if assignedDept.Valid {
		id, _ := uuid.Parse(assignedDept.String)
		issue.AssignedToDeptID = &id
	}
	if reviewedBy.Valid {
		id, _ := uuid.Parse(reviewedBy.String)
		issue.ReviewedBy = &id
	}
	if resolvedBy.Valid {
		id, _ := uuid.Parse(resolvedBy.String)
		issue.ResolvedBy = &id
	}
	if reviewedAt.Valid {
		issue.ReviewedAt = &reviewedAt.Time
	}
	if resolvedAt.Valid {
		issue.ResolvedAt = &resolvedAt.Time
	}
	if reviewNotes.Valid {
		issue.ReviewNotes = reviewNotes.String
	}
	if resolutionNotes.Valid {
		issue.ResolutionNotes = resolutionNotes.String
	}
	if deptName.Valid {
		issue.DepartmentName = deptName.String
	}
	if assignedDeptName.Valid {
		issue.AssignedToDept = assignedDeptName.String
	}
	if raisedByName.Valid {
		issue.RaisedByName = raisedByName.String
	}
	if reviewedByName.Valid {
		issue.ReviewedByName = reviewedByName.String
	}
	if resolvedByName.Valid {
		issue.ResolvedByName = resolvedByName.String
	}

	return issue, nil
}

func (s *IssueService) ListIssues(orgID uuid.UUID, projectID *uuid.UUID, deptID *uuid.UUID, status string, page, pageSize int) ([]models.Issue, int, error) {
	conditions := []string{"d.organization_id = $1"}
	args := []interface{}{orgID}
	argIdx := 2

	if projectID != nil {
		conditions = append(conditions, fmt.Sprintf("i.project_id = $%d", argIdx))
		args = append(args, *projectID)
		argIdx++
	}
	if deptID != nil {
		conditions = append(conditions, fmt.Sprintf("i.department_id = $%d", argIdx))
		args = append(args, *deptID)
		argIdx++
	}
	if status != "" {
		conditions = append(conditions, fmt.Sprintf("i.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	where := "WHERE " + joinConditions(conditions, " AND ")

	var total int
	s.db.QueryRow(`
		SELECT COUNT(*) FROM issues i LEFT JOIN departments d ON d.id = i.department_id `+where, args...,
	).Scan(&total)

	query := fmt.Sprintf(`
		SELECT i.id, i.project_id, i.department_id, i.raised_by, i.type, i.title, i.status,
		       i.created_at, i.updated_at,
		       COALESCE(d.name,'') as dept_name,
		       COALESCE(CONCAT(e.first_name,' ',e.last_name),'') as raised_by_name,
		       COALESCE(p.project_name,'') as project_name
		FROM issues i
		LEFT JOIN departments d ON d.id = i.department_id
		LEFT JOIN employees e ON e.id = i.raised_by
		LEFT JOIN projects p ON p.id = i.project_id
		%s
		ORDER BY i.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, pageSize, (page-1)*pageSize)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var issues []models.Issue
	for rows.Next() {
		var i models.Issue
		var deptName, raisedByName, projName sql.NullString
		rows.Scan(
			&i.ID, &i.ProjectID, &i.DepartmentID, &i.RaisedBy, &i.Type, &i.Title, &i.Status,
			&i.CreatedAt, &i.UpdatedAt,
			&deptName, &raisedByName, &projName,
		)
		if deptName.Valid {
			i.DepartmentName = deptName.String
		}
		if raisedByName.Valid {
			i.RaisedByName = raisedByName.String
		}
		issues = append(issues, i)
	}
	return issues, total, nil
}

func upperIssueLayers() []models.LayerType {
	return []models.LayerType{models.LayerOne, models.LayerSuperAdmin, models.LayerTwo}
}
