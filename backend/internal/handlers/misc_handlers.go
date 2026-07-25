package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/pms/backend/internal/middleware"
	"github.com/pms/backend/internal/models"
	"github.com/pms/backend/internal/services"
	"github.com/pms/backend/pkg/utils"
)

// ============================================================
// REWORK HANDLER
// ============================================================

type ReworkHandler struct {
	reworkSvc *services.ReworkService
	fileSvc   *services.FileService
}

func NewReworkHandler(rs *services.ReworkService, fs *services.FileService) *ReworkHandler {
	return &ReworkHandler{reworkSvc: rs, fileSvc: fs}
}

func (h *ReworkHandler) RequestRework(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	deptID := middleware.GetDepartmentID(r)
	projectID, err := uuid.Parse(chi.URLParam(r, "projectId"))
	if err != nil {
		utils.BadRequest(w, "Invalid project ID")
		return
	}
	if deptID == nil {
		utils.BadRequest(w, "You must belong to a department")
		return
	}

	var req services.CreateReworkRequest
	json.NewDecoder(r.Body).Decode(&req)

	rework, err := h.reworkSvc.RequestRework(orgID, projectID, *deptID, empID, req)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Created(w, rework)
}

func (h *ReworkHandler) ApproveRework(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	reworkID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid rework ID")
		return
	}

	var req services.ApproveReworkRequest
	json.NewDecoder(r.Body).Decode(&req)

	rework, err := h.reworkSvc.ApproveRework(orgID, reworkID, empID, req)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, rework)
}

func (h *ReworkHandler) RejectRework(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	reworkID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid rework ID")
		return
	}

	var req struct {
		Notes string `json:"notes"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if err := h.reworkSvc.RejectRework(orgID, reworkID, empID, req.Notes); err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, map[string]string{"message": "Rework request rejected"})
}

func (h *ReworkHandler) GetRework(w http.ResponseWriter, r *http.Request) {
	reworkID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid rework ID")
		return
	}

	rework, err := h.reworkSvc.GetRework(reworkID)
	if err != nil {
		utils.NotFound(w, err.Error())
		return
	}

	if h.fileSvc != nil {
		rework.Files, _ = h.fileSvc.GetFilesByOwner(models.FileOwnerRework, reworkID)
	}
	utils.Success(w, rework)
}

func (h *ReworkHandler) ListReworks(w http.ResponseWriter, r *http.Request) {
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

	reworks, total, err := h.reworkSvc.ListReworks(orgID, projectID, status, p.Page, p.PageSize)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, utils.BuildPaginatedResponse(reworks, total, p.Page, p.PageSize))
}

// ============================================================
// DAILY REPORT HANDLER
// ============================================================

type ReportHandler struct {
	reportSvc *services.DailyReportService
	fileSvc   *services.FileService
}

func NewReportHandler(rs *services.DailyReportService, fs *services.FileService) *ReportHandler {
	return &ReportHandler{reportSvc: rs, fileSvc: fs}
}

func (h *ReportHandler) CreateReport(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	deptID := middleware.GetDepartmentID(r)
	if deptID == nil {
		utils.BadRequest(w, "You must belong to a department to submit reports")
		return
	}

	var req services.CreateReportRequest
	json.NewDecoder(r.Body).Decode(&req)

	report, err := h.reportSvc.CreateReport(orgID, *deptID, empID, req)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Created(w, report)
}

func (h *ReportHandler) GetReport(w http.ResponseWriter, r *http.Request) {
	reportID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid report ID")
		return
	}

	report, err := h.reportSvc.GetReport(reportID)
	if err != nil {
		utils.NotFound(w, err.Error())
		return
	}

	if h.fileSvc != nil {
		report.Files, _ = h.fileSvc.GetFilesByOwner(models.FileOwnerDailyReport, reportID)
	}
	utils.Success(w, report)
}

func (h *ReportHandler) ListReports(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	p := utils.GetPagination(r)

	var projectID *uuid.UUID
	if pidStr := r.URL.Query().Get("project_id"); pidStr != "" {
		id, err := uuid.Parse(pidStr)
		if err == nil {
			projectID = &id
		}
	}

	var deptID *uuid.UUID
	if middleware.IsLayerThree(r) {
		deptID = middleware.GetDepartmentID(r)
	} else if didStr := r.URL.Query().Get("department_id"); didStr != "" {
		id, err := uuid.Parse(didStr)
		if err == nil {
			deptID = &id
		}
	}

	dateFrom := r.URL.Query().Get("date_from")
	dateTo := r.URL.Query().Get("date_to")

	reports, total, err := h.reportSvc.ListReports(orgID, projectID, deptID, dateFrom, dateTo, p.Page, p.PageSize)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}

	// Load files for each report if file service is available
	if h.fileSvc != nil {
		for i := range reports {
			files, err := h.fileSvc.GetFilesByOwner(models.FileOwnerDailyReport, reports[i].ID)
			if err != nil {
				// Log error but continue - don't fail the entire request
				fmt.Printf("Error loading files for report %s: %v\n", reports[i].ID, err)
			} else {
				reports[i].Files = files
			}
		}
	} else {
		fmt.Println("Warning: File service is nil - files will not be loaded")
	}

	utils.Success(w, utils.BuildPaginatedResponse(reports, total, p.Page, p.PageSize))
}

func (h *ReportHandler) UploadReportFile(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	reportID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid report ID")
		return
	}

	r.ParseMultipartForm(50 << 20)
	file, header, err := r.FormFile("file")
	if err != nil {
		utils.BadRequest(w, "file is required")
		return
	}
	defer file.Close()

	asset, err := h.fileSvc.UploadFile(orgID, empID, nil, models.FileOwnerDailyReport, reportID, file, header)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Created(w, asset)
}

// ============================================================
// MATERIAL HANDLER
// ============================================================

type MaterialHandler struct {
	matSvc  *services.MaterialService
	fileSvc *services.FileService
}

func NewMaterialHandler(ms *services.MaterialService, fs *services.FileService) *MaterialHandler {
	return &MaterialHandler{matSvc: ms, fileSvc: fs}
}

func (h *MaterialHandler) CreateRequisition(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	deptID := middleware.GetDepartmentID(r)
	if deptID == nil {
		utils.BadRequest(w, "You must belong to a department")
		return
	}

	var req services.CreateMaterialRequest
	json.NewDecoder(r.Body).Decode(&req)

	mat, err := h.matSvc.CreateRequisition(orgID, *deptID, empID, req)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Created(w, mat)
}

func (h *MaterialHandler) ReviewRequisition(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	matID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid requisition ID")
		return
	}

	var req struct {
		Approve bool   `json:"approve"`
		Notes   string `json:"notes"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if err := h.matSvc.ReviewRequisition(orgID, matID, empID, req.Approve, req.Notes); err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, map[string]string{"message": "Requisition reviewed"})
}

