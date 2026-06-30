package users

import (
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
)

type Repository struct{ db *sqlx.DB }

func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) List() ([]User, error) {
	var users []User
	err := r.db.Select(&users, `
		SELECT id, name, email, phone, role, department_id::text, is_active, last_login_at, addon, created_at, updated_at, deleted_at
		FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC`)
	return users, err
}

func (r *Repository) GetByID(id string) (*User, error) {
	var u User
	err := r.db.Get(&u, `
		SELECT id, name, email, phone, role, department_id::text, is_active, last_login_at, addon, created_at, updated_at, deleted_at
		FROM users WHERE id=$1 AND deleted_at IS NULL`, id)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) Create(u *User) error {
	return r.db.QueryRowx(`
		INSERT INTO users (name, email, password_hash, phone, role, department_id, is_active, addon)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at`,
		u.Name, u.Email, u.Phone, u.Phone, u.Role, u.DepartmentID, true, u.Addon,
	).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
}

func (r *Repository) CreateFull(name, email, hash string, phone *string, role string, deptID *string, addon *string) (*User, error) {
	var u User
	err := r.db.QueryRowx(`
		INSERT INTO users (name, email, password_hash, phone, role, department_id, is_active, addon)
		VALUES ($1, $2, $3, $4, $5, $6, true, $7)
		RETURNING id, name, email, phone, role, department_id::text, is_active, last_login_at, addon, created_at, updated_at`,
		name, email, hash, phone, role, deptID, addon,
	).StructScan(&u)
	return &u, err
}

func (r *Repository) Update(id string, req *UpdateUserRequest) (*User, error) {
	query := `UPDATE users SET updated_at=NOW()`
	args := []interface{}{}
	i := 1

	if req.Name != nil {
		query += fmt.Sprintf(", name=$%d", i)
		args = append(args, *req.Name)
		i++
	}
	if req.Phone != nil {
		query += fmt.Sprintf(", phone=$%d", i)
		args = append(args, *req.Phone)
		i++
	}
	if req.DepartmentID != nil {
		query += fmt.Sprintf(", department_id=$%d", i)
		args = append(args, *req.DepartmentID)
		i++
	}
	if req.IsActive != nil {
		query += fmt.Sprintf(", is_active=$%d", i)
		args = append(args, *req.IsActive)
		i++
	}
	if req.Addon != nil {
		query += fmt.Sprintf(", addon=$%d", i)
		args = append(args, *req.Addon)
		i++
	}

	query += fmt.Sprintf(" WHERE id=$%d::uuid AND deleted_at IS NULL RETURNING id, name, email, phone, role, department_id::text, is_active, last_login_at, addon, created_at, updated_at", i)
	args = append(args, id)

	var u User
	err := r.db.QueryRowx(query, args...).StructScan(&u)
	return &u, err
}

func (r *Repository) ResetPassword(id, passwordHash string) error {
	_, err := r.db.Exec(`UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2::uuid AND deleted_at IS NULL`, passwordHash, id)
	return err
}

func (r *Repository) SoftDelete(id string) error {
	_, err := r.db.Exec(`UPDATE users SET deleted_at=$1, updated_at=$1 WHERE id=$2`, time.Now(), id)
	return err
}

// HardDelete permanently removes a user and cleans up or nulls all FK references.
func (r *Repository) HardDelete(id string) error {
	tx, err := r.db.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	nullRefs := []string{
		`UPDATE projects SET created_by = NULL WHERE created_by = $1`,
		`UPDATE project_department_routing SET set_by_user_id = NULL WHERE set_by_user_id = $1`,
		`UPDATE project_department_tasks SET assigned_to_user_id = NULL WHERE assigned_to_user_id = $1`,
		`UPDATE issues SET approved_by_user_id = NULL WHERE approved_by_user_id = $1`,
		`UPDATE material_requisitions SET approved_by = NULL WHERE approved_by = $1`,
		`UPDATE rework_requests SET approved_by = NULL WHERE approved_by = $1`,
	}
	for _, q := range nullRefs {
		if _, err := tx.Exec(q, id); err != nil {
			return err
		}
	}

	deleteDeps := []string{
		`DELETE FROM attendance WHERE user_id = $1`,
		`DELETE FROM daily_reports WHERE submitted_by = $1`,
		`DELETE FROM issues WHERE raised_by_user_id = $1`,
	}
	for _, q := range deleteDeps {
		if _, err := tx.Exec(q, id); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(`DELETE FROM users WHERE id = $1`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) EmailExists(email string) bool {
	var count int
	_ = r.db.Get(&count, `SELECT COUNT(*) FROM users WHERE email=$1 AND deleted_at IS NULL`, email)
	return count > 0
}
