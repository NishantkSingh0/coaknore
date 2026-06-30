package response

import (
	"encoding/json"
	"net/http"
)

// Envelope is the standard API response wrapper.
type Envelope struct {
	Success   bool        `json:"success"`
	Data      interface{} `json:"data,omitempty"`
	Error     *APIError   `json:"error,omitempty"`
	RequestID string      `json:"request_id,omitempty"`
}

// APIError is the standard error payload.
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
}

// JSON writes a JSON response with the given status code.
func JSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	env := Envelope{Success: status < 400, Data: data}
	_ = json.NewEncoder(w).Encode(env)
}

// Error writes a structured error response.
func Error(w http.ResponseWriter, status int, code, message, field string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	env := Envelope{
		Success: false,
		Error:   &APIError{Code: code, Message: message, Field: field},
	}
	_ = json.NewEncoder(w).Encode(env)
}

// NoContent writes a 204 with no body.
func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}
