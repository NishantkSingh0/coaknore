package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/pms/backend/internal/middleware"
	"github.com/pms/backend/internal/services"
	"github.com/pms/backend/pkg/utils"
)

type RoutingHandler struct {
	routingSvc *services.RoutingService
}

func NewRoutingHandler(rs *services.RoutingService) *RoutingHandler {
	return &RoutingHandler{routingSvc: rs}
}

func (h *RoutingHandler) CreateRouting(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	projectID, err := uuid.Parse(chi.URLParam(r, "projectId"))
	if err != nil {
		utils.BadRequest(w, "Invalid project ID")
		return
	}

	var req services.CreateRoutingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "Invalid request body")
		return
	}

	routing, err := h.routingSvc.CreateRouting(orgID, projectID, empID, req)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Created(w, routing)
}

func (h *RoutingHandler) UpdateRouting(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	routingID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid routing ID")
		return
	}

	var req services.UpdateRoutingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "Invalid request body")
		return
	}

	// Retrieve editor info from token context
	editorEmail := middleware.GetEditorEmail(r)
	editorName := middleware.GetEditorName(r)

	routing, err := h.routingSvc.UpdateRouting(orgID, routingID, empID, req, editorEmail, editorName)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, routing)
}

func (h *RoutingHandler) GetEditTimeline(w http.ResponseWriter, r *http.Request) {
	routingID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid routing ID")
		return
	}

	timeline, err := h.routingSvc.GetEditTimeline(routingID)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, timeline)
}

func (h *RoutingHandler) PublishRouting(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	routingID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid routing ID")
		return
	}

	routing, err := h.routingSvc.PublishRouting(orgID, routingID, empID)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, routing)
}

func (h *RoutingHandler) GetRouting(w http.ResponseWriter, r *http.Request) {
	routingID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid routing ID")
		return
	}

	routing, err := h.routingSvc.GetRouting(routingID)
	if err != nil {
		utils.NotFound(w, err.Error())
		return
	}
	utils.Success(w, routing)
}

func (h *RoutingHandler) ListProjectRoutings(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(chi.URLParam(r, "projectId"))
	if err != nil {
		utils.BadRequest(w, "Invalid project ID")
		return
	}

	routings, err := h.routingSvc.ListProjectRoutings(projectID)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, routings)
}

func (h *RoutingHandler) GetTemplates(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	templates, err := h.routingSvc.GetRoutingTemplates(orgID)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, templates)
}

func (h *RoutingHandler) GetUpcomingTasks(w http.ResponseWriter, r *http.Request) {
	deptID, err := uuid.Parse(chi.URLParam(r, "departmentId"))
	if err != nil {
		utils.BadRequest(w, "Invalid department ID")
		return
	}

	upcomingTasks, err := h.routingSvc.GetUpcomingTasksForDepartment(deptID)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, upcomingTasks)
}
