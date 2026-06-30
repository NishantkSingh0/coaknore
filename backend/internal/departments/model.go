package departments

import "time"

type Department struct {
	ID          string     `db:"id"          json:"id"`
	Name        string     `db:"name"         json:"name"`
	Layer       int        `db:"layer"        json:"layer"`
	Description *string    `db:"description"  json:"description"`
	IsActive    bool       `db:"is_active"    json:"is_active"`
	Addon       *string    `db:"addon"        json:"addon"`
	CreatedAt   time.Time  `db:"created_at"   json:"created_at"`
	UpdatedAt   time.Time  `db:"updated_at"   json:"updated_at"`
	DeletedAt   *time.Time `db:"deleted_at"   json:"-"`
}

type CreateRequest struct {
	Name        string  `json:"name"        validate:"required,min=2,max=100"`
	Layer       int     `json:"layer"       validate:"required,oneof=2 3"`
	Description *string `json:"description"`
	Addon       *string `json:"addon"`
}

type UpdateRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	IsActive    *bool   `json:"is_active"`
	Addon       *string `json:"addon"`
}
