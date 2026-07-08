package services

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pms/backend/internal/config"
	"github.com/pms/backend/internal/models"
)

type JWTClaims struct {
	EmployeeID   string `json:"employee_id"`
	Layer        string `json:"layer"`
	OrgID        string `json:"org_id"`
	DepartmentID string `json:"department_id,omitempty"`
	Email        string `json:"email"`
	jwt.RegisteredClaims
}

func GenerateJWT(emp *models.Employee) (string, error) {
	deptID := ""
	if emp.DepartmentID != nil {
		deptID = emp.DepartmentID.String()
	}

	claims := JWTClaims{
		EmployeeID:   emp.ID.String(),
		Layer:        string(emp.Layer),
		OrgID:        emp.OrganizationID.String(),
		DepartmentID: deptID,
		Email:        emp.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(
				time.Duration(config.App.JWTExpiryHours) * time.Hour,
			)),
			IssuedAt: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.App.JWTSecret))
}
