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

type QueryHandler struct {
	querySvc *services.QueryService
	fileSvc  *services.FileService
}

func NewQueryHandler(qs *services.QueryService, fs *services.FileService) *QueryHandler {
	return &QueryHandler{querySvc: qs, fileSvc: fs}
}

func (h *QueryHandler) CreateQuery(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)

	var req services.CreateQueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.BadRequest(w, "Invalid request body")
		return
	}

	queries, err := h.querySvc.CreateQuery(orgID, empID, req)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Created(w, queries)
}

func (h *QueryHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	queryID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid query ID")
		return
	}

	var req struct {
		Message string `json:"message"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	msg, err := h.querySvc.SendMessage(orgID, queryID, empID, req.Message)
	if err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Created(w, msg)
}

func (h *QueryHandler) UploadQueryFile(w http.ResponseWriter, r *http.Request) {
	orgID := middleware.GetOrgID(r)
	empID := middleware.GetEmployeeID(r)
	queryID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid query ID")
		return
	}

	r.ParseMultipartForm(50 << 20)
	file, header, err := r.FormFile("file")
	if err != nil {
		utils.BadRequest(w, "file is required")
		return
	}
	defer file.Close()

	asset, err := h.fileSvc.UploadFile(orgID, empID, nil, models.FileOwnerQuery, queryID, file, header)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Created(w, asset)
}

func (h *QueryHandler) MarkResolved(w http.ResponseWriter, r *http.Request) {
	empID := middleware.GetEmployeeID(r)
	queryID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid query ID")
		return
	}

	if err := h.querySvc.MarkResolved(queryID, empID); err != nil {
		utils.BadRequest(w, err.Error())
		return
	}
	utils.Success(w, map[string]string{"message": "Marked as resolved"})
}

func (h *QueryHandler) GetQuery(w http.ResponseWriter, r *http.Request) {
	empID := middleware.GetEmployeeID(r)
	queryID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		utils.BadRequest(w, "Invalid query ID")
		return
	}

	query, err := h.querySvc.GetQuery(queryID)
	if err != nil {
		utils.NotFound(w, err.Error())
		return
	}

	// Authorization: only participants can view
	if query.SenderID != empID && query.RecipientID != empID {
		if !middleware.IsAdmin(r) {
			utils.Forbidden(w, "Access denied")
			return
		}
	}

	// Attach uploaded files to the nearest preceding message from the same sender
	if h.fileSvc != nil {
		query.Messages = h.enrichMessagesWithFiles(queryID, query.Messages)
	}

	utils.Success(w, query)
}

// enrichMessagesWithFiles attaches each file asset to the message from the same
// uploader that immediately precedes the file's upload time. If no preceding
// message exists, the file is attached to the first message.
func (h *QueryHandler) enrichMessagesWithFiles(queryID uuid.UUID, messages []models.QueryMessage) []models.QueryMessage {
	if len(messages) == 0 {
		return messages
	}

	files, err := h.fileSvc.GetFilesByOwner(models.FileOwnerQuery, queryID)
	if err != nil || len(files) == 0 {
		return messages
	}

	for _, f := range files {
		// Find the last message sent at or before this file was uploaded,
		// preferring the same uploader. Fall back to the last message overall.
		bestIdx := 0
		for i, msg := range messages {
			if !msg.CreatedAt.After(f.CreatedAt) {
				bestIdx = i
			}
		}
		messages[bestIdx].Files = append(messages[bestIdx].Files, f)
	}
	return messages
}

func (h *QueryHandler) ListQueries(w http.ResponseWriter, r *http.Request) {
	empID := middleware.GetEmployeeID(r)
	p := utils.GetPagination(r)
	status := r.URL.Query().Get("status")

	var projectID *uuid.UUID
	if pidStr := r.URL.Query().Get("project_id"); pidStr != "" {
		id, err := uuid.Parse(pidStr)
		if err == nil {
			projectID = &id
		}
	}

	queries, total, err := h.querySvc.ListQueries(empID, projectID, status, p.Page, p.PageSize)
	if err != nil {
		utils.InternalError(w, err.Error())
		return
	}
	utils.Success(w, utils.BuildPaginatedResponse(queries, total, p.Page, p.PageSize))
}
