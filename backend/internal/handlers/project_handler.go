package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/pms/backend/internal/middleware"
	"github.com/pms/backend/internal/models"
	"github.com/pms/backend/internal/services"
	"github.com/pms/backend/pkg/utils"
)

type ProjectHandler struct {
	projectSvc *services.ProjectService
	auditSvc   *services.AuditService
	fileSvc    *services.FileService
}

func NewProjectHandler(ps *services.ProjectService, as *services.AuditService, fs *services.FileService) *ProjectHandler {
	return &ProjectHandler{projectSvc: ps, auditSvc: as, fileSvc: fs}
}

func (h *ProjectHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)

	var req services.CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "Invalid request body")
		return
	}
	if req.PONumber == "" || req.ProjectName == "" || req.ClientName == "" {
		utils.BadRequest(w, "po_number, project_name, and client_name are required")
		return
	}

	project, err := h.projectSvc.CreateProject(orgID, empID, req)
	if err != nil {
		// Catch FK violation — means the token's employee_id doesn't exist in DB.
		// ValidateEmployee middleware should prevent this, but guard here too.
		if strings.Contains(err.Error(), "foreign key") || strings.Contains(err.Error(), "fkey") {
			utils.Unauthorized(w, "Session invalid — please log in again")
			return
		}
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Created(w, project)
}

func (h *ProjectHandler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid project ID")
		return
	}

	var body struct {
		services.CreateProjectRequest
		RevisionReason string `json:"revision_reason"`
		ClientRequest  string `json:"client_request"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		utils.BadRequest(w, "Invalid request body")
		return
	}
	if body.RevisionReason == "" {
		utils.BadRequest(w, "revision_reason is required when updating a project")
		return
	}

	project, err := h.projectSvc.UpdateProject(orgID, empID, projectID, body.CreateProjectRequest, body.RevisionReason, body.ClientRequest)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, project)
}

func (h *ProjectHandler) GetProject(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid project ID")
		return
	}

	project, err := h.projectSvc.GetProject(projectID)
	if err != nil {
		utils.NotFound(w, err.Error())
		return
	}
	utils.Success(w, project)
}

func (h *ProjectHandler) ListProjects(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	p := utils.GetPagination(r)
	status := r.URL.Query().Get("status")

	projects, total, err := h.projectSvc.ListProjects(orgID, status, p.Search, p.Page, p.PageSize)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, utils.BuildPaginatedResponse(projects, total, p.Page, p.PageSize))
}

func (h *ProjectHandler) UpdateProjectStatus(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid project ID")
		return
	}

	var req struct {
		Status models.ProjectStatus `json:"status"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	actorID := middleware.GetEmployeeID(r)
	if err := h.projectSvc.UpdateProjectStatus(projectID, req.Status, actorID); err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, map[string]string{"status": string(req.Status)})
}

func (h *ProjectHandler) GetRevisions(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid project ID")
		return
	}

	revisions, err := h.projectSvc.GetProjectRevisions(projectID)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, revisions)
}

func (h *ProjectHandler) GetTimeline(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid project ID")
		return
	}
	p := utils.GetPagination(r)

	logs, total, err := h.auditSvc.GetProjectTimeline(projectID, p.Page, p.PageSize)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, utils.BuildPaginatedResponse(logs, total, p.Page, p.PageSize))
}

// UploadDrawing uploads a drawing file to S3 and attaches it as the project's primary drawing.
func (h *ProjectHandler) UploadDrawing(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid project ID")
		return
	}

	if h.fileSvc == nil {
		utils.InternalError(w, "File service unavailable")
		return
	}

	r.ParseMultipartForm(50 << 20)
	file, header, err := r.FormFile("file")
	if err != nil {
		utils.BadRequest(w, "file is required")
		return
	}
	defer file.Close()

	asset, err := h.fileSvc.UploadFile(orgID, empID, &projectID, models.FileOwnerProject, projectID, file, header)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}

	// Link as the drawing
	if err := h.projectSvc.AttachDrawingFile(projectID, asset.ID); err != nil {
		utils.InternalError(w, err.Error())
		return
	}

	utils.Created(w, asset)
}

// GetProjectRestricted returns only the fields a Layer 3 user should see.
func (h *ProjectHandler) GetProjectRestricted(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid project ID")
		return
	}
	deptID := middleware.GetDepartmentID(r)
	if deptID == nil {
		utils.BadRequest(w, "No department assigned")
		return
	}

	result, err := h.projectSvc.GetProjectRestricted(projectID, *deptID)
	if err != nil {
		utils.NotFound(w, err.Error())
		return
	}
	utils.Success(w, result)
}
