package services

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/pms/backend/internal/models"
)

type TaskService struct {
	db         *sql.DB
	auditSvc   *AuditService
	notifSvc   *NotificationService
	routingSvc *RoutingService
}

func NewTaskService(db *sql.DB, audit *AuditService, notif *NotificationService, routing *RoutingService) *TaskService {
	return &TaskService{db: db, auditSvc: audit, notifSvc: notif, routingSvc: routing}
}

// ============================================================
// TASKS
// ============================================================

func (s *TaskService) GetTask(id uuid.UUID) (*models.DepartmentTask, error) {
	var t models.DepartmentTask
	var title, desc sql.NullString
	var startDate, dueDate, startedAt, completedAt sql.NullTime
	var expectedCompletion, routedAt sql.NullTime
	var completionLocked bool
	var deptName, projName sql.NullString

	err := s.db.QueryRow(`
		SELECT t.id, t.project_id, t.routing_id, t.routing_step_id, t.department_id,
		       t.title, t.description, t.priority, t.status,
		       t.start_date, t.due_date, t.dates_frozen, t.started_at, t.completed_at,
		       t.expected_completion_date, t.completion_date_locked, t.routed_to_dept_at,
		       t.created_at, t.updated_at, COALESCE(d.name,'') as dept_name,
		       COALESCE(p.project_name,'') as project_name
		FROM department_tasks t
		LEFT JOIN departments d ON d.id = t.department_id
		LEFT JOIN projects p ON p.id = t.project_id
		WHERE t.id = $1
	`, id).Scan(
		&t.ID, &t.ProjectID, &t.RoutingID, &t.RoutingStepID, &t.DepartmentID,
		&title, &desc, &t.Priority, &t.Status,
		&startDate, &dueDate, &t.DatesFrozen, &startedAt, &completedAt,
		&expectedCompletion, &completionLocked, &routedAt,
		&t.CreatedAt, &t.UpdatedAt, &deptName, &projName,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("task not found")
	}
	if err != nil {
		return nil, err
	}

	if title.Valid {
		t.Title = title.String
	}
	if desc.Valid {
		t.Description = desc.String
	}
	if deptName.Valid {
		t.DepartmentName = deptName.String
	}
	if projName.Valid {
		t.ProjectName = projName.String
	}
	if startDate.Valid {
		t.StartDate = &startDate.Time
	}
	if dueDate.Valid {
		t.DueDate = &dueDate.Time
	}
	if startedAt.Valid {
		t.StartedAt = &startedAt.Time
	}
	if completedAt.Valid {
		t.CompletedAt = &completedAt.Time
	}
	if expectedCompletion.Valid {
		t.ExpectedCompletionDate = &expectedCompletion.Time
	}
	t.CompletionDateLocked = completionLocked
	if routedAt.Valid {
		t.RoutedToDeptAt = &routedAt.Time
	}

	t.AssignedEmployees, _ = s.getTaskEmployees(id)
	t.Subtasks, _ = s.GetSubtasks(id)

	return &t, nil
}

