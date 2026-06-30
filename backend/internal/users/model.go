package users

import "time"

// User is the full DB model.
type User struct {
	ID           string     `db:"id"            json:"id"`
	Name         string     `db:"name"          json:"name"`
	Email        string     `db:"email"         json:"email"`
	Phone        *string    `db:"phone"         json:"phone"`
	Role         string     `db:"role"          json:"role"`
	DepartmentID *string    `db:"department_id" json:"department_id"`
	IsActive     bool       `db:"is_active"     json:"is_active"`
	LastLoginAt  *time.Time `db:"last_login_at" json:"last_login_at"`
	Addon        *string    `db:"addon"         json:"addon"`
	AvatarURL    *string    `db:"-"             json:"avatar_url"`
	CreatedAt    time.Time  `db:"created_at"    json:"created_at"`
	UpdatedAt    time.Time  `db:"updated_at"    json:"updated_at"`
	DeletedAt    *time.Time `db:"deleted_at"    json:"-"`
}

// CreateUserRequest is the validated input for creating a user.
type CreateUserRequest struct {
	Name         string  `json:"name"          validate:"required,min=2,max=100"`
	Email        string  `json:"email"         validate:"required,email"`
	Password     string  `json:"password"      validate:"required,min=8"`
	Phone        *string `json:"phone"`
	Role         string  `json:"role"          validate:"required,oneof=admin layer2 layer3"`
	DepartmentID *string `json:"department_id"`
	Addon        *string `json:"addon"`
}

// UpdateUserRequest is the validated input for updating a user.
type UpdateUserRequest struct {
	Name         *string `json:"name"`
	Phone        *string `json:"phone"`
	DepartmentID *string `json:"department_id"`
	IsActive     *bool   `json:"is_active"`
	Addon        *string `json:"addon"`
}

type ResetPasswordRequest struct {
	NewPassword string `json:"new_password" validate:"required,min=8"`
}
