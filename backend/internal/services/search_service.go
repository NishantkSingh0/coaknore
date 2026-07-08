package services

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type SearchService struct {
	db *sql.DB
}

func NewSearchService(db *sql.DB) *SearchService {
	return &SearchService{db: db}
}

type SearchResult struct {
	EntityType  string      `json:"entity_type"`
	EntityID    uuid.UUID   `json:"entity_id"`
	Title       string      `json:"title"`
	Description string      `json:"description"`
	ProjectID   *uuid.UUID  `json:"project_id,omitempty"`
	ProjectName string      `json:"project_name,omitempty"`
	Status      string      `json:"status,omitempty"`
	Extra       interface{} `json:"extra,omitempty"`
}

type SearchParams struct {
	Query      string
	OrgID      uuid.UUID
	Types      []string // project, issue, task, employee, department, routing
	ProjectID  *uuid.UUID
	DateFrom   string
	DateTo     string
	Status     string
	Page       int
	PageSize   int
}

func (s *SearchService) Search(params SearchParams) ([]SearchResult, int, error) {
	if params.Query == "" && params.ProjectID == nil {
		return nil, 0, nil
	}
	if params.PageSize == 0 {
		params.PageSize = 20
	}

	var results []SearchResult
	q := "%" + params.Query + "%"

	shouldSearch := func(t string) bool {
		if len(params.Types) == 0 {
			return true
		}
		for _, tp := range params.Types {
			if tp == t {
				return true
			}
		}
		return false
	}

	// Projects
	if shouldSearch("project") {
		rows, err := s.db.Query(`
			SELECT p.id, p.project_name, p.po_number, p.client_name, p.status, p.created_at
			FROM projects p
			WHERE p.organization_id = $1
			  AND ($2 = '%%' OR p.project_name ILIKE $2 OR p.po_number ILIKE $2 OR p.client_name ILIKE $2)
			ORDER BY p.updated_at DESC
			LIMIT 10
		`, params.OrgID, q)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var r SearchResult
				var desc, status sql.NullString
				rows.Scan(&r.EntityID, &r.Title, &desc, &status, &status, nil)
				r.EntityType = "project"
				if desc.Valid {
					r.Description = desc.String
				}
				if status.Valid {
					r.Status = status.String
				}
				results = append(results, r)
			}
		}
	}

	// Issues
	if shouldSearch("issue") {
		query := `
			SELECT i.id, i.title, i.description, i.status, i.project_id, p.project_name
			FROM issues i
			LEFT JOIN projects p ON p.id = i.project_id
			LEFT JOIN departments d ON d.id = i.department_id
			WHERE d.organization_id = $1
			  AND ($2 = '%%' OR i.title ILIKE $2 OR i.description ILIKE $2)
		`
		args := []interface{}{params.OrgID, q}
		if params.ProjectID != nil {
			query += ` AND i.project_id = $3`
			args = append(args, *params.ProjectID)
		}
		query += ` ORDER BY i.created_at DESC LIMIT 10`

		rows, err := s.db.Query(query, args...)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var r SearchResult
				var desc, projName sql.NullString
				var projID sql.NullString
				rows.Scan(&r.EntityID, &r.Title, &desc, &r.Status, &projID, &projName)
				r.EntityType = "issue"
				if desc.Valid {
					r.Description = desc.String
				}
				if projID.Valid {
					id, _ := uuid.Parse(projID.String)
					r.ProjectID = &id
				}
				if projName.Valid {
					r.ProjectName = projName.String
				}
				results = append(results, r)
			}
		}
	}

	// Employees
	if shouldSearch("employee") {
		rows, err := s.db.Query(`
			SELECT e.id, CONCAT(e.first_name,' ',e.last_name), e.email, e.layer,
			       COALESCE(d.name,'')
			FROM employees e
			LEFT JOIN departments d ON d.id = e.department_id
			WHERE e.organization_id = $1
			  AND ($2 = '%%' OR e.first_name ILIKE $2 OR e.last_name ILIKE $2 OR e.email ILIKE $2)
			ORDER BY e.first_name
			LIMIT 10
		`, params.OrgID, q)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var r SearchResult
				var email, layer, deptName string
				rows.Scan(&r.EntityID, &r.Title, &email, &layer, &deptName)
				r.EntityType = "employee"
				r.Description = fmt.Sprintf("%s — %s — %s", email, layer, deptName)
				results = append(results, r)
			}
		}
	}

	// Departments
	if shouldSearch("department") {
		rows, err := s.db.Query(`
			SELECT id, name, description, layer
			FROM departments
			WHERE organization_id = $1
			  AND ($2 = '%%' OR name ILIKE $2)
			ORDER BY name LIMIT 10
		`, params.OrgID, q)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var r SearchResult
				var desc, layer sql.NullString
				rows.Scan(&r.EntityID, &r.Title, &desc, &layer)
				r.EntityType = "department"
				if desc.Valid {
					r.Description = desc.String
				}
				if layer.Valid {
					r.Status = layer.String
				}
				results = append(results, r)
			}
		}
	}

	// Tasks
	if shouldSearch("task") && params.ProjectID != nil {
		rows, err := s.db.Query(`
			SELECT t.id, COALESCE(t.title, d.name), t.status,
			       t.project_id, p.project_name, d.name
			FROM department_tasks t
			LEFT JOIN departments d ON d.id = t.department_id
			LEFT JOIN projects p ON p.id = t.project_id
			WHERE d.organization_id = $1
			  AND t.project_id = $2
			  AND ($3 = '%%' OR d.name ILIKE $3 OR t.title ILIKE $3)
			LIMIT 10
		`, params.OrgID, *params.ProjectID, q)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var r SearchResult
				var projID sql.NullString
				var projName, deptName sql.NullString
				rows.Scan(&r.EntityID, &r.Title, &r.Status, &projID, &projName, &deptName)
				r.EntityType = "task"
				if projID.Valid {
					id, _ := uuid.Parse(projID.String)
					r.ProjectID = &id
				}
				if projName.Valid {
					r.ProjectName = projName.String
				}
				if deptName.Valid {
					r.Description = deptName.String
				}
				results = append(results, r)
			}
		}
	}

	// Apply pagination
	total := len(results)
	start := (params.Page - 1) * params.PageSize
	end := start + params.PageSize
	if start >= total {
		return []SearchResult{}, total, nil
	}
	if end > total {
		end = total
	}

	return results[start:end], total, nil
}

