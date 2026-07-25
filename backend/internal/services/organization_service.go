package services

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/pms/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

type OrganizationService struct {
	db *sql.DB
}

func NewOrganizationService(db *sql.DB) *OrganizationService {
	return &OrganizationService{db: db}
}

// ============================================================
// DEPARTMENTS
// ============================================================

func (s *OrganizationService) CreateDepartment(orgID uuid.UUID, name, description string, layer models.DepartmentLayer) (*models.Department, error) {
	dept := &models.Department{}
	err := s.db.QueryRow(`
		INSERT INTO departments (organization_id, name, description, layer)
		VALUES ($1, $2, $3, $4)
		RETURNING id, organization_id, name, description, layer, is_active, created_at, updated_at
	`, orgID, name, description, layer).Scan(
		&dept.ID, &dept.OrganizationID, &dept.Name, &dept.Description,
		&dept.Layer, &dept.IsActive, &dept.CreatedAt, &dept.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create department: %w", err)
	}
	return dept, nil
}

func (s *OrganizationService) UpdateDepartment(id uuid.UUID, name, description string) (*models.Department, error) {
	dept := &models.Department{}
	err := s.db.QueryRow(`
		UPDATE departments SET name = $1, description = $2, updated_at = NOW()
		WHERE id = $3
		RETURNING id, organization_id, name, description, layer, is_active, created_at, updated_at
	`, name, description, id).Scan(
		&dept.ID, &dept.OrganizationID, &dept.Name, &dept.Description,
		&dept.Layer, &dept.IsActive, &dept.CreatedAt, &dept.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update department: %w", err)
	}
	return dept, nil
}

func (s *OrganizationService) ToggleDepartment(id uuid.UUID, active bool) error {
	_, err := s.db.Exec(`UPDATE departments SET is_active = $1, updated_at = NOW() WHERE id = $2`, active, id)
	return err
}

func (s *OrganizationService) ListDepartments(orgID uuid.UUID, layer string) ([]models.Department, error) {
	query := `
		SELECT d.id, d.organization_id, d.name, d.description, d.layer, d.is_active, d.created_at, d.updated_at,
		       COUNT(e.id) as employee_count
		FROM departments d
		LEFT JOIN employees e ON e.department_id = d.id AND e.is_active = TRUE
		WHERE d.organization_id = $1
	`
	args := []interface{}{orgID}

	if layer != "" {
		query += ` AND d.layer = $2`
		args = append(args, layer)
	}

	query += ` GROUP BY d.id ORDER BY d.layer, d.name`

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var depts []models.Department
	for rows.Next() {
		var d models.Department
		err := rows.Scan(
			&d.ID, &d.OrganizationID, &d.Name, &d.Description,
			&d.Layer, &d.IsActive, &d.CreatedAt, &d.UpdatedAt, &d.EmployeeCount,
		)
		if err != nil {
			return nil, err
		}
		depts = append(depts, d)
	}
	return depts, nil
}

func (s *OrganizationService) GetDepartment(id uuid.UUID) (*models.Department, error) {
	var d models.Department
	err := s.db.QueryRow(`
		SELECT d.id, d.organization_id, d.name, d.description, d.layer, d.is_active, d.created_at, d.updated_at,
		       COUNT(e.id) as employee_count
		FROM departments d
		LEFT JOIN employees e ON e.department_id = d.id AND e.is_active = TRUE
		WHERE d.id = $1
		GROUP BY d.id
	`, id).Scan(
		&d.ID, &d.OrganizationID, &d.Name, &d.Description,
		&d.Layer, &d.IsActive, &d.CreatedAt, &d.UpdatedAt, &d.EmployeeCount,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("department not found")
	}
	return &d, err
}

// ============================================================
// EMPLOYEES
// ============================================================

type CreateEmployeeRequest struct {
	DepartmentID string                `json:"department_id"`
	Email        string                `json:"email"`
	Password     string                `json:"password"`
	FirstName    string                `json:"first_name"`
	LastName     string                `json:"last_name"`
	Phone        string                `json:"phone"`
	Layer        models.LayerType      `json:"layer"`
}

