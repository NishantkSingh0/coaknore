package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/pms/backend/internal/middleware"
	"github.com/pms/backend/internal/services"
	"github.com/pms/backend/pkg/utils"
)

type AuthHandler struct {
	authSvc *services.AuthService
	orgSvc  *services.OrganizationService
	fileSvc *services.FileService
}

func NewAuthHandler(authSvc *services.AuthService, orgSvc *services.OrganizationService, fileSvc *services.FileService) *AuthHandler {
	return &AuthHandler{authSvc: authSvc, orgSvc: orgSvc, fileSvc: fileSvc}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req services.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "Invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		utils.BadRequest(w, "Email and password are required")
		return
	}

	resp, err := h.authSvc.Login(req)
	if err != nil {
		utils.Unauthorized(w, err.Error())
		return
	}
	utils.Success(w, resp)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	empID := middleware.GetEmployeeID(r)
	emp, err := h.orgSvc.GetEmployee(empID)
	if err != nil {
		utils.NotFound(w, "Employee not found")
		return
	}
	utils.Success(w, emp)
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	empID := middleware.GetEmployeeID(r)

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "Invalid request body")
		return
	}
	if len(req.NewPassword) < 8 {
		utils.BadRequest(w, "New password must be at least 8 characters")
		return
	}

	if err := h.authSvc.ChangePassword(empID, req.CurrentPassword, req.NewPassword); err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, map[string]string{"message": "Password updated successfully"})
}

func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	h.authSvc.GeneratePasswordResetToken(req.Email)
	utils.Success(w, map[string]string{"message": "If that email exists, a reset link has been sent"})
}

func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if req.Token == "" || req.NewPassword == "" {
		utils.BadRequest(w, "Token and new_password are required")
		return
	}
	if len(req.NewPassword) < 8 {
		utils.BadRequest(w, "Password must be at least 8 characters")
		return
	}

	if err := h.authSvc.ResetPasswordWithToken(req.Token, req.NewPassword); err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, map[string]string{"message": "Password reset successfully"})
}

func (h *AuthHandler) UpdateAvatar(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)

	if h.fileSvc == nil {
		utils.InternalError(w, "File service unavailable")
		return
	}

	// 5 MB limit
	r.ParseMultipartForm(5 << 20)
	file, header, err := r.FormFile("avatar")
	if err != nil {
		utils.BadRequest(w, "avatar is required")
		return
	}
	defer file.Close()

	// Get current employee info to find old avatar
	emp, err := h.orgSvc.GetEmployee(empID)
	if err != nil {
		utils.NotFound(w, "Employee not found")
		return
	}

	// Upload new avatar
	s3URL, err := h.fileSvc.UploadAvatar(orgID, empID, file, header)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}

	// Delete old avatar if present
	if emp.AvatarURL != "" {
		h.fileSvc.DeleteAvatar(emp.AvatarURL)
	}

	// Save new URL to DB
	if err := h.orgSvc.UpdateAvatar(empID, &s3URL); err != nil {
		utils.InternalError(w, err.Error())
		return
	}

	// Retrieve updated employee profile and return it
	updatedEmp, err := h.orgSvc.GetEmployee(empID)
	if err != nil {
		utils.InternalError(w, "Failed to retrieve updated profile")
		return
	}

	utils.Success(w, updatedEmp)
}

func (h *AuthHandler) RemoveAvatar(w http.ResponseWriter, r *http.Request) {
	empID := middleware.GetEmployeeID(r)

	if h.fileSvc == nil {
		utils.InternalError(w, "File service unavailable")
		return
	}

	// Get employee info
	emp, err := h.orgSvc.GetEmployee(empID)
	if err != nil {
		utils.NotFound(w, "Employee not found")
		return
	}

	// Delete avatar from S3
	if emp.AvatarURL != "" {
		h.fileSvc.DeleteAvatar(emp.AvatarURL)
	}

	// Remove avatar URL from DB
	if err := h.orgSvc.UpdateAvatar(empID, nil); err != nil {
		utils.InternalError(w, err.Error())
		return
	}

	// Retrieve updated employee profile and return it
	updatedEmp, err := h.orgSvc.GetEmployee(empID)
	if err != nil {
		utils.InternalError(w, "Failed to retrieve updated profile")
		return
	}

	utils.Success(w, updatedEmp)
}

func (h *AuthHandler) GetAvatarProxy(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	if key == "" {
		utils.BadRequest(w, "key is required")
		return
	}

	if h.fileSvc == nil {
		utils.InternalError(w, "File service unavailable")
		return
	}

	signedURL, err := h.fileSvc.GetSignedURL(key, 1*time.Hour)
	if err != nil {
		utils.InternalError(w, "Failed to generate signed URL")
		return
	}

	http.Redirect(w, r, signedURL, http.StatusTemporaryRedirect)
}

