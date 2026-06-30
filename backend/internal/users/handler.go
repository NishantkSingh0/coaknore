package users

import (
	"encoding/json"
	"net/http"

	"pms/backend/internal/auth"
	"pms/backend/internal/files"
	"pms/backend/pkg/response"
	"pms/backend/pkg/validator"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
)

type Handler struct {
	repo *Repository
	s3   *files.S3Client
}

func NewHandler(repo *Repository, s3 *files.S3Client) *Handler {
	return &Handler{repo: repo, s3: s3}
}

func (h *Handler) enrichUser(r *http.Request, u *User) {
	if h.s3 != nil {
		u.AvatarURL = h.s3.ResolveURL(r.Context(), u.Addon)
	} else {
		u.AvatarURL = u.Addon
	}
}

func (h *Handler) enrichUsers(r *http.Request, users []User) {
	for i := range users {
		h.enrichUser(r, &users[i])
	}
}

// List GET /users  (admin only)
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	users, err := h.repo.List()
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	h.enrichUsers(r, users)
	response.JSON(w, http.StatusOK, users)
}

// GetByID GET /users/:id
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	claims := auth.ClaimsFromCtx(r.Context())
	// Non-admins can only view their own profile
	if claims.Role != "admin" && claims.UserID != id {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "access denied", "")
		return
	}
	u, err := h.repo.GetByID(id)
	if err != nil {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "user not found", "")
		return
	}
	h.enrichUser(r, u)
	response.JSON(w, http.StatusOK, u)
}

// Create POST /users  (admin only)
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "invalid request body", "")
		return
	}
	if ve := validator.Validate(req); ve != nil {
		response.Error(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", ve.Message, ve.Field)
		return
	}
	if h.repo.EmailExists(req.Email) {
		response.Error(w, http.StatusConflict, "EMAIL_EXISTS", "email already in use", "email")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "failed to process password", "")
		return
	}
	u, err := h.repo.CreateFull(req.Name, req.Email, string(hash), req.Phone, req.Role, req.DepartmentID, req.Addon)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	h.enrichUser(r, u)
	response.JSON(w, http.StatusCreated, u)
}

// Update PUT /users/:id
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	claims := auth.ClaimsFromCtx(r.Context())
	if claims.Role != "admin" && claims.UserID != id {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "access denied", "")
		return
	}
	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "invalid request body", "")
		return
	}
	u, err := h.repo.Update(id, &req)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	h.enrichUser(r, u)
	response.JSON(w, http.StatusOK, u)
}

// ResetPassword PUT /users/:id/password (admin only)
func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "invalid request body", "")
		return
	}
	if ve := validator.Validate(req); ve != nil {
		response.Error(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", ve.Message, ve.Field)
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "failed to process password", "")
		return
	}
	if err := h.repo.ResetPassword(id, string(hash)); err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "password changed successfully"})
}

// Delete DELETE /users/:id  (admin only)
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.HardDelete(id); err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	response.NoContent(w)
}
