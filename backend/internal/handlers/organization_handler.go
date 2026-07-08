package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/pms/backend/internal/middleware"
	"github.com/pms/backend/internal/models"
	"github.com/pms/backend/internal/services"
	"github.com/pms/backend/pkg/utils"
)

type OrganizationHandler struct {
	orgSvc  *services.OrganizationService
	authSvc *services.AuthService
}

func NewOrganizationHandler(orgSvc *services.OrganizationService, authSvc *services.AuthService) *OrganizationHandler {
	return &OrganizationHandler{orgSvc: orgSvc, authSvc: authSvc}
}

// ============================================================
// DEPARTMENTS
// ============================================================

func (h *OrganizationHandler) CreateDepartment(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	var req struct {
		Name        string                  `json:"name"`
		Description string                  `json:"description"`
		Layer       models.DepartmentLayer  `json:"layer"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "Invalid request body")
		return
	}
	if req.Name == "" {
		utils.BadRequest(w, "name is required")
		return
	}
	if req.Layer != models.DeptLayerTwo && req.Layer != models.DeptLayerThree {
		utils.BadRequest(w, "layer must be 'layer2' or 'layer3'")
		return
	}

	dept, err := h.orgSvc.CreateDepartment(orgID, req.Name, req.Description, req.Layer)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Created(w, dept)
}

func (h *OrganizationHandler) UpdateDepartment(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid department ID")
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	dept, err := h.orgSvc.UpdateDepartment(id, req.Name, req.Description)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, dept)
}

func (h *OrganizationHandler) ToggleDepartment(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid department ID")
		return
	}

	var req struct{ Active bool `json:"active"` }
	json.NewDecoder(r.Body).Decode(&req)

	if err := h.orgSvc.ToggleDepartment(id, req.Active); err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, map[string]bool{"active": req.Active})
}

func (h *OrganizationHandler) ListDepartments(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	layer := r.URL.Query().Get("layer")

	depts, err := h.orgSvc.ListDepartments(orgID, layer)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, depts)
}

func (h *OrganizationHandler) GetDepartment(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid department ID")
		return
	}

	dept, err := h.orgSvc.GetDepartment(id)
	if err != nil {
		utils.NotFound(w, err.Error())
		return
	}
	utils.Success(w, dept)
}

// ============================================================
// EMPLOYEES
// ============================================================

func (h *OrganizationHandler) CreateEmployee(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	var req services.CreateEmployeeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "Invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" {
		utils.BadRequest(w, "email, password, first_name, and last_name are required")
		return
	}
	if len(req.Password) < 8 {
		utils.BadRequest(w, "Password must be at least 8 characters")
		return
	}

	emp, err := h.orgSvc.CreateEmployee(orgID, req)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Created(w, emp)
}

func (h *OrganizationHandler) UpdateEmployee(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid employee ID")
		return
	}

	var req services.UpdateEmployeeRequest
	json.NewDecoder(r.Body).Decode(&req)

	emp, err := h.orgSvc.UpdateEmployee(id, req)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, emp)
}

func (h *OrganizationHandler) ToggleEmployee(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid employee ID")
		return
	}

	var req struct{ Active bool `json:"active"` }
	json.NewDecoder(r.Body).Decode(&req)

	if err := h.orgSvc.ToggleEmployee(id, req.Active); err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, map[string]bool{"active": req.Active})
}

func (h *OrganizationHandler) TransferEmployee(w http.ResponseWriter, r *http.Request) {
	empID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid employee ID")
		return
	}

	var req struct {
		DepartmentID string `json:"department_id"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	newDeptID, err := uuid.Parse(req.DepartmentID)
	if err != nil {
		utils.BadRequest(w, "Invalid department_id")
		return
	}

	if err := h.orgSvc.TransferEmployee(empID, newDeptID); err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, map[string]string{"message": "Employee transferred"})
}

func (h *OrganizationHandler) ListEmployees(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	p := utils.GetPagination(r)

	layer := r.URL.Query().Get("layer")
	deptID := r.URL.Query().Get("department_id")
	activeStr := r.URL.Query().Get("active")

	var active *bool
	if activeStr != "" {
		a, _ := strconv.ParseBool(activeStr)
		active = &a
	}

	employees, total, err := h.orgSvc.ListEmployees(orgID, p.Search, layer, deptID, active, p.Page, p.PageSize)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, utils.BuildPaginatedResponse(employees, total, p.Page, p.PageSize))
}

func (h *OrganizationHandler) GetEmployee(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid employee ID")
		return
	}

	emp, err := h.orgSvc.GetEmployee(id)
	if err != nil {
		utils.NotFound(w, err.Error())
		return
	}
	utils.Success(w, emp)
}

func (h *OrganizationHandler) AdminResetPassword(w http.ResponseWriter, r *http.Request) {
	empID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid employee ID")
		return
	}

	var req struct {
		NewPassword string `json:"new_password"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if len(req.NewPassword) < 8 {
		utils.BadRequest(w, "Password must be at least 8 characters")
		return
	}

	adminID := middleware.GetEmployeeID(r)
	if err := h.authSvc.AdminResetPassword(adminID, empID, req.NewPassword); err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, map[string]string{"message": "Password reset successfully"})
}

func (h *OrganizationHandler) SearchEmployees(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	layer := middleware.GetLayer(r)
	deptID := middleware.GetDepartmentID(r)
	query := r.URL.Query().Get("q")

	employees, err := h.orgSvc.SearchEmployeesByEmail(orgID, query, layer, deptID)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, employees)
}

func (h *OrganizationHandler) GetOrganization(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	org, err := h.orgSvc.GetOrganization(orgID)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, org)
}
