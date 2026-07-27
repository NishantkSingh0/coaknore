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

type TaskHandler struct {
	taskSvc *services.TaskService
	fileSvc *services.FileService
}

func NewTaskHandler(ts *services.TaskService, fs *services.FileService) *TaskHandler {
	return &TaskHandler{taskSvc: ts, fileSvc: fs}
}

func (h *TaskHandler) GetTask(w http.ResponseWriter, r *http.Request) {
	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid task ID")
		return
	}

	task, err := h.taskSvc.GetTask(taskID)
	if err != nil {
		utils.NotFound(w, err.Error())
		return
	}

	// Attach files
	if h.fileSvc != nil {
		task.Subtasks, _ = h.taskSvc.GetSubtasks(taskID)
		for i, st := range task.Subtasks {
			files, _ := h.fileSvc.GetFilesByOwner(models.FileOwnerSubtask, st.ID)
			task.Subtasks[i].Files = files
		}
		// Attach department task files
		deptFiles, _ := h.fileSvc.GetFilesByOwner(models.FileOwnerDepartmentTask, taskID)
		task.DepartmentFiles = deptFiles
	}
	utils.Success(w, task)
}

func (h *TaskHandler) GetProjectTasks(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(chi.URLParam(r, "projectId"))
	if err != nil {
		utils.BadRequest(w, "Invalid project ID")
		return
	}

	var deptIDPtr *uuid.UUID
	if deptIDStr := r.URL.Query().Get("department_id"); deptIDStr != "" {
		id, err := uuid.Parse(deptIDStr)
		if err == nil {
			deptIDPtr = &id
		}
	}

	// Layer3 can only see their own department's tasks
	if middleware.IsLayerThree(r) {
		deptID := middleware.GetDepartmentID(r)
		deptIDPtr = deptID
	}

	tasks, err := h.taskSvc.GetProjectTasks(projectID, deptIDPtr)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, tasks)
}

func (h *TaskHandler) SetTaskDates(w http.ResponseWriter, r *http.Request) {
	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid task ID")
		return
	}

	var req services.SetTaskDatesRequest
	json.NewDecoder(r.Body).Decode(&req)

	actorID := middleware.GetEmployeeID(r)
	task, err := h.taskSvc.SetTaskDates(taskID, actorID, req)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, task)
}

func (h *TaskHandler) UpdateTaskStatus(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid task ID")
		return
	}

	var req struct {
		Status models.TaskStatus `json:"status"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	actorID := middleware.GetEmployeeID(r)
	if err := h.taskSvc.UpdateTaskStatus(orgID, taskID, actorID, req.Status); err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, map[string]string{"status": string(req.Status)})
}

func (h *TaskHandler) AssignEmployees(w http.ResponseWriter, r *http.Request) {
	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid task ID")
		return
	}

	var req struct {
		EmployeeIDs []string `json:"employee_ids"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if err := h.taskSvc.AssignEmployees(taskID, req.EmployeeIDs); err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, map[string]string{"message": "Employees assigned"})
}

func (h *TaskHandler) GetDepartmentTasks(w http.ResponseWriter, r *http.Request) {
	deptID := middleware.GetDepartmentID(r)
	if deptID == nil {
		utils.BadRequest(w, "No department assigned")
		return
	}
	p := utils.GetPagination(r)
	status := r.URL.Query().Get("status")

	tasks, total, err := h.taskSvc.GetDepartmentTasks(*deptID, status, p.Page, p.PageSize)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, utils.BuildPaginatedResponse(tasks, total, p.Page, p.PageSize))
}

// Subtask handlers

func (h *TaskHandler) CreateSubtask(w http.ResponseWriter, r *http.Request) {
	taskID, err := uuid.Parse(chi.URLParam(r, "taskId"))
	if err != nil {
		utils.BadRequest(w, "Invalid task ID")
		return
	}

	var req services.CreateSubtaskRequest
	json.NewDecoder(r.Body).Decode(&req)
	if req.Title == "" {
		utils.BadRequest(w, "title is required")
		return
	}

	st, err := h.taskSvc.CreateSubtask(taskID, req)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Created(w, st)
}

func (h *TaskHandler) CompleteSubtask(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	subtaskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid subtask ID")
		return
	}

	var req struct {
		Notes string `json:"notes"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	completedBy := middleware.GetEmployeeID(r)
	if err := h.taskSvc.CompleteSubtask(orgID, subtaskID, completedBy, req.Notes); err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, map[string]string{"message": "Subtask completed"})
}

func (h *TaskHandler) UpdateSubtask(w http.ResponseWriter, r *http.Request) {
	subtaskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid subtask ID")
		return
	}

	var req struct {
		Title      string  `json:"title"`
		Description string `json:"description"`
		Notes      string  `json:"notes"`
		AssignedTo string  `json:"assigned_to"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	var assignedTo *uuid.UUID
	if req.AssignedTo != "" {
		id, err := uuid.Parse(req.AssignedTo)
		if err == nil {
			assignedTo = &id
		}
	}

	if err := h.taskSvc.UpdateSubtask(subtaskID, req.Title, req.Description, req.Notes, assignedTo); err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, map[string]string{"message": "Subtask updated"})
}

func (h *TaskHandler) UploadSubtaskProof(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	subtaskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid subtask ID")
		return
	}

	r.ParseMultipartForm(50 << 20)
	file, header, err := r.FormFile("file")
	if err != nil {
		utils.BadRequest(w, "file is required")
		return
	}
	defer file.Close()

	asset, err := h.fileSvc.UploadFile(orgID, empID, nil, models.FileOwnerSubtask, subtaskID, file, header)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}

	// Auto-complete subtask now that proof is uploaded
	_ = h.taskSvc.CompleteSubtask(orgID, subtaskID, empID, "Proof uploaded")

	utils.Created(w, asset)
}

func (h *TaskHandler) UploadDepartmentTaskFile(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	layer := middleware.GetLayer(r)
	
	// Only Layer1, Layer2, and SuperAdmin can upload department task files
	if layer != models.LayerOne && layer != models.LayerTwo && layer != models.LayerSuperAdmin {
		utils.Forbidden(w, "Only Layer1, Layer2, and SuperAdmin can upload department task files")
		return
	}
	
	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid task ID")
		return
	}

	r.ParseMultipartForm(50 << 20)
	file, header, err := r.FormFile("file")
	if err != nil {
		utils.BadRequest(w, "file is required")
		return
	}
	defer file.Close()

	asset, err := h.fileSvc.UploadFile(orgID, empID, nil, models.FileOwnerDepartmentTask, taskID, file, header)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}

	utils.Created(w, asset)
}

func (h *TaskHandler) SetExpectedCompletionDate(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	layer := middleware.GetLayer(r)
	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid task ID")
		return
	}

	var req struct {
		Date string `json:"expected_completion_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Date == "" {
		utils.BadRequest(w, "expected_completion_date is required (YYYY-MM-DD)")
		return
	}

	// Allow Layer1/Level2/SuperAdmin to override date lock
	overrideLock := layer == models.LayerOne || layer == models.LayerTwo || layer == models.LayerSuperAdmin

	// Debug logging
	fmt.Printf("DEBUG: SetExpectedCompletionDate - Layer: %s, OverrideLock: %v, TaskID: %s\n", layer, overrideLock, taskID)

	task, err := h.taskSvc.SetExpectedCompletionDate(orgID, taskID, empID, req.Date, overrideLock)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, task)
}