func (h *MaterialHandler) GetRequisition(w http.ResponseWriter, r *http.Request) {
	matID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid requisition ID")
		return
	}

	mat, err := h.matSvc.GetRequisition(matID)
	if err != nil {
		utils.NotFound(w, err.Error())
		return
	}

	if h.fileSvc != nil {
		mat.Files, _ = h.fileSvc.GetFilesByOwner(models.FileOwnerMaterial, matID)
	}
	utils.Success(w, mat)
}

func (h *MaterialHandler) ListRequisitions(w http.ResponseWriter, r *http.Request) {
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
	if middleware.IsLayerThree(r) {
		deptID = middleware.GetDepartmentID(r)
	}

	mats, total, err := h.matSvc.ListRequisitions(orgID, projectID, deptID, status, p.Page, p.PageSize)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, utils.BuildPaginatedResponse(mats, total, p.Page, p.PageSize))
}

// ============================================================
// NOTIFICATION HANDLER
// ============================================================

type NotificationHandler struct {
	notifSvc *services.NotificationService
}

func NewNotificationHandler(ns *services.NotificationService) *NotificationHandler {
	return &NotificationHandler{notifSvc: ns}
}

func (h *NotificationHandler) GetNotifications(w http.ResponseWriter, r *http.Request) {
	empID := middleware.GetEmployeeID(r)
	p := utils.GetPagination(r)
	unreadOnly := r.URL.Query().Get("unread") == "true"

	notifs, total, err := h.notifSvc.GetNotifications(empID, unreadOnly, p.Page, p.PageSize)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, utils.BuildPaginatedResponse(notifs, total, p.Page, p.PageSize))
}

func (h *NotificationHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	empID := middleware.GetEmployeeID(r)
	notifID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid notification ID")
		return
	}

	h.notifSvc.MarkRead(notifID, empID)
	utils.Success(w, map[string]string{"message": "Marked as read"})
}

func (h *NotificationHandler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	empID := middleware.GetEmployeeID(r)
	h.notifSvc.MarkAllRead(empID)
	utils.Success(w, map[string]string{"message": "All marked as read"})
}

func (h *NotificationHandler) GetUnreadCount(w http.ResponseWriter, r *http.Request) {
	empID := middleware.GetEmployeeID(r)
	count := h.notifSvc.GetUnreadCount(empID)
	utils.Success(w, map[string]int{"count": count})
}

func (h *NotificationHandler) DeleteReadNotifications(w http.ResponseWriter, r *http.Request) {
	empID := middleware.GetEmployeeID(r)
	err := h.notifSvc.DeleteReadNotifications(empID)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, map[string]string{"message": "Read notifications deleted"})
}

// ============================================================
// SEARCH HANDLER
// ============================================================

type SearchHandler struct {
	searchSvc *services.SearchService
}

func NewSearchHandler(ss *services.SearchService) *SearchHandler {
	return &SearchHandler{searchSvc: ss}
}

func (h *SearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	p := utils.GetPagination(r)

	var projectID *uuid.UUID
	if pidStr := r.URL.Query().Get("project_id"); pidStr != "" {
		id, err := uuid.Parse(pidStr)
		if err == nil {
			projectID = &id
		}
	}

	var types []string
	if t := r.URL.Query().Get("types"); t != "" {
		types = splitComma(t)
	}

	results, total, err := h.searchSvc.Search(services.SearchParams{
		Query:     p.Search,
		OrgID:     orgID,
		Types:     types,
		ProjectID: projectID,
		DateFrom:  r.URL.Query().Get("date_from"),
		DateTo:    r.URL.Query().Get("date_to"),
		Status:    r.URL.Query().Get("status"),
		Page:      p.Page,
		PageSize:  p.PageSize,
	})
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, utils.BuildPaginatedResponse(results, total, p.Page, p.PageSize))
}

func (h *SearchHandler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	stats, err := h.searchSvc.GetDashboardStats(orgID)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, stats)
}

func splitComma(s string) []string {
	var result []string
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			part := s[start:i]
			if part != "" {
				result = append(result, part)
			}
			start = i + 1
		}
	}
	return result
}
