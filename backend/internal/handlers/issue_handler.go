package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/pms/backend/internal/middleware"
	"github.com/pms/backend/internal/models"
	"github.com/pms/backend/internal/services"
	"github.com/pms/backend/pkg/utils"
)

type IssueHandler struct {
	issueSvc *services.IssueService
	fileSvc  *services.FileService
}

func NewIssueHandler(is *services.IssueService, fs *services.FileService) *IssueHandler {
	return &IssueHandler{issueSvc: is, fileSvc: fs}
}

func (h *IssueHandler) RaiseIssue(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	deptID := middleware.GetDepartmentID(r)
	projectID, err := uuid.Parse(chi.URLParam(r, "projectId"))
	if err != nil {
		utils.BadRequest(w, "Invalid project ID")
		return
	}
	if deptID == nil {
		utils.BadRequest(w, "You must belong to a department to raise an issue")
		return
	}

	var req services.CreateIssueRequest
	json.NewDecoder(r.Body).Decode(&req)

	issue, err := h.issueSvc.RaiseIssue(orgID, projectID, *deptID, empID, req)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Created(w, issue)
}

func (h *IssueHandler) ReviewIssue(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	issueID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid issue ID")
		return
	}

	var req struct {
		Approve bool   `json:"approve"`
		Notes   string `json:"notes"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if err := h.issueSvc.ReviewIssue(orgID, issueID, empID, req.Approve, req.Notes); err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, map[string]string{"message": "Issue reviewed"})
}

func (h *IssueHandler) ResolveIssue(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	issueID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid issue ID")
		return
	}

	var req struct {
		ResolutionNotes string `json:"resolution_notes"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if err := h.issueSvc.ResolveIssue(orgID, issueID, empID, req.ResolutionNotes); err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, map[string]string{"message": "Issue resolved"})
}

func (h *IssueHandler) GetIssue(w http.ResponseWriter, r *http.Request) {
	issueID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid issue ID")
		return
	}

	issue, err := h.issueSvc.GetIssue(issueID)
	if err != nil {
		utils.NotFound(w, err.Error())
		return
	}

	// Attach files
	if h.fileSvc != nil {
		issue.Files, _ = h.fileSvc.GetFilesByOwner(models.FileOwnerIssue, issueID)
	}
	utils.Success(w, issue)
}

func (h *IssueHandler) ListIssues(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	p := utils.GetPagination(r)
	status := r.URL.Query().Get("status")

	var projectID *uuid.UUID
	if pidStr := r.URL.Query().Get("project_id"); pidStr != "" {
		id, err := uuid.Parse(pidStr)
		if err == nil {
			projectID = &id
		}
	}

	var deptID *uuid.UUID
	// Layer3 can only see their department's issues
	if middleware.IsLayerThree(r) {
		deptID = middleware.GetDepartmentID(r)
	}

	issues, total, err := h.issueSvc.ListIssues(orgID, projectID, deptID, status, p.Page, p.PageSize)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, utils.BuildPaginatedResponse(issues, total, p.Page, p.PageSize))
}

func (h *IssueHandler) UploadIssueFile(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	issueID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid issue ID")
		return
	}

	r.ParseMultipartForm(50 << 20)
	file, header, err := r.FormFile("file")
	if err != nil {
		utils.BadRequest(w, "file is required")
		return
	}
	defer file.Close()

	asset, err := h.fileSvc.UploadFile(orgID, empID, nil, models.FileOwnerIssue, issueID, file, header)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Created(w, asset)
}
