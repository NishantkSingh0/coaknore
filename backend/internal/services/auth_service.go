package services

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"time"
	"github.com/google/uuid"
	"github.com/pms/backend/internal/config"
	"github.com/pms/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)


type AuthService struct {
	db *sql.DB
}

func NewAuthService(db *sql.DB) *AuthService {
	return &AuthService{db: db}
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token    string           `json:"token"`
	Employee *models.Employee `json:"employee"`
}

func (s *AuthService) Login(req LoginRequest) (*LoginResponse, error) {
	var emp models.EmployeeWithPassword
	var deptID sql.NullString
	var phone, avatarURL sql.NullString
	var lastLoginAt sql.NullTime

	err := s.db.QueryRow(`
		SELECT e.id, e.organization_id, e.department_id, e.email,
		       e.password_hash, e.first_name, e.last_name, e.phone,
		       e.avatar_url, e.layer, e.is_active, e.last_login_at
		FROM employees e
		WHERE e.email = $1
	`, req.Email).Scan(
		&emp.ID, &emp.OrganizationID, &deptID, &emp.Email,
		&emp.PasswordHash, &emp.FirstName, &emp.LastName, &phone,
		&avatarURL, &emp.Layer, &emp.IsActive, &lastLoginAt,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("invalid email or password")
	}
	if err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}
	if !emp.IsActive {
		return nil, errors.New("account is disabled")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(emp.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	// Set nullable fields
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
	if lastLoginAt.Valid {
		emp.LastLoginAt = &lastLoginAt.Time
	}

	// Update last login
	s.db.Exec(`UPDATE employees SET last_login_at = NOW() WHERE id = $1`, emp.ID)

	// Load department name
	if emp.DepartmentID != nil {
		var deptName string
		s.db.QueryRow(`SELECT name FROM departments WHERE id = $1`, emp.DepartmentID).Scan(&deptName)
		emp.DepartmentName = deptName
	}
	emp.FullName = emp.FirstName + " " + emp.LastName
	token, err := GenerateJWT(&emp.Employee)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}
	return &LoginResponse{Token: token, Employee: &emp.Employee}, nil
}

func (s *AuthService) ChangePassword(employeeID uuid.UUID, currentPassword, newPassword string) error {
	var hash string
	err := s.db.QueryRow(`SELECT password_hash FROM employees WHERE id = $1`, employeeID).Scan(&hash)
	if err != nil {
		return errors.New("employee not found")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(currentPassword)); err != nil {
		return errors.New("current password is incorrect")
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}
	_, err = s.db.Exec(`UPDATE employees SET password_hash = $1, updated_at = NOW() WHERE id = $2`, string(newHash), employeeID)
	return err
}

func (s *AuthService) AdminResetPassword(adminID, targetEmployeeID uuid.UUID, newPassword string) error {
	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}
	_, err = s.db.Exec(`
		UPDATE employees SET password_hash = $1, updated_at = NOW() 
		WHERE id = $2
	`, string(newHash), targetEmployeeID)
	return err
}

func (s *AuthService) GeneratePasswordResetToken(email string) (string, error) {
	var empID uuid.UUID
	err := s.db.QueryRow(`SELECT id FROM employees WHERE email = $1 AND is_active = TRUE`, email).Scan(&empID)
	if err == sql.ErrNoRows {
		// Don't reveal whether email exists
		return "", nil
	}
	if err != nil {
		return "", err
	}

	b := make([]byte, 32)
	rand.Read(b)
	token := hex.EncodeToString(b)
	expires := time.Now().Add(time.Duration(config.App.PasswordResetExpiryHours) * time.Hour)

	_, err = s.db.Exec(`
		UPDATE employees SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3
	`, token, expires, empID)
	if err != nil {
		return "", err
	}
	return token, nil
}

func (s *AuthService) ResetPasswordWithToken(token, newPassword string) error {
	var empID uuid.UUID
	var expires time.Time

	err := s.db.QueryRow(`
		SELECT id, password_reset_expires FROM employees 
		WHERE password_reset_token = $1
	`, token).Scan(&empID, &expires)

	if err == sql.ErrNoRows {
		return errors.New("invalid or expired reset token")
	}
	if err != nil {
		return err
	}
	if time.Now().After(expires) {
		return errors.New("reset token has expired")
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(`
		UPDATE employees 
		SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL, updated_at = NOW()
		WHERE id = $2
	`, string(newHash), empID)
	return err
}

func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash), err
}