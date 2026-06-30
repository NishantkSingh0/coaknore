package tasks

import "time"

type Task struct {
	ID               string     `db:"id"                   json:"id"`
	RoutingID        string     `db:"routing_id"           json:"routing_id"`
	ProjectID        string     `db:"project_id"           json:"project_id"`
	DepartmentID     string     `db:"department_id"        json:"department_id"`
	AssignedToUserID *string    `db:"assigned_to_user_id"  json:"assigned_to_user_id"`
	StartDate        *time.Time `db:"start_date"           json:"start_date"`
	DueDate          *time.Time `db:"due_date"             json:"due_date"`
	Status           string     `db:"status"               json:"status"`
	CompletedAt      *time.Time `db:"completed_at"         json:"completed_at"`
	IsOverdue        bool       `db:"is_overdue"           json:"is_overdue"` // computed in query: due_date < CURRENT_DATE AND status != 'completed'
	Addon            *string    `db:"addon"                json:"addon"`
	CreatedAt        time.Time  `db:"created_at"           json:"created_at"`
	UpdatedAt        time.Time  `db:"updated_at"           json:"updated_at"`
	// Joined fields
	ProjectName    string `db:"project_name"    json:"project_name"`
	PONumber       string `db:"po_number"       json:"po_number"`
	DeptName       string `db:"dept_name"       json:"dept_name"`
	SequenceOrder  int    `db:"sequence_order"  json:"sequence_order"`
}

type UpdateRequest struct {
	StartDate        *string `json:"start_date"`
	DueDate          *string `json:"due_date"`
	Status           *string `json:"status" validate:"omitempty,oneof=pending in_progress hold issue_hold completed"`
	AssignedToUserID *string `json:"assigned_to_user_id"`
	Addon            *string `json:"addon"`
}
