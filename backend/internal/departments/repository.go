package departments

import (
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
)

type Repository struct{ db *sqlx.DB }

func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) List() ([]Department, error) {
	var depts []Department
	err := r.db.Select(&depts, `SELECT * FROM departments WHERE deleted_at IS NULL ORDER BY layer, name`)
	return depts, err
}

func (r *Repository) GetByID(id string) (*Department, error) {
	var d Department
	err := r.db.Get(&d, `SELECT * FROM departments WHERE id=$1 AND deleted_at IS NULL`, id)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) Create(req *CreateRequest) (*Department, error) {
	var d Department
	err := r.db.QueryRowx(`
		INSERT INTO departments (name, layer, description, addon)
		VALUES ($1, $2, $3, $4)
		RETURNING *`,
		req.Name, req.Layer, req.Description, req.Addon,
	).StructScan(&d)
	return &d, err
}

func (r *Repository) Update(id string, req *UpdateRequest) (*Department, error) {
	query := `UPDATE departments SET updated_at=NOW()`
	args := []interface{}{}
	i := 1
	addField := func(col string, val interface{}) {
		query += fmt.Sprintf(", %s=$%d", col, i+1)
		args = append(args, val)
		i++
	}
	if req.Name != nil {
		addField("name", *req.Name)
	}
	if req.Description != nil {
		addField("description", *req.Description)
	}
	if req.IsActive != nil {
		addField("is_active", *req.IsActive)
	}
	if req.Addon != nil {
		addField("addon", *req.Addon)
	}
	query += fmt.Sprintf(" WHERE id=$%d AND deleted_at IS NULL RETURNING *", i+1)
	args = append(args, id)
	var d Department
	err := r.db.QueryRowx(query, args...).StructScan(&d)
	return &d, err
}

func (r *Repository) SoftDelete(id string) error {
	_, err := r.db.Exec(`UPDATE departments SET deleted_at=$1, updated_at=$1 WHERE id=$2`, time.Now(), id)
	return err
}