func (s *TaskService) GetProjectTasks(projectID uuid.UUID, deptID *uuid.UUID) ([]models.DepartmentTask, error) {
	query := `
		SELECT t.id, t.project_id, t.routing_id, t.routing_step_id, t.department_id,
		       COALESCE(t.title,''), t.priority, t.status,
		       t.start_date, t.due_date, t.dates_frozen, t.started_at, t.completed_at,
		       t.created_at, t.updated_at, COALESCE(d.name,'') as dept_name
		FROM department_tasks t
		LEFT JOIN departments d ON d.id = t.department_id
		WHERE t.project_id = $1
	`
	args := []interface{}{projectID}
	if deptID != nil {
		query += ` AND t.department_id = $2`
		args = append(args, *deptID)
	}
	query += ` ORDER BY t.created_at`

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []models.DepartmentTask
	for rows.Next() {
		var t models.DepartmentTask
		var startDate, dueDate, startedAt, completedAt sql.NullTime
		rows.Scan(
			&t.ID, &t.ProjectID, &t.RoutingID, &t.RoutingStepID, &t.DepartmentID,
			&t.Title, &t.Priority, &t.Status,
			&startDate, &dueDate, &t.DatesFrozen, &startedAt, &completedAt,
			&t.CreatedAt, &t.UpdatedAt, &t.DepartmentName,
		)
		if startDate.Valid {
			t.StartDate = &startDate.Time
		}
		if dueDate.Valid {
			t.DueDate = &dueDate.Time
		}
		if startedAt.Valid {
			t.StartedAt = &startedAt.Time
		}
		if completedAt.Valid {
			t.CompletedAt = &completedAt.Time
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

type SetTaskDatesRequest struct {
	StartDate string `json:"start_date"`
	DueDate   string `json:"due_date"`
}

func (s *TaskService) SetTaskDates(taskID, actorID uuid.UUID, req SetTaskDatesRequest) (*models.DepartmentTask, error) {
	task, err := s.GetTask(taskID)
	if err != nil {
		return nil, err
	}
	if task.DatesFrozen {
		return nil, errors.New("dates are frozen and cannot be changed")
	}

	var startDate, dueDate interface{}
	if req.StartDate != "" {
		t, err := time.Parse("2006-01-02", req.StartDate)
		if err != nil {
			return nil, errors.New("invalid start_date format")
		}
		startDate = t
	}
	if req.DueDate != "" {
		t, err := time.Parse("2006-01-02", req.DueDate)
		if err != nil {
			return nil, errors.New("invalid due_date format")
		}
		dueDate = t
	}

	_, err = s.db.Exec(`
		UPDATE department_tasks SET start_date = $1, due_date = $2, dates_frozen = TRUE, updated_at = NOW()
		WHERE id = $3
	`, startDate, dueDate, taskID)
	if err != nil {
		return nil, err
	}

	return s.GetTask(taskID)
}

func (s *TaskService) UpdateTaskStatus(orgID, taskID, actorID uuid.UUID, status models.TaskStatus) error {
	task, err := s.GetTask(taskID)
	if err != nil {
		return err
	}

	oldStatus := task.Status

	update := `UPDATE department_tasks SET status = $1, updated_at = NOW()`
	if status == models.TaskInProgress && task.StartedAt == nil {
		update += `, started_at = NOW()`
	}
	if status == models.TaskCompleted {
		update += `, completed_at = NOW()`
	}
	update += ` WHERE id = $2`

	_, err = s.db.Exec(update, status, taskID)
	if err != nil {
		return err
	}

	s.auditSvc.Log(AuditEntry{
		OrgID: orgID, ProjectID: &task.ProjectID, ActorID: &actorID,
		Action: models.AuditStatusChanged, EntityType: "task", EntityID: &taskID,
		EntityName: task.DepartmentName,
		BeforeState: map[string]string{"status": string(oldStatus)},
		AfterState:  map[string]string{"status": string(status)},
	})

	// Notify layer2 of task updates
	go s.notifSvc.NotifyLayer(orgID, []models.LayerType{models.LayerTwo}, models.NotifTaskCompleted,
		"Task Status Updated",
		fmt.Sprintf("Task in %s changed to %s", task.DepartmentName, status),
		&task.ProjectID, "task", &taskID)

	// If completed, evaluate routing gate
	if status == models.TaskCompleted {
		go s.evaluateAndAdvanceRouting(orgID, task, actorID)
	}

	return nil
}

func (s *TaskService) evaluateAndAdvanceRouting(orgID uuid.UUID, task *models.DepartmentTask, actorID uuid.UUID) {
	canAdvance, nextStep, err := s.routingSvc.EvaluateRoutingGate(task.RoutingID, task.RoutingStepID)
	if err != nil || !canAdvance {
		return
	}

	if nextStep == nil {
		// All steps complete — project can be marked complete
		s.notifSvc.NotifyLayer(orgID, []models.LayerType{models.LayerOne, models.LayerSuperAdmin},
			models.NotifTaskCompleted,
			"Project Ready for Completion",
			"All routing steps have been completed",
			&task.ProjectID, "project", &task.ProjectID)
		return
	}

	s.routingSvc.ActivateNextStep(orgID, task.ProjectID, task.RoutingID, nextStep, actorID)
}

func (s *TaskService) AssignEmployees(taskID uuid.UUID, employeeIDs []string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	tx.Exec(`DELETE FROM task_employee_assignments WHERE task_id = $1`, taskID)
	for _, empIDStr := range employeeIDs {
		empID, err := uuid.Parse(empIDStr)
		if err != nil {
			return fmt.Errorf("invalid employee_id: %s", empIDStr)
		}
		tx.Exec(`INSERT INTO task_employee_assignments (task_id, employee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, taskID, empID)
	}
	return tx.Commit()
}

func (s *TaskService) getTaskEmployees(taskID uuid.UUID) ([]models.Employee, error) {
	rows, err := s.db.Query(`
		SELECT e.id, e.first_name, e.last_name, e.email, e.layer, COALESCE(d.name,'')
		FROM employees e
		JOIN task_employee_assignments tea ON tea.employee_id = e.id
		LEFT JOIN departments d ON d.id = e.department_id
		WHERE tea.task_id = $1
	`, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var employees []models.Employee
	for rows.Next() {
		var e models.Employee
		rows.Scan(&e.ID, &e.FirstName, &e.LastName, &e.Email, &e.Layer, &e.DepartmentName)
		e.FullName = e.FirstName + " " + e.LastName
		employees = append(employees, e)
	}
	return employees, nil
}

// ============================================================
// SUBTASKS
// ============================================================

type CreateSubtaskRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	IsRequired  bool   `json:"is_required"`
	AssignedTo  string `json:"assigned_to"`
	SortOrder   int    `json:"sort_order"`
}

func (s *TaskService) CreateSubtask(taskID uuid.UUID, req CreateSubtaskRequest) (*models.Subtask, error) {
	st := &models.Subtask{}
	var assignedTo interface{}
	if req.AssignedTo != "" {
		id, err := uuid.Parse(req.AssignedTo)
		if err != nil {
			return nil, errors.New("invalid assigned_to")
		}
		assignedTo = id
	}

	var assigneeID, stDesc, stNotes sql.NullString
	err := s.db.QueryRow(`
		INSERT INTO subtasks (task_id, title, description, is_required, assigned_to, sort_order)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id, task_id, title, description, is_required, status, assigned_to, notes, sort_order, created_at, updated_at
	`, taskID, req.Title, nullStr(req.Description), req.IsRequired, assignedTo, req.SortOrder).Scan(
		&st.ID, &st.TaskID, &st.Title, &stDesc, &st.IsRequired,
		&st.Status, &assigneeID, &stNotes, &st.SortOrder, &st.CreatedAt, &st.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create subtask: %w", err)
	}
	if assigneeID.Valid {
		id, _ := uuid.Parse(assigneeID.String)
		st.AssignedTo = &id
	}
	if stDesc.Valid {
		st.Description = stDesc.String
	}
	if stNotes.Valid {
		st.Notes = stNotes.String
	}
	if req.IsRequired {
		_, err = s.db.Exec(`
			UPDATE department_tasks
			SET status = 'in_progress',
				completed_at = NULL,
				updated_at = NOW()
			WHERE id = $1
			AND status = 'completed'
		`, taskID)

		if err != nil {
			return nil, err
		}
	}
	return st, nil
}

func (s *TaskService) GetSubtasks(taskID uuid.UUID) ([]models.Subtask, error) {
	rows, err := s.db.Query(`
		SELECT st.id, st.task_id, st.title, COALESCE(st.description,''), st.is_required,
		       st.status, st.assigned_to, COALESCE(st.notes,''), st.sort_order,
		       st.completed_at, st.completed_by, st.created_at, st.updated_at,
		       COALESCE(CONCAT(e.first_name,' ',e.last_name),'') as assignee_name
		FROM subtasks st
		LEFT JOIN employees e ON e.id = st.assigned_to
		WHERE st.task_id = $1
		ORDER BY st.sort_order, st.created_at
	`, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subtasks []models.Subtask
	for rows.Next() {
		var st models.Subtask
		var assignedTo, completedBy sql.NullString
		var completedAt sql.NullTime

		rows.Scan(
			&st.ID, &st.TaskID, &st.Title, &st.Description, &st.IsRequired,
			&st.Status, &assignedTo, &st.Notes, &st.SortOrder,
			&completedAt, &completedBy, &st.CreatedAt, &st.UpdatedAt,
			&st.AssigneeName,
		)
		if assignedTo.Valid {
			id, _ := uuid.Parse(assignedTo.String)
			st.AssignedTo = &id
		}
		if completedBy.Valid {
			id, _ := uuid.Parse(completedBy.String)
			st.CompletedBy = &id
		}
		if completedAt.Valid {
			st.CompletedAt = &completedAt.Time
		}
		subtasks = append(subtasks, st)
	}
	return subtasks, nil
}

func (s *TaskService) CompleteSubtask(orgID, subtaskID, completedBy uuid.UUID, notes string) error {
	var taskID uuid.UUID
	err := s.db.QueryRow(`SELECT task_id FROM subtasks WHERE id = $1`, subtaskID).Scan(&taskID)
	if err != nil {
		return errors.New("subtask not found")
	}

	_, err = s.db.Exec(`
		UPDATE subtasks SET status = 'completed', completed_by = $1, completed_at = NOW(), notes = $2, updated_at = NOW()
		WHERE id = $3
	`, completedBy, nullStr(notes), subtaskID)
	if err != nil {
		return err
	}

	// Get task info for notification
	task, err := s.GetTask(taskID)
	if err == nil {
		go s.notifSvc.NotifyLayer(orgID, []models.LayerType{models.LayerTwo}, models.NotifSubtaskCompleted,
			"Subtask Completed",
			fmt.Sprintf("A subtask was completed in %s", task.DepartmentName),
			&task.ProjectID, "subtask", &subtaskID)

		// Auto-advance task: if all required subtasks are complete, mark task complete
		go s.checkAndAutoCompleteTask(orgID, taskID, completedBy)
	}

	return nil
}

// checkAndAutoCompleteTask marks the task completed if all required subtasks are done.
func (s *TaskService) checkAndAutoCompleteTask(orgID, taskID, actorID uuid.UUID) {
	var total, completed int
	s.db.QueryRow(`SELECT COUNT(*) FROM subtasks WHERE task_id = $1 AND is_required = TRUE`, taskID).Scan(&total)
	if total == 0 {
		return // no required subtasks — do not auto-complete
	}
	s.db.QueryRow(`SELECT COUNT(*) FROM subtasks WHERE task_id = $1 AND is_required = TRUE AND status = 'completed'`, taskID).Scan(&completed)
	if completed < total {
		return
	}
	// All required subtasks done — auto-complete task
	s.UpdateTaskStatus(orgID, taskID, actorID, models.TaskCompleted)
}

// SetExpectedCompletionDate sets the expected completion date and locks it.
// Also transitions task to in_progress automatically.
func (s *TaskService) SetExpectedCompletionDate(orgID, taskID, actorID uuid.UUID, dateStr string) (*models.DepartmentTask, error) {
	task, err := s.GetTask(taskID)
	if err != nil {
		return nil, err
	}
	if task.CompletionDateLocked {
		return nil, errors.New("expected completion date is locked and cannot be changed")
	}

	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return nil, errors.New("invalid date format, use YYYY-MM-DD")
	}

	_, err = s.db.Exec(`
		UPDATE department_tasks
		SET expected_completion_date = $1, completion_date_locked = TRUE,
		    status = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END,
		    started_at = CASE WHEN started_at IS NULL THEN NOW() ELSE started_at END,
		    updated_at = NOW()
		WHERE id = $2
	`, t, taskID)
	if err != nil {
		return nil, err
	}

	s.auditSvc.Log(AuditEntry{
		OrgID: orgID, ProjectID: &task.ProjectID, ActorID: &actorID,
		Action: models.AuditUpdated, EntityType: "task", EntityID: &taskID,
		EntityName: task.DepartmentName,
		AfterState: map[string]string{"expected_completion_date": dateStr},
	})

	return s.GetTask(taskID)
}

func (s *TaskService) UpdateSubtask(subtaskID uuid.UUID, title, description, notes string, assignedTo *uuid.UUID) error {
	_, err := s.db.Exec(`
		UPDATE subtasks SET title = $1, description = $2, notes = $3, assigned_to = $4, updated_at = NOW()
		WHERE id = $5
	`, title, nullStr(description), nullStr(notes), assignedTo, subtaskID)
	return err
}

func (s *TaskService) GetDepartmentTasks(deptID uuid.UUID, status string, page, pageSize int) ([]models.DepartmentTask, int, error) {
	conditions := []string{"t.department_id = $1"}
	args := []interface{}{deptID}
	argIdx := 2

	if status != "" {
		conditions = append(conditions, fmt.Sprintf("t.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	where := "WHERE " + joinConditions(conditions, " AND ")

	var total int
	s.db.QueryRow(`SELECT COUNT(*) FROM department_tasks t `+where, args...).Scan(&total)

	query := fmt.Sprintf(`
		SELECT t.id, t.project_id, t.routing_id, t.routing_step_id, t.department_id,
		       COALESCE(t.title,''), t.priority, t.status,
		       t.start_date, t.due_date, t.dates_frozen, t.started_at, t.completed_at,
		       t.created_at, t.updated_at,
		       COALESCE(p.project_name,'') as project_name
		FROM department_tasks t
		LEFT JOIN projects p ON p.id = t.project_id
		%s
		ORDER BY t.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, pageSize, (page-1)*pageSize)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var tasks []models.DepartmentTask
	for rows.Next() {
		var t models.DepartmentTask
		var startDate, dueDate, startedAt, completedAt sql.NullTime
		var projName sql.NullString

		rows.Scan(
			&t.ID, &t.ProjectID, &t.RoutingID, &t.RoutingStepID, &t.DepartmentID,
			&t.Title, &t.Priority, &t.Status,
			&startDate, &dueDate, &t.DatesFrozen, &startedAt, &completedAt,
			&t.CreatedAt, &t.UpdatedAt, &projName,
		)
		if startDate.Valid {
			t.StartDate = &startDate.Time
		}
		if dueDate.Valid {
			t.DueDate = &dueDate.Time
		}
		if projName.Valid {
			t.Title = projName.String
		}
		tasks = append(tasks, t)
	}
	return tasks, total, nil
}

func (s *TaskService) GetOverdueTasks(orgID uuid.UUID) ([]models.DepartmentTask, error) {
	query := `
		SELECT t.id, t.project_id, t.department_id, COALESCE(t.title,''), t.status, t.due_date,
		       COALESCE(d.name,'') as dept_name, COALESCE(p.project_name,'') as project_name
		FROM department_tasks t
		LEFT JOIN departments d ON d.id = t.department_id
		LEFT JOIN projects p ON p.id = t.project_id
		WHERE t.due_date < NOW() AND t.status NOT IN ('completed')
	`
	args := []interface{}{}

	// Filter by org if provided
	if orgID != uuid.Nil {
		query += ` AND d.organization_id = $1`
		args = append(args, orgID)
	}
	query += ` ORDER BY t.due_date LIMIT 200`

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []models.DepartmentTask
	for rows.Next() {
		var t models.DepartmentTask
		var dueDate sql.NullTime
		var deptName, projName sql.NullString

		rows.Scan(&t.ID, &t.ProjectID, &t.DepartmentID, &t.Title, &t.Status, &dueDate, &deptName, &projName)
		if dueDate.Valid {
			t.DueDate = &dueDate.Time
		}
		if deptName.Valid {
			t.DepartmentName = deptName.String
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}
