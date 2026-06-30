package auth

import (
	"encoding/json"
	"net/http"
	"time"

	"pms/backend/internal/files"
	"pms/backend/pkg/response"
	"pms/backend/pkg/validator"

	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"
)

type Handler struct {
	db *sqlx.DB
	s3 *files.S3Client
}

func NewHandler(db *sqlx.DB, s3 *files.S3Client) *Handler { return &Handler{db: db, s3: s3} }

// LoginRequest is the expected login body.
type LoginRequest struct {
	Email    string `json:"email"    validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
}

// LoginResponse returned on success.
type LoginResponse struct {
	Token string   `json:"token"`
	User  UserMeta `json:"user"`
}

type UserMeta struct {
	ID           string `json:"id"            db:"id"`
	Name         string `json:"name"          db:"name"`
	Email        string `json:"email"         db:"email"`
	Role         string `json:"role"          db:"role"`
	DepartmentID string `json:"department_id" db:"department_id"`
	DeptLayer    int    `json:"dept_layer"    db:"dept_layer"`
	AvatarURL    string `json:"avatar_url"    db:"avatar_url"`
}

// Login handles POST /auth/login.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "invalid request body", "")
		return
	}
	if ve := validator.Validate(req); ve != nil {
		response.Error(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", ve.Message, ve.Field)
		return
	}

	// Fetch user + department layer
	var user struct {
		ID           string  `db:"id"`
		Name         string  `db:"name"`
		Email        string  `db:"email"`
		PasswordHash string  `db:"password_hash"`
		Role         string  `db:"role"`
		DepartmentID *string `db:"department_id"`
		DeptLayer    *int    `db:"dept_layer"`
		Addon        *string `db:"addon"`
		IsActive     bool    `db:"is_active"`
	}
	const q = `
		SELECT u.id, u.name, u.email, u.password_hash, u.role,
		       u.department_id::text, d.layer AS dept_layer, u.addon, u.is_active
		FROM users u
		LEFT JOIN departments d ON d.id = u.department_id
		WHERE u.email = $1 AND u.deleted_at IS NULL
		LIMIT 1`
	if err := h.db.Get(&user, q, req.Email); err != nil {
		response.Error(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "invalid email or password", "")
		return
	}
	if !user.IsActive {
		response.Error(w, http.StatusForbidden, "ACCOUNT_INACTIVE", "account is deactivated", "")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		response.Error(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "invalid email or password", "")
		return
	}

	deptID := ""
	if user.DepartmentID != nil {
		deptID = *user.DepartmentID
	}
	deptLayer := 0
	if user.DeptLayer != nil {
		deptLayer = *user.DeptLayer
	}
	avatarURL := ""
	if h.s3 != nil {
		if resolved := h.s3.ResolveURL(r.Context(), user.Addon); resolved != nil {
			avatarURL = *resolved
		}
	} else if user.Addon != nil {
		avatarURL = *user.Addon
	}

	token, err := GenerateToken(user.ID, deptID, user.Role, deptLayer)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "TOKEN_ERROR", "failed to generate token", "")
		return
	}

	// Update last_login_at
	_, _ = h.db.Exec(`UPDATE users SET last_login_at=$1 WHERE id=$2`, time.Now(), user.ID)

	response.JSON(w, http.StatusOK, LoginResponse{
		Token: token,
		User: UserMeta{
			ID:           user.ID,
			Name:         user.Name,
			Email:        user.Email,
			Role:         user.Role,
			DepartmentID: deptID,
			DeptLayer:    deptLayer,
			AvatarURL:    avatarURL,
		},
	})
}

// ChangePasswordRequest is the expected body for password changes.
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8"`
}

// ChangePassword handles POST /auth/change-password (requires JWT).
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims := ClaimsFromCtx(r.Context())
	if claims == nil {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "not authenticated", "")
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "invalid request body", "")
		return
	}
	if ve := validator.Validate(req); ve != nil {
		response.Error(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", ve.Message, ve.Field)
		return
	}

	var hash string
	if err := h.db.Get(&hash, `SELECT password_hash FROM users WHERE id=$1`, claims.UserID); err != nil {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "user not found", "")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.OldPassword)); err != nil {
		response.Error(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "old password is incorrect", "old_password")
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "failed to hash password", "")
		return
	}
	_, _ = h.db.Exec(`UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2`, string(newHash), claims.UserID)
	response.JSON(w, http.StatusOK, map[string]string{"message": "password changed successfully"})
}