type UpdateEmployeeRequest struct {
	DepartmentID string `json:"department_id"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	Phone        string `json:"phone"`
	Layer        string `json:"layer"`
}

func (s *OrganizationService) CreateEmployee(orgID uuid.UUID, req CreateEmployeeRequest) (*models.Employee, error) {
	// Check if email exists
	var count int
	s.db.QueryRow(`SELECT COUNT(*) FROM employees WHERE email = $1`, req.Email).Scan(&count)
	if count > 0 {
		return nil, errors.New("email already registered")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	var deptIDArg interface{}
	if req.DepartmentID != "" {
		id, err := uuid.Parse(req.DepartmentID)
		if err != nil {
			return nil, errors.New("invalid department_id")
		}
		deptIDArg = id
	}

	emp := &models.Employee{}
	var deptID sql.NullString
	var phone, avatarURL sql.NullString

	err = s.db.QueryRow(`
		INSERT INTO employees (organization_id, department_id, email, password_hash, first_name, last_name, phone, layer)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, organization_id, department_id, email, first_name, last_name, phone, avatar_url, layer, is_active, created_at, updated_at
	`, orgID, deptIDArg, req.Email, string(hash), req.FirstName, req.LastName, nullStr(req.Phone), req.Layer,
	).Scan(
		&emp.ID, &emp.OrganizationID, &deptID, &emp.Email,
		&emp.FirstName, &emp.LastName, &phone, &avatarURL,
		&emp.Layer, &emp.IsActive, &emp.CreatedAt, &emp.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create employee: %w", err)
	}

	if deptID.Valid {
		id, _ := uuid.Parse(deptID.String)
		emp.DepartmentID = &id
	}
	if phone.Valid {
		emp.Phone = phone.String
	}
	if avatarURL.Valid {
		emp.AvatarURL = avatarURL.String
	}
	emp.FullName = emp.FirstName + " " + emp.LastName
	return emp, nil
}

func (s *OrganizationService) UpdateEmployee(id uuid.UUID, req UpdateEmployeeRequest) (*models.Employee, error) {
	var deptIDArg interface{}
	if req.DepartmentID != "" {
		did, err := uuid.Parse(req.DepartmentID)
		if err != nil {
			return nil, errors.New("invalid department_id")
		}
		deptIDArg = did
	}

	emp := &models.Employee{}
	var deptID sql.NullString
	var phone sql.NullString
	var avatarURL sql.NullString

	err := s.db.QueryRow(`
		UPDATE employees 
		SET department_id = $1, first_name = $2, last_name = $3, phone = $4, updated_at = NOW()
		WHERE id = $5
		RETURNING id, organization_id, department_id, email, first_name, last_name, phone, avatar_url, layer, is_active, created_at, updated_at
	`, deptIDArg, req.FirstName, req.LastName, nullStr(req.Phone), id,
	).Scan(
		&emp.ID, &emp.OrganizationID, &deptID, &emp.Email,
		&emp.FirstName, &emp.LastName, &phone, &avatarURL,
		&emp.Layer, &emp.IsActive, &emp.CreatedAt, &emp.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update employee: %w", err)
	}

	if deptID.Valid {
		id, _ := uuid.Parse(deptID.String)
		emp.DepartmentID = &id
	}
	if phone.Valid {
		emp.Phone = phone.String
	}
	if avatarURL.Valid {
		emp.AvatarURL = avatarURL.String
	}
	emp.FullName = emp.FirstName + " " + emp.LastName
	return emp, nil
}

func (s *OrganizationService) ToggleEmployee(id uuid.UUID, active bool) error {
	_, err := s.db.Exec(`UPDATE employees SET is_active = $1, updated_at = NOW() WHERE id = $2`, active, id)
	return err
}

func (s *OrganizationService) TransferEmployee(empID, newDeptID uuid.UUID) error {
	_, err := s.db.Exec(`
		UPDATE employees SET department_id = $1, updated_at = NOW() WHERE id = $2
	`, newDeptID, empID)
	return err
}

func (s *OrganizationService) ListEmployees(orgID uuid.UUID, search, layer, deptID string, active *bool, page, pageSize int) ([]models.Employee, int, error) {
	conditions := []string{"e.organization_id = $1"}
	args := []interface{}{orgID}
	argIdx := 2

	// Exclude specific emails from being visible
	conditions = append(conditions, "e.email NOT IN ('n@oaknore.in', 'k@oaknore.in')")
	if search != "" {
		conditions = append(conditions, fmt.Sprintf(`(
			e.first_name ILIKE $%d OR e.last_name ILIKE $%d OR e.email ILIKE $%d
		)`, argIdx, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if layer != "" {
		conditions = append(conditions, fmt.Sprintf("e.layer = $%d", argIdx))
		args = append(args, layer)
		argIdx++
	}
	if deptID != "" {
		conditions = append(conditions, fmt.Sprintf("e.department_id = $%d", argIdx))
		args = append(args, deptID)
		argIdx++
	}
	if active != nil {
		conditions = append(conditions, fmt.Sprintf("e.is_active = $%d", argIdx))
		args = append(args, *active)
		argIdx++
	}

	where := "WHERE " + joinConditions(conditions, " AND ")

	var total int
	s.db.QueryRow(`SELECT COUNT(*) FROM employees e `+where, args...).Scan(&total)

	query := fmt.Sprintf(`
		SELECT e.id, e.organization_id, e.department_id, e.email, e.first_name, e.last_name,
		       e.phone, e.avatar_url, e.layer, e.is_active, e.last_login_at, e.created_at, e.updated_at,
		       COALESCE(d.name, '') as dept_name
		FROM employees e
		LEFT JOIN departments d ON d.id = e.department_id
		%s
		ORDER BY e.first_name, e.last_name
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, pageSize, (page-1)*pageSize)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var employees []models.Employee
	for rows.Next() {
		var e models.Employee
		var deptIDStr sql.NullString
		var phone, avatarURL sql.NullString
		var lastLogin sql.NullTime

		err := rows.Scan(
			&e.ID, &e.OrganizationID, &deptIDStr, &e.Email,
			&e.FirstName, &e.LastName, &phone, &avatarURL,
			&e.Layer, &e.IsActive, &lastLogin, &e.CreatedAt, &e.UpdatedAt,
			&e.DepartmentName,
		)
		if err != nil {
			return nil, 0, err
		}
		if deptIDStr.Valid {
			id, _ := uuid.Parse(deptIDStr.String)
			e.DepartmentID = &id
		}
		if phone.Valid {
			e.Phone = phone.String
		}
		if avatarURL.Valid {
			e.AvatarURL = avatarURL.String
		}
		if lastLogin.Valid {
			e.LastLoginAt = &lastLogin.Time
		}
		e.FullName = e.FirstName + " " + e.LastName
		employees = append(employees, e)
	}
	return employees, total, nil
}

