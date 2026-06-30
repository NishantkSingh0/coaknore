package issues

import "time"

type Issue struct {
	ID               string     `db:"id"                  json:"id"`
	ProjectID        string     `db:"project_id"          json:"project_id"`
	TaskID           *string    `db:"task_id"             json:"task_id"`
	RaisedByDeptID   string     `db:"raised_by_dept_id"   json:"raised_by_dept_id"`
	RaisedByUserID   string     `db:"raised_by_user_id"   json:"raised_by_user_id"`
	IssueType        string     `db:"issue_type"          json:"issue_type"`
	Status           string     `db:"status"              json:"status"`
	Description      *string    `db:"description"         json:"description"`
	ApprovedByUserID *string    `db:"approved_by_user_id" json:"approved_by_user_id"`
	ApprovedAt       *time.Time `db:"approved_at"         json:"approved_at"`
	ClosedAt         *time.Time `db:"closed_at"           json:"closed_at"`
	Addon            *string    `db:"addon"               json:"addon"`
	CreatedAt        time.Time  `db:"created_at"          json:"created_at"`
	UpdatedAt        time.Time  `db:"updated_at"          json:"updated_at"`
}

type CreateRequest struct {
	ProjectID   string  `json:"project_id"   validate:"required"`
	TaskID      *string `json:"task_id"`
	IssueType   string  `json:"issue_type"   validate:"required,oneof=item_missing design_change routing_required fullscale_required rework_required"`
	Description *string `json:"description"`
	Addon       *string `json:"addon"`
}

// MaterialItem is a single line in the material requisition.
type MaterialItem struct {
	MaterialName        string  `json:"material_name"        validate:"required"`
	MaterialDescription *string `json:"material_description"`
	QuantityRequired    float64 `json:"quantity_required"    validate:"required,gt=0"`
	Unit                *string `json:"unit"`
}

type MaterialRequisitionRequest struct {
	Department  string         `json:"department"   validate:"required"`
	RequestDate string         `json:"request_date" validate:"required"`
	Items       []MaterialItem `json:"items"        validate:"required,min=1,dive"`
}

type ReworkRequest struct {
	Description string `json:"description" validate:"required"`
}
