package projects

import "time"

type Project struct {
	ID               string     `db:"id"                json:"id"`
	PONumber         string     `db:"po_number"         json:"po_number"`
	ProjectName      string     `db:"project_name"      json:"project_name"`
	ReceivingDate    time.Time  `db:"receiving_date"    json:"receiving_date"`
	ImageURL         *string    `db:"image_url"         json:"image_url"`
	Quantity         int        `db:"quantity"          json:"quantity"`
	Rates            int64      `db:"rates"             json:"rates"`
	Dimensions       *string    `db:"dimensions"        json:"dimensions"`
	Remarks          *string    `db:"remarks"           json:"remarks"`
	Specification    *string    `db:"specification"     json:"specification"`
	UpholsteryFinish *string    `db:"upholstery_finish" json:"upholstery_finish"`
	CADURLs          *string    `db:"cad_urls"          json:"cad_urls"`
	PDFURLs          *string    `db:"pdf_urls"          json:"pdf_urls"`
	RenderURLs       *string    `db:"render_urls"       json:"render_urls"`
	JobcardURLs      *string    `db:"jobcard_urls"      json:"jobcard_urls"`
	CurrentStatus    string     `db:"current_status"    json:"current_status"`
	CreatedBy        *string    `db:"created_by"        json:"created_by"`
	RoutingSetAt     *time.Time `db:"routing_set_at"    json:"routing_set_at"`
	CompletedAt      *time.Time `db:"completed_at"      json:"completed_at"`
	Addon            *string    `db:"addon"             json:"addon"`
	CreatedAt        time.Time  `db:"created_at"        json:"created_at"`
	UpdatedAt        time.Time  `db:"updated_at"        json:"updated_at"`
	DeletedAt        *time.Time `db:"deleted_at"        json:"-"`
}

type CreateRequest struct {
	PONumber         string  `json:"po_number"         validate:"required,len=5"`
	ProjectName      string  `json:"project_name"      validate:"required,max=50"`
	ReceivingDate    string  `json:"receiving_date"    validate:"required"`
	ImageURL         *string `json:"image_url"`
	Quantity         int     `json:"quantity"          validate:"required,gt=0"`
	Rates            int64   `json:"rates"             validate:"required,gt=0"`
	Dimensions       *string `json:"dimensions"`
	Remarks          *string `json:"remarks"`
	Specification    *string `json:"specification"`
	UpholsteryFinish *string `json:"upholstery_finish"`
	CADURLs          *string `json:"cad_urls"`
	PDFURLs          *string `json:"pdf_urls"`
	RenderURLs       *string `json:"render_urls"`
	JobcardURLs      *string `json:"jobcard_urls"`
	Addon            *string `json:"addon"`
}

type UpdateRequest struct {
	ProjectName      *string `json:"project_name"`
	ReceivingDate    *string `json:"receiving_date"`
	ImageURL         *string `json:"image_url"`
	Quantity         *int    `json:"quantity"`
	Rates            *int64  `json:"rates"`
	Dimensions       *string `json:"dimensions"`
	Remarks          *string `json:"remarks"`
	Specification    *string `json:"specification"`
	UpholsteryFinish *string `json:"upholstery_finish"`
	CADURLs          *string `json:"cad_urls"`
	PDFURLs          *string `json:"pdf_urls"`
	RenderURLs       *string `json:"render_urls"`
	JobcardURLs      *string `json:"jobcard_urls"`
	CurrentStatus    *string `json:"current_status"`
	Addon            *string `json:"addon"`
}

// RoutingEntry is one department in the routing set request.
type RoutingEntry struct {
	DepartmentID  string `json:"department_id"  validate:"required"`
	SequenceOrder int    `json:"sequence_order" validate:"required,gt=0"`
}

type SetRoutingRequest struct {
	Routing []RoutingEntry `json:"routing" validate:"required,min=1,dive"`
}

// RoutingRow is the DB model for project_department_routing.
type RoutingRow struct {
	ID                 string     `db:"id"                   json:"id"`
	ProjectID          string     `db:"project_id"           json:"project_id"`
	DepartmentID       string     `db:"department_id"        json:"department_id"`
	DepartmentName     string     `db:"department_name"      json:"department_name"`
	SequenceOrder      int        `db:"sequence_order"       json:"sequence_order"`
	Status             string     `db:"status"               json:"status"`
	StartedAt          *time.Time `db:"started_at"           json:"started_at"`
	CompletedAt        *time.Time `db:"completed_at"         json:"completed_at"`
	CompletionProofURL *string    `db:"completion_proof_url" json:"completion_proof_url"`
	CreatedAt          time.Time  `db:"created_at"           json:"created_at"`
}

// ListFilter holds query params for project listing.
type ListFilter struct {
	Status       string
	DepartmentID string
	Search       string
	DateFrom     string
	DateTo       string
	Page         int
	Limit        int
}