func (s *OrganizationService) GetEmployee(id uuid.UUID) (*models.Employee, error) {
	var e models.Employee
	var deptIDStr, phone, avatarURL sql.NullString
	var lastLogin sql.NullTime

	err := s.db.QueryRow(`
		SELECT e.id, e.organization_id, e.department_id, e.email, e.first_name, e.last_name,
		       e.phone, e.avatar_url, e.layer, e.is_active, e.last_login_at, e.created_at, e.updated_at,
		       COALESCE(d.name, '') as dept_name
		FROM employees e
		LEFT JOIN departments d ON d.id = e.department_id
		WHERE e.id = $1
	`, id).Scan(
		&e.ID, &e.OrganizationID, &deptIDStr, &e.Email,
		&e.FirstName, &e.LastName, &phone, &avatarURL,
		&e.Layer, &e.IsActive, &lastLogin, &e.CreatedAt, &e.UpdatedAt,
		&e.DepartmentName,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("employee not found")
	}
	if err != nil {
		return nil, err
	}

	if deptIDStr.Valid {
		id, _ := uuid.Parse(deptIDStr.String)
		e.DepartmentID = &id
	}
	if phone.Valid {
		e.Phone = phone.String
	}
	if avatarURL.Valid {
		e.AvatarURL = avatarURL.String
	}
	if lastLogin.Valid {
		e.LastLoginAt = &lastLogin.Time
	}
	e.FullName = e.FirstName + " " + e.LastName
	return &e, nil
}

// SearchEmployeesByEmail searches employees for the query panel recipient search
func (s *OrganizationService) SearchEmployeesByEmail(orgID uuid.UUID, query string, callerLayer models.LayerType, callerDeptID *uuid.UUID) ([]models.Employee, error) {
	// No layer restrictions - any user can communicate with any user
	rows, err := s.db.Query(`
		SELECT e.id, e.organization_id, e.department_id, e.email, e.first_name, e.last_name,
		       e.layer, e.is_active, COALESCE(d.name, '') as dept_name
		FROM employees e
		LEFT JOIN departments d ON d.id = e.department_id
		WHERE e.organization_id = $1
		  AND e.is_active = TRUE
		  AND e.email NOT IN ('n@oaknore.in', 'k@oaknore.in')
		  AND (e.email ILIKE $2 OR e.first_name ILIKE $2 OR e.last_name ILIKE $2)
		LIMIT 10
	`, orgID, "%"+query+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.Employee
	for rows.Next() {
		var e models.Employee
		var deptIDStr sql.NullString
		rows.Scan(
			&e.ID, &e.OrganizationID, &deptIDStr, &e.Email,
			&e.FirstName, &e.LastName, &e.Layer, &e.IsActive, &e.DepartmentName,
		)
		if deptIDStr.Valid {
			id, _ := uuid.Parse(deptIDStr.String)
			e.DepartmentID = &id
		}
		e.FullName = e.FirstName + " " + e.LastName
		results = append(results, e)
	}
	return results, nil
}

func (s *OrganizationService) GetOrganization(id uuid.UUID) (*models.Organization, error) {
	org := &models.Organization{}
	var desc, logo sql.NullString
	err := s.db.QueryRow(`
		SELECT id, name, description, logo_url, created_at, updated_at FROM organizations WHERE id = $1
	`, id).Scan(&org.ID, &org.Name, &desc, &logo, &org.CreatedAt, &org.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if desc.Valid {
		org.Description = desc.String
	}
	if logo.Valid {
		org.LogoURL = logo.String
	}
	return org, nil
}

func (s *OrganizationService) UpdateAvatar(employeeID uuid.UUID, avatarURL *string) error {
	var val interface{}
	if avatarURL != nil && *avatarURL != "" {
		val = *avatarURL
	} else {
		val = nil
	}
	_, err := s.db.Exec(`UPDATE employees SET avatar_url = $1, updated_at = NOW() WHERE id = $2`, val, employeeID)
	return err
}

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func joinConditions(conds []string, sep string) string {
	result := ""
	for i, c := range conds {
		if i > 0 {
			result += sep
		}
		result += c
	}
	return result
}
