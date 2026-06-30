package departments

import (
	"encoding/json"
	"net/http"

	"pms/backend/pkg/response"
	"pms/backend/pkg/validator"

	"github.com/go-chi/chi/v5"
)

type Handler struct{ repo *Repository }

func NewHandler(repo *Repository) *Handler { return &Handler{repo: repo} }

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	depts, err := h.repo.List()
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	response.JSON(w, http.StatusOK, depts)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "invalid request body", "")
		return
	}
	if ve := validator.Validate(req); ve != nil {
		response.Error(w, http.StatusUnprocessableEntity, "VALIDATION_ERROR", ve.Message, ve.Field)
		return
	}
	d, err := h.repo.Create(&req)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	response.JSON(w, http.StatusCreated, d)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req UpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "invalid request body", "")
		return
	}
	d, err := h.repo.Update(id, &req)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	response.JSON(w, http.StatusOK, d)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.SoftDelete(id); err != nil {
		response.Error(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
		return
	}
	response.NoContent(w)
}