// Dashboard statistics

type DashboardStats struct {
	TotalProjects     int `json:"total_projects"`
	ActiveProjects    int `json:"active_projects"`
	DelayedProjects   int `json:"delayed_projects"`
	CompletedProjects int `json:"completed_projects"`
	OpenIssues        int `json:"open_issues"`
	PendingReworks    int `json:"pending_reworks"`
	PendingMaterials  int `json:"pending_materials"`
	TotalEmployees    int `json:"total_employees"`
	TotalDepartments  int `json:"total_departments"`
}

func (s *SearchService) GetDashboardStats(orgID uuid.UUID) (*DashboardStats, error) {
	stats := &DashboardStats{}

	s.db.QueryRow(`SELECT COUNT(*) FROM projects WHERE organization_id = $1`, orgID).Scan(&stats.TotalProjects)
	s.db.QueryRow(`SELECT COUNT(*) FROM projects WHERE organization_id = $1 AND status = 'in_progress'`, orgID).Scan(&stats.ActiveProjects)
	s.db.QueryRow(`
		SELECT COUNT(*) FROM projects p
		WHERE p.organization_id = $1 AND p.status NOT IN ('completed','archived')
		AND EXISTS (
			SELECT 1 FROM department_tasks t
			LEFT JOIN departments d ON d.id = t.department_id
			WHERE t.project_id = p.id AND t.due_date < NOW() AND t.status != 'completed'
		)
	`, orgID).Scan(&stats.DelayedProjects)
	s.db.QueryRow(`SELECT COUNT(*) FROM projects WHERE organization_id = $1 AND status = 'completed'`, orgID).Scan(&stats.CompletedProjects)
	s.db.QueryRow(`
		SELECT COUNT(*) FROM issues i
		LEFT JOIN departments d ON d.id = i.department_id
		WHERE d.organization_id = $1 AND i.status NOT IN ('closed','rejected')
	`, orgID).Scan(&stats.OpenIssues)
	s.db.QueryRow(`
		SELECT COUNT(*) FROM rework_requests r
		LEFT JOIN projects p ON p.id = r.project_id
		WHERE p.organization_id = $1 AND r.status = 'pending'
	`, orgID).Scan(&stats.PendingReworks)
	s.db.QueryRow(`
		SELECT COUNT(*) FROM material_requisitions m
		LEFT JOIN departments d ON d.id = m.department_id
		WHERE d.organization_id = $1 AND m.status = 'pending'
	`, orgID).Scan(&stats.PendingMaterials)
	s.db.QueryRow(`SELECT COUNT(*) FROM employees WHERE organization_id = $1 AND is_active = TRUE`, orgID).Scan(&stats.TotalEmployees)
	s.db.QueryRow(`SELECT COUNT(*) FROM departments WHERE organization_id = $1 AND is_active = TRUE`, orgID).Scan(&stats.TotalDepartments)

	return stats, nil
}

func buildSearchWhere(conditions []string) string {
	if len(conditions) == 0 {
		return ""
	}
	return "WHERE " + strings.Join(conditions, " AND ")
}
