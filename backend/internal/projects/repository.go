package projects

import (
	"fmt"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

type Repository struct{ db *sqlx.DB }

func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

const projectCols = `id, po_number, project_name, receiving_date, image_url, quantity, rates,
	dimensions, remarks, specification, upholstery_finish, cad_urls, pdf_urls, render_urls,
	jobcard_urls, current_status, created_by::text, routing_set_at, completed_at, addon, created_at, updated_at, deleted_at`

func (r *Repository) List(f *ListFilter) ([]Project, int, error) {
	where := []string{"deleted_at IS NULL"}
	args := []interface{}{}
	i := 1

	if f.Status != "" {
		where = append(where, fmt.Sprintf("current_status=$%d", i))
		args = append(args, f.Status)
		i++
	}
	if f.Search != "" {
		where = append(where, fmt.Sprintf("(project_name ILIKE $%d OR po_number ILIKE $%d)", i, i))
		args = append(args, "%"+f.Search+"%")
		i++
	}
	if f.DateFrom != "" {
		where = append(where, fmt.Sprintf("receiving_date >= $%d", i))
		args = append(args, f.DateFrom)
		i++
	}
	if f.DateTo != "" {
		where = append(where, fmt.Sprintf("receiving_date <= $%d", i))
		args = append(args, f.DateTo)
		i++
	}

	baseQuery := "FROM projects WHERE " + strings.Join(where, " AND ")

	var total int
	if err := r.db.Get(&total, "SELECT COUNT(*) "+baseQuery, args...); err != nil {
		return nil, 0, err
	}

	limit := f.Limit
	if limit == 0 {
		limit = 20
	}
	offset := (f.Page - 1) * limit
	if offset < 0 {
		offset = 0
	}

	args = append(args, limit, offset)
	query := fmt.Sprintf("SELECT %s %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", projectCols, baseQuery, i, i+1)

	var projects []Project
	err := r.db.Select(&projects, query, args...)
	return projects, total, err
}

func (r *Repository) GetByID(id string) (*Project, error) {
	var p Project
	err := r.db.Get(&p, fmt.Sprintf("SELECT %s FROM projects WHERE id=$1 AND deleted_at IS NULL", projectCols), id)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) Create(req *CreateRequest, userID string) (*Project, error) {
	var p Project
	err := r.db.QueryRowx(fmt.Sprintf(`
		INSERT INTO projects (po_number, project_name, receiving_date, image_url, quantity, rates,
			dimensions, remarks, specification, upholstery_finish, cad_urls, pdf_urls, render_urls, jobcard_urls, created_by, addon)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		RETURNING %s`, projectCols),
		req.PONumber, req.ProjectName, req.ReceivingDate, req.ImageURL, req.Quantity, req.Rates,
		req.Dimensions, req.Remarks, req.Specification, req.UpholsteryFinish,
		req.CADURLs, req.PDFURLs, req.RenderURLs, req.JobcardURLs, userID, req.Addon,
	).StructScan(&p)
	return &p, err
}

func (r *Repository) Update(id string, req *UpdateRequest) (*Project, error) {
	query := `UPDATE projects SET updated_at=NOW()`
	args := []interface{}{}
	i := 1
	addField := func(col string, val interface{}) {
		query += fmt.Sprintf(", %s=$%d", col, i)
		args = append(args, val)
		i++
	}
	if req.ProjectName != nil {
		addField("project_name", *req.ProjectName)
	}
	if req.ReceivingDate != nil {
		addField("receiving_date", *req.ReceivingDate)
	}
	if req.ImageURL != nil {
		addField("image_url", *req.ImageURL)
	}
	if req.Quantity != nil {
		addField("quantity", *req.Quantity)
	}
	if req.Rates != nil {
		addField("rates", *req.Rates)
	}
	if req.Dimensions != nil {
		addField("dimensions", *req.Dimensions)
	}
	if req.Remarks != nil {
		addField("remarks", *req.Remarks)
	}
	if req.Specification != nil {
		addField("specification", *req.Specification)
	}
	if req.UpholsteryFinish != nil {
		addField("upholstery_finish", *req.UpholsteryFinish)
	}
	if req.CADURLs != nil {
		addField("cad_urls", *req.CADURLs)
	}
	if req.PDFURLs != nil {
		addField("pdf_urls", *req.PDFURLs)
	}
	if req.RenderURLs != nil {
		addField("render_urls", *req.RenderURLs)
	}
	if req.JobcardURLs != nil {
		addField("jobcard_urls", *req.JobcardURLs)
	}
	if req.CurrentStatus != nil {
		addField("current_status", *req.CurrentStatus)
	}
	if req.Addon != nil {
		addField("addon", *req.Addon)
	}
	query += fmt.Sprintf(" WHERE id=$%d::uuid AND deleted_at IS NULL RETURNING %s", i, projectCols)
	args = append(args, id)
	var p Project
	err := r.db.QueryRowx(query, args...).StructScan(&p)
	return &p, err
}

func (r *Repository) SoftDelete(id string) error {
	_, err := r.db.Exec(`UPDATE projects SET deleted_at=$1, updated_at=$1 WHERE id=$2`, time.Now(), id)
	return err
}

func (r *Repository) POExists(po string) bool {
	var count int
	_ = r.db.Get(&count, `SELECT COUNT(*) FROM projects WHERE po_number=$1 AND deleted_at IS NULL`, po)
	return count > 0
}

// GetRouting returns all routing rows for a project with dept names.
func (r *Repository) GetRouting(projectID string) ([]RoutingRow, error) {
	var rows []RoutingRow
	err := r.db.Select(&rows, `
		SELECT pdr.id, pdr.project_id, pdr.department_id::text, d.name AS department_name,
		       pdr.sequence_order, pdr.status, pdr.started_at, pdr.completed_at,
		       pdt.addon AS completion_proof_url, pdr.created_at
		FROM project_department_routing pdr
		JOIN departments d ON d.id = pdr.department_id
		LEFT JOIN project_department_tasks pdt ON pdt.routing_id = pdr.id
		WHERE pdr.project_id = $1
		ORDER BY pdr.sequence_order, d.name`, projectID)
	return rows, err
}

// SetRouting inserts routing rows and activates sequence=1 tasks.
func (r *Repository) SetRouting(projectID, userID string, entries []RoutingEntry) error {
	tx, err := r.db.Beginx()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	// Delete any existing routing
	if _, err = tx.Exec(`DELETE FROM project_department_routing WHERE project_id=$1`, projectID); err != nil {
		return err
	}

	// Insert new routing rows
	for _, e := range entries {
		var routingID string
		if err = tx.QueryRow(`
			INSERT INTO project_department_routing (project_id, department_id, sequence_order, set_by_user_id)
			VALUES ($1, $2, $3, $4) RETURNING id`,
			projectID, e.DepartmentID, e.SequenceOrder, userID,
		).Scan(&routingID); err != nil {
			return fmt.Errorf("insert routing: %w", err)
		}
	}

	// Find min sequence
	var minSeq int
	if err = tx.Get(&minSeq, `SELECT MIN(sequence_order) FROM project_department_routing WHERE project_id=$1`, projectID); err != nil {
		return err
	}

	// Activate sequence=minSeq rows
	type routingMeta struct {
		ID           string `db:"id"`
		DepartmentID string `db:"department_id"`
	}
	var firstRoutes []routingMeta
	if err = tx.Select(&firstRoutes, `
		SELECT id, department_id::text FROM project_department_routing
		WHERE project_id=$1 AND sequence_order=$2`, projectID, minSeq); err != nil {
		return err
	}

	now := time.Now()
	for _, fr := range firstRoutes {
		// Set routing status = in_progress
		if _, err = tx.Exec(`UPDATE project_department_routing SET status='in_progress', started_at=$1 WHERE id=$2`, now, fr.ID); err != nil {
			return err
		}
		// Create task record
		if _, err = tx.Exec(`
			INSERT INTO project_department_tasks (routing_id, project_id, department_id, status)
			VALUES ($1, $2, $3, 'in_progress')
			ON CONFLICT (routing_id) DO NOTHING`,
			fr.ID, projectID, fr.DepartmentID); err != nil {
			return err
		}
	}

	// Update project status
	if _, err = tx.Exec(`UPDATE projects SET current_status='routing_set', routing_set_at=$1 WHERE id=$2`, now, projectID); err != nil {
		return err
	}

	return tx.Commit()
}

// AdvanceRouting checks if a sequence group is done and activates the next.
// Returns true if the project itself is now complete.
func (r *Repository) AdvanceRouting(db *sqlx.DB, projectID string, completedSeq int) (bool, error) {
	// Count incomplete tasks at this sequence
	var remaining int
	err := db.Get(&remaining, `
		SELECT COUNT(*) FROM project_department_tasks pdt
		JOIN project_department_routing pdr ON pdt.routing_id = pdr.id
		WHERE pdr.project_id=$1 AND pdr.sequence_order=$2 AND pdt.status != 'completed'`,
		projectID, completedSeq)
	if err != nil {
		return false, err
	}
	if remaining > 0 {
		return false, nil // parallel partners still in progress
	}

	// Find next sequence
	var nextSeq *int
	_ = db.Get(&nextSeq, `
		SELECT MIN(sequence_order) FROM project_department_routing
		WHERE project_id=$1 AND sequence_order > $2`, projectID, completedSeq)

	if nextSeq == nil {
		// No next sequence — project is complete
		_, err = db.Exec(`UPDATE projects SET current_status='completed', completed_at=NOW() WHERE id=$1`, projectID)
		return true, err
	}

	// Activate next sequence
	now := time.Now()
	type routingMeta struct {
		ID           string `db:"id"`
		DepartmentID string `db:"department_id"`
	}
	var nextRoutes []routingMeta
	if err = db.Select(&nextRoutes, `
		SELECT id, department_id::text FROM project_department_routing
		WHERE project_id=$1 AND sequence_order=$2`, projectID, *nextSeq); err != nil {
		return false, err
	}
	for _, nr := range nextRoutes {
		if _, err = db.Exec(`UPDATE project_department_routing SET status='in_progress', started_at=$1 WHERE id=$2`, now, nr.ID); err != nil {
			return false, err
		}
		if _, err = db.Exec(`
			INSERT INTO project_department_tasks (routing_id, project_id, department_id, status)
			VALUES ($1, $2, $3, 'in_progress') ON CONFLICT (routing_id) DO NOTHING`,
			nr.ID, projectID, nr.DepartmentID); err != nil {
			return false, err
		}
	}
	_, err = db.Exec(`UPDATE projects SET current_status='in_progress' WHERE id=$1`, projectID)
	return false, err
}
