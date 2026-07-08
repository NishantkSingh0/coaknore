package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/pms/backend/internal/config"
	"github.com/pms/backend/internal/models"
	"github.com/pms/backend/pkg/utils"
)

type ContextKey string

const (
	ContextKeyEmployeeID    ContextKey = "employee_id"
	ContextKeyLayer         ContextKey = "layer"
	ContextKeyOrgID         ContextKey = "org_id"
	ContextKeyDepartmentID  ContextKey = "department_id"
	ContextKeyEmployeeEmail ContextKey = "employee_email"
)

// Claims mirrors services.JWTClaims — kept separate to avoid import cycle.
type Claims struct {
	EmployeeID   string `json:"employee_id"`
	Layer        string `json:"layer"`
	OrgID        string `json:"org_id"`
	DepartmentID string `json:"department_id,omitempty"`
	Email        string `json:"email"`
	jwt.RegisteredClaims
}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			utils.Unauthorized(w, "Authorization header required")
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			utils.Unauthorized(w, "Invalid authorization header format")
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(parts[1], claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(config.App.JWTSecret), nil
		})
		if err != nil || !token.Valid {
			utils.Unauthorized(w, "Invalid or expired token")
			return
		}

		empID, err := uuid.Parse(claims.EmployeeID)
		if err != nil {
			utils.Unauthorized(w, "Invalid token claims")
			return
		}
		orgID, err := uuid.Parse(claims.OrgID)
		if err != nil {
			utils.Unauthorized(w, "Invalid token claims")
			return
		}

		ctx := context.WithValue(r.Context(), ContextKeyEmployeeID, empID)
		ctx = context.WithValue(ctx, ContextKeyLayer, models.LayerType(claims.Layer))
		ctx = context.WithValue(ctx, ContextKeyOrgID, orgID)
		ctx = context.WithValue(ctx, ContextKeyEmployeeEmail, claims.Email)

		if claims.DepartmentID != "" {
			if deptID, err := uuid.Parse(claims.DepartmentID); err == nil {
				ctx = context.WithValue(ctx, ContextKeyDepartmentID, deptID)
			}
		}

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func RequireLayer(layers ...models.LayerType) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			layer, ok := r.Context().Value(ContextKeyLayer).(models.LayerType)
			if !ok {
				utils.Unauthorized(w, "Not authenticated")
				return
			}
			for _, l := range layers {
				if layer == l {
					next.ServeHTTP(w, r)
					return
				}
			}
			utils.Forbidden(w, "Insufficient permissions")
		})
	}
}

// ── Context helpers ──────────────────────────────────────────────────────────

func GetEmployeeID(r *http.Request) uuid.UUID {
	id, _ := r.Context().Value(ContextKeyEmployeeID).(uuid.UUID)
	return id
}

func GetLayer(r *http.Request) models.LayerType {
	layer, _ := r.Context().Value(ContextKeyLayer).(models.LayerType)
	return layer
}

func GetOrgID(r *http.Request) uuid.UUID {
	id, _ := r.Context().Value(ContextKeyOrgID).(uuid.UUID)
	return id
}

func GetDepartmentID(r *http.Request) *uuid.UUID {
	id, ok := r.Context().Value(ContextKeyDepartmentID).(uuid.UUID)
	if !ok {
		return nil
	}
	return &id
}

func IsAdmin(r *http.Request) bool {
	l := GetLayer(r)
	return l == models.LayerOne || l == models.LayerSuperAdmin
}

func IsLayerTwo(r *http.Request) bool { return GetLayer(r) == models.LayerTwo }
func IsLayerThree(r *http.Request) bool { return GetLayer(r) == models.LayerThree }

// GetEditorEmail returns the authenticated employee's email from JWT claims.
func GetEditorEmail(r *http.Request) string {
	email, _ := r.Context().Value(ContextKeyEmployeeEmail).(string)
	return email
}

// GetEditorName is a best-effort lookup — we store name in a separate context key if available.
func GetEditorName(r *http.Request) string {
	name, _ := r.Context().Value(ContextKey("editor_name")).(string)
	return name
}
