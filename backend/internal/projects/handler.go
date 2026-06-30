package projects

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"pms/backend/internal/auth"
	"pms/backend/internal/files"
	"pms/backend/internal/notifications"
	"pms/backend/pkg/response"
	"pms/backend/pkg/validator"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	repo   *Repository
	notifs *notifications.Service
	s3     *files.S3Client
}

func NewHandler(repo *Repository, notifs *notifications.Service, s3 *files.S3Client) *Handler {
	return &Handler{repo: repo, notifs: notifs, s3: s3}
}

func (h *Handler) enrichProject(ctx context.Context, p *Project) {
	if h.s3 != nil {
		p.ImageURL = h.s3.ResolveURL(ctx, p.ImageURL)
	}
}

func (h *Handler) enrichProjects(ctx context.Context, projects []Project) {
	for i := range projects {
		h.enrichProject(ctx, &projects[i])
	}
}

func (h *Handler) enrichRouting(ctx context.Context, rows []RoutingRow) {
	if h.s3 == nil {
		return
	}
	for i := range rows {
		rows[i].CompletionProofURL = h.s3.ResolveURL(ctx, rows[i].CompletionProofURL)
	}
}

// List GET /projects
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	limit, _ := strconv.Atoi(q.Get("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	f := &ListFilter{
		Status:   q.Get("status"),
		Search:   q.Get("search"),
		DateFrom: q.Get("date_from"),
		DateTo:   q.Get("date_to"),
		Page:     page,
		Limit:    limit,
	}
	projects, total, err := h.repo.List(f)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	h.enrichProjects(r.Context(), projects)
	response.JSON(w, http.StatusOK, map[string]interface{}{
		"projects": projects,
		"total":    total,
		"page":     page,
		"limit":    limit,
	})
}

// GetByID GET /projects/:id
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	p, err := h.repo.GetByID(id)
	if err != nil {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "project not found", "")
		return
	}
	h.enrichProject(r.Context(), p)
	response.JSON(w, http.StatusOK, p)
}

// Create POST /projects (admin only)
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromCtx(r.Context())
	var req CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "invalid request body", "")
		return
	}
	if ve := validator.Validate(req); ve != nil {
		response.Error(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", ve.Message, ve.Field)
		return
	}
	if h.repo.POExists(req.PONumber) {
		response.Error(w, http.StatusConflict, "DUPLICATE_PO", "PO number already exists", "po_number")
		return
	}
	req.ImageURL = files.StorageKey(req.ImageURL)
	p, err := h.repo.Create(&req, claims.UserID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	h.enrichProject(r.Context(), p)
	// Notify all L2 departments
	go h.notifs.NotifyAllLayer2(p.ID, "", "project_created",
		"New Project Created", "Project "+p.ProjectName+" has been created")

	response.JSON(w, http.StatusCreated, p)
}

// Update PUT /projects/:id (admin or L2-Production)
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req UpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "invalid request body", "")
		return
	}
	if req.ImageURL != nil {
		req.ImageURL = files.StorageKey(req.ImageURL)
	}
	p, err := h.repo.Update(id, &req)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	h.enrichProject(r.Context(), p)
	response.JSON(w, http.StatusOK, p)
}

// Delete DELETE /projects/:id (admin only)
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.SoftDelete(id); err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	response.NoContent(w)
}

// GetRouting GET /projects/:id/routing
func (h *Handler) GetRouting(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := h.repo.GetRouting(id)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	h.enrichRouting(r.Context(), rows)
	response.JSON(w, http.StatusOK, rows)
}

// SetRouting POST /projects/:id/routing
func (h *Handler) SetRouting(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	claims := auth.ClaimsFromCtx(r.Context())

	var req SetRoutingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "invalid request body", "")
		return
	}
	if ve := validator.Validate(req); ve != nil {
		response.Error(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", ve.Message, ve.Field)
		return
	}
	if err := h.repo.SetRouting(id, claims.UserID, req.Routing); err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	p, _ := h.repo.GetByID(id)
	h.enrichProject(r.Context(), p)

	// Notify all L2 + activated L3 depts
	go h.notifs.NotifyAllLayer2(id, "", "project_routed",
		"Project Routed", "Routing has been set for "+p.ProjectName)

	rows, _ := h.repo.GetRouting(id)
	h.enrichRouting(r.Context(), rows)
	response.JSON(w, http.StatusOK, map[string]interface{}{
		"project": p,
		"routing": rows,
	})
}
