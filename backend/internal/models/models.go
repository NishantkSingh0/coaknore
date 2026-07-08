package models

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
)

// ============================================================
// ENUMS
// ============================================================

type LayerType string

const (
	LayerSuperAdmin LayerType = "super_admin"
	LayerOne        LayerType = "layer1"
	LayerTwo        LayerType = "layer2"
	LayerThree      LayerType = "layer3"
)

type DepartmentLayer string

const (
	DeptLayerTwo   DepartmentLayer = "layer2"
	DeptLayerThree DepartmentLayer = "layer3"
)

type ProjectStatus string

const (
	ProjectCreated    ProjectStatus = "created"
	ProjectRouting    ProjectStatus = "routing"
	ProjectInProgress ProjectStatus = "in_progress"
	ProjectCompleted  ProjectStatus = "completed"
	ProjectArchived   ProjectStatus = "archived"
	ProjectOnHold     ProjectStatus = "on_hold"
)

type TaskStatus string

const (
	TaskPending    TaskStatus = "pending"
	TaskInProgress TaskStatus = "in_progress"
	TaskHold       TaskStatus = "hold"
	TaskIssueHold  TaskStatus = "issue_hold"
	TaskCompleted  TaskStatus = "completed"
)

type SubtaskStatus string

const (
	SubtaskPending    SubtaskStatus = "pending"
	SubtaskInProgress SubtaskStatus = "in_progress"
	SubtaskCompleted  SubtaskStatus = "completed"
)

type RoutingStatus string

const (
	RoutingDraft      RoutingStatus = "draft"
	RoutingActive     RoutingStatus = "active"
	RoutingSuperseded RoutingStatus = "superseded"
	RoutingArchived   RoutingStatus = "archived"
)

type DependencyPolicy string

const (
	RequireAll DependencyPolicy = "require_all"
	RequireAny DependencyPolicy = "require_any"
)

type IssueStatus string

const (
	IssueOpen            IssueStatus = "open"
	IssuePendingApproval IssueStatus = "pending_approval"
	IssueApproved        IssueStatus = "approved"
	IssueRejected        IssueStatus = "rejected"
	IssueResolved        IssueStatus = "resolved"
	IssueClosed          IssueStatus = "closed"
)

type IssueType string

const (
	IssueMaterialMissing      IssueType = "material_missing"
	IssueDesignChange         IssueType = "design_change"
	IssueRoutingRequired      IssueType = "routing_required"
	IssueFullScaleRequirement IssueType = "full_scale_requirement"
	IssueQualityIssue         IssueType = "quality_issue"
	IssueReworkRequired       IssueType = "rework_required"
	IssueCustom               IssueType = "custom"
)

type ReworkStatus string

const (
	ReworkPending    ReworkStatus = "pending"
	ReworkApproved   ReworkStatus = "approved"
	ReworkRejected   ReworkStatus = "rejected"
	ReworkInProgress ReworkStatus = "in_progress"
	ReworkCompleted  ReworkStatus = "completed"
)

type QueryStatus string

const (
	QueryOpen              QueryStatus = "open"
	QuerySenderResolved    QueryStatus = "sender_resolved"
	QueryRecipientResolved QueryStatus = "recipient_resolved"
	QueryClosed            QueryStatus = "closed"
)

type MaterialRequestStatus string

const (
	MatReqPending   MaterialRequestStatus = "pending"
	MatReqApproved  MaterialRequestStatus = "approved"
	MatReqRejected  MaterialRequestStatus = "rejected"
	MatReqFulfilled MaterialRequestStatus = "fulfilled"
)

type FileOwnerType string

const (
	FileOwnerProject         FileOwnerType = "project"
	FileOwnerProjectRevision FileOwnerType = "project_revision"
	FileOwnerTask            FileOwnerType = "task"
	FileOwnerSubtask         FileOwnerType = "subtask"
	FileOwnerIssue           FileOwnerType = "issue"
	FileOwnerDailyReport     FileOwnerType = "daily_report"
	FileOwnerQuery           FileOwnerType = "query"
	FileOwnerRework          FileOwnerType = "rework_request"
	FileOwnerMaterial        FileOwnerType = "material_request"
)

type NotificationType string

const (
	NotifProjectCreated        NotificationType = "project_created"
	NotifRoutingAssigned       NotificationType = "routing_assigned"
	NotifRoutingUpdated        NotificationType = "routing_updated"
	NotifTaskAssigned          NotificationType = "task_assigned"
	NotifTaskStarted           NotificationType = "task_started"
	NotifTaskCompleted         NotificationType = "task_completed"
	NotifSubtaskCompleted      NotificationType = "subtask_completed"
	NotifProofUploaded         NotificationType = "proof_uploaded"
	NotifDailyReportSubmitted  NotificationType = "daily_report_submitted"
	NotifIssueRaised           NotificationType = "issue_raised"
	NotifIssueApproved         NotificationType = "issue_approved"
	NotifIssueClosed           NotificationType = "issue_closed"
	NotifIssueRejected         NotificationType = "issue_rejected"
	NotifMaterialRequest       NotificationType = "material_request"
	NotifMaterialApproved      NotificationType = "material_approved"
	NotifMaterialRejected      NotificationType = "material_rejected"
	NotifReworkRequest         NotificationType = "rework_request"
	NotifReworkApproved        NotificationType = "rework_approved"
	NotifReworkRejected        NotificationType = "rework_rejected"
	NotifQueryReceived         NotificationType = "query_received"
	NotifQueryReplied          NotificationType = "query_replied"
	NotifQueryClosed           NotificationType = "query_closed"
	NotifProjectRevision       NotificationType = "project_revision"
	NotifDepartmentReopened    NotificationType = "department_reopened"
	NotifOverdueTask           NotificationType = "overdue_task"
)

type AuditAction string

const (
	AuditCreated         AuditAction = "created"
	AuditUpdated         AuditAction = "updated"
	AuditDeleted         AuditAction = "deleted"
	AuditStatusChanged   AuditAction = "status_changed"
	AuditAssigned        AuditAction = "assigned"
	AuditCompleted       AuditAction = "completed"
	AuditApproved        AuditAction = "approved"
	AuditRejected        AuditAction = "rejected"
	AuditResolved        AuditAction = "resolved"
	AuditClosed          AuditAction = "closed"
	AuditReopened        AuditAction = "reopened"
	AuditArchived        AuditAction = "archived"
	AuditFileUploaded    AuditAction = "file_uploaded"
	AuditRevisionCreated AuditAction = "revision_created"
	AuditRoutingPublished AuditAction = "routing_published"
)

// ============================================================
// DOMAIN MODELS
// ============================================================

type Organization struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	LogoURL     string    `json:"logo_url,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Department struct {
	ID             uuid.UUID       `json:"id"`
	OrganizationID uuid.UUID       `json:"organization_id"`
	Name           string          `json:"name"`
	Description    string          `json:"description"`
	Layer          DepartmentLayer `json:"layer"`
	IsActive       bool            `json:"is_active"`
	EmployeeCount  int             `json:"employee_count,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

type Employee struct {
	ID                   uuid.UUID      `json:"id"`
	OrganizationID       uuid.UUID      `json:"organization_id"`
	DepartmentID         *uuid.UUID     `json:"department_id,omitempty"`
	DepartmentName       string         `json:"department_name,omitempty"`
	Email                string         `json:"email"`
	FirstName            string         `json:"first_name"`
	LastName             string         `json:"last_name"`
	FullName             string         `json:"full_name,omitempty"`
	Phone                string         `json:"phone,omitempty"`
	AvatarURL            string         `json:"avatar_url,omitempty"`
	Layer                LayerType      `json:"layer"`
	IsActive             bool           `json:"is_active"`
	LastLoginAt          *time.Time     `json:"last_login_at,omitempty"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
}

type EmployeeWithPassword struct {
	Employee
	PasswordHash string `json:"-"`
}

type Dimensions struct {
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
	Depth  float64 `json:"depth"`
	Unit   string  `json:"unit"` // mm, cm, inches
}

type Project struct {
	ID                uuid.UUID   `json:"id"`
	OrganizationID    uuid.UUID   `json:"organization_id"`
	PONumber          string      `json:"po_number"`
	ProjectName       string      `json:"project_name"`
	ClientName        string      `json:"client_name"`
	ClientEmail       string      `json:"client_email,omitempty"`
	ClientPhone       string      `json:"client_phone,omitempty"`
	ClientAddress     string      `json:"client_address,omitempty"`
	Quantity          int         `json:"quantity"`
	Specifications    string      `json:"specifications,omitempty"`
	MaterialDetails   string      `json:"material_details,omitempty"`
	UpholsteryDetails string      `json:"upholstery_details,omitempty"`
	DeliveryDate      *time.Time  `json:"delivery_date,omitempty"`
	DeliveryAddress   string      `json:"delivery_address,omitempty"`
	CoverImageURL     string      `json:"cover_image_url,omitempty"`
	CADFilesURL       string      `json:"cad_files_url,omitempty"`
	JobCardsURL       string      `json:"job_cards_url,omitempty"`
	RenderFilesURL    string      `json:"render_files_url,omitempty"`
	DrawingFileID     *uuid.UUID  `json:"drawing_file_id,omitempty"`
	DrawingFile       *FileAsset  `json:"drawing_file,omitempty"`
	Status            ProjectStatus `json:"status"`
	CreatedBy         uuid.UUID   `json:"created_by"`
	CreatedByName     string      `json:"created_by_name,omitempty"`
	CurrentRevision   int         `json:"current_revision"`
	CompletedAt       *time.Time  `json:"completed_at,omitempty"`
	ArchivedAt        *time.Time  `json:"archived_at,omitempty"`
	CreatedAt         time.Time   `json:"created_at"`
	UpdatedAt         time.Time   `json:"updated_at"`
}

type ProjectRevision struct {
	ID                  uuid.UUID    `json:"id"`
	ProjectID           uuid.UUID    `json:"project_id"`
	RevisionNumber      int          `json:"revision_number"`
	RevisedBy           uuid.UUID    `json:"revised_by"`
	RevisedByName       string       `json:"revised_by_name,omitempty"`
	Reason              string       `json:"reason"`
	ClientRequest       string       `json:"client_request,omitempty"`
	PreviousValues      interface{}  `json:"previous_values"`
	UpdatedValues       interface{}  `json:"updated_values"`
	RoutingChanged      bool         `json:"routing_changed"`
	DepartmentsReopened []uuid.UUID  `json:"departments_reopened"`
	SubtasksReopened    []uuid.UUID  `json:"subtasks_reopened"`
	NotificationsSent   bool         `json:"notifications_sent"`
	Files               []FileAsset  `json:"files,omitempty"`
	CreatedAt           time.Time    `json:"created_at"`
}

type Routing struct {
	ID              uuid.UUID     `json:"id"`
	ProjectID       uuid.UUID     `json:"project_id"`
	Version         int           `json:"version"`
	Name            string        `json:"name,omitempty"`
	Description     string        `json:"description,omitempty"`
	Status          RoutingStatus `json:"status"`
	ParentRoutingID *uuid.UUID    `json:"parent_routing_id,omitempty"`
	RoutingType     string        `json:"routing_type"`
	CreatedBy       uuid.UUID     `json:"created_by"`
	CreatedByName   string        `json:"created_by_name,omitempty"`
	PublishedAt     *time.Time    `json:"published_at,omitempty"`
	Steps           []RoutingStep `json:"steps,omitempty"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

type RoutingStep struct {
	ID               uuid.UUID        `json:"id"`
	RoutingID        uuid.UUID        `json:"routing_id"`
	StepOrder        int              `json:"step_order"`
	Name             string           `json:"name,omitempty"`
	DependencyPolicy DependencyPolicy `json:"dependency_policy"`
	IsActive         bool             `json:"is_active"`
	Departments      []Department     `json:"departments,omitempty"`
	Tasks            []DepartmentTask `json:"tasks,omitempty"`
	CreatedAt        time.Time        `json:"created_at"`
}

type DepartmentTask struct {
	ID             uuid.UUID     `json:"id"`
	ProjectID      uuid.UUID     `json:"project_id"`
	ProjectName    string        `json:"project_name,omitempty"`
	RoutingID      uuid.UUID     `json:"routing_id"`
	RoutingStepID  uuid.UUID     `json:"routing_step_id"`
	DepartmentID   uuid.UUID     `json:"department_id"`
	DepartmentName string        `json:"department_name,omitempty"`
	Title          string        `json:"title,omitempty"`
	Description    string        `json:"description,omitempty"`
	Priority       int           `json:"priority"`
	Status         TaskStatus    `json:"status"`
	StartDate      *time.Time    `json:"start_date,omitempty"`
	DueDate        *time.Time    `json:"due_date,omitempty"`
	ExpectedCompletionDate *time.Time `json:"expected_completion_date,omitempty"`
	CompletionDateLocked   bool   `json:"completion_date_locked"`
	RoutedToDeptAt *time.Time    `json:"routed_to_dept_at,omitempty"`
	DatesFrozen    bool          `json:"dates_frozen"`
	StartedAt      *time.Time    `json:"started_at,omitempty"`
	CompletedAt    *time.Time    `json:"completed_at,omitempty"`
	AssignedEmployees []Employee `json:"assigned_employees,omitempty"`
	Subtasks       []Subtask     `json:"subtasks,omitempty"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

type Subtask struct {
	ID          uuid.UUID     `json:"id"`
	TaskID      uuid.UUID     `json:"task_id"`
	Title       string        `json:"title"`
	Description string        `json:"description,omitempty"`
	IsRequired  bool          `json:"is_required"`
	Status      SubtaskStatus `json:"status"`
	AssignedTo  *uuid.UUID    `json:"assigned_to,omitempty"`
	AssigneeName string       `json:"assignee_name,omitempty"`
	Notes       string        `json:"notes,omitempty"`
	SortOrder   int           `json:"sort_order"`
	CompletedAt *time.Time    `json:"completed_at,omitempty"`
	CompletedBy *uuid.UUID    `json:"completed_by,omitempty"`
	Files       []FileAsset   `json:"files,omitempty"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

type Issue struct {
	ID               uuid.UUID   `json:"id"`
	ProjectID        uuid.UUID   `json:"project_id"`
	TaskID           *uuid.UUID  `json:"task_id,omitempty"`
	DepartmentID     uuid.UUID   `json:"department_id"`
	DepartmentName   string      `json:"department_name,omitempty"`
	RaisedBy         uuid.UUID   `json:"raised_by"`
	RaisedByName     string      `json:"raised_by_name,omitempty"`
	Type             IssueType   `json:"type"`
	Title            string      `json:"title"`
	Description      string      `json:"description"`
	Status           IssueStatus `json:"status"`
	AssignedToDeptID *uuid.UUID  `json:"assigned_to_dept_id,omitempty"`
	AssignedToDept   string      `json:"assigned_to_dept,omitempty"`
	ReviewedBy       *uuid.UUID  `json:"reviewed_by,omitempty"`
	ReviewedByName   string      `json:"reviewed_by_name,omitempty"`
	ReviewNotes      string      `json:"review_notes,omitempty"`
	ReviewedAt       *time.Time  `json:"reviewed_at,omitempty"`
	ResolvedBy       *uuid.UUID  `json:"resolved_by,omitempty"`
	ResolvedByName   string      `json:"resolved_by_name,omitempty"`
	ResolvedAt       *time.Time  `json:"resolved_at,omitempty"`
	ResolutionNotes  string      `json:"resolution_notes,omitempty"`
	// Material Missing specific fields
	MaterialDescription string  `json:"material_description,omitempty"`
	RequiredQuantity    float64 `json:"required_quantity,omitempty"`
	MaterialUnit        string  `json:"material_unit,omitempty"`
	MaterialRemarks     string  `json:"material_remarks,omitempty"`
	Files            []FileAsset `json:"files,omitempty"`
	CreatedAt        time.Time   `json:"created_at"`
	UpdatedAt        time.Time   `json:"updated_at"`
}

type ReworkRequest struct {
	ID                 uuid.UUID    `json:"id"`
	ProjectID          uuid.UUID    `json:"project_id"`
	RequestingTaskID   uuid.UUID    `json:"requesting_task_id"`
	RequestingDeptID   uuid.UUID    `json:"requesting_dept_id"`
	RequestingDeptName string       `json:"requesting_dept_name,omitempty"`
	RequestedBy        uuid.UUID    `json:"requested_by"`
	RequestedByName    string       `json:"requested_by_name,omitempty"`
	TargetDepartmentID uuid.UUID    `json:"target_department_id"`
	TargetDeptName     string       `json:"target_dept_name,omitempty"`
	Reason             string       `json:"reason"`
	Description        string       `json:"description,omitempty"`
	Status             ReworkStatus `json:"status"`
	ReviewedBy         *uuid.UUID   `json:"reviewed_by,omitempty"`
	ReviewedByName     string       `json:"reviewed_by_name,omitempty"`
	ReviewNotes        string       `json:"review_notes,omitempty"`
	ReviewedAt         *time.Time   `json:"reviewed_at,omitempty"`
	NewRoutingID       *uuid.UUID   `json:"new_routing_id,omitempty"`
	Files              []FileAsset  `json:"files,omitempty"`
	CreatedAt          time.Time    `json:"created_at"`
	UpdatedAt          time.Time    `json:"updated_at"`
}

type MaterialRequisition struct {
	ID           uuid.UUID             `json:"id"`
	ProjectID    uuid.UUID             `json:"project_id"`
	TaskID       *uuid.UUID            `json:"task_id,omitempty"`
	DepartmentID uuid.UUID             `json:"department_id"`
	DeptName     string                `json:"dept_name,omitempty"`
	RequestedBy  uuid.UUID             `json:"requested_by"`
	RequestedByName string             `json:"requested_by_name,omitempty"`
	Title        string                `json:"title"`
	Description  string                `json:"description,omitempty"`
	Status       MaterialRequestStatus `json:"status"`
	ReviewedBy   *uuid.UUID            `json:"reviewed_by,omitempty"`
	ReviewNotes  string                `json:"review_notes,omitempty"`
	ReviewedAt   *time.Time            `json:"reviewed_at,omitempty"`
	Items        []MaterialItem        `json:"items,omitempty"`
	Files        []FileAsset           `json:"files,omitempty"`
	CreatedAt    time.Time             `json:"created_at"`
	UpdatedAt    time.Time             `json:"updated_at"`
}

type MaterialItem struct {
	ID             uuid.UUID `json:"id"`
	RequisitionID  uuid.UUID `json:"requisition_id"`
	MaterialName   string    `json:"material_name"`
	Quantity       float64   `json:"quantity"`
	Unit           string    `json:"unit"`
	Description    string    `json:"description,omitempty"`
	EstimatedCost  float64   `json:"estimated_cost,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type Query struct {
	ID                uuid.UUID   `json:"id"`
	ProjectID         uuid.UUID   `json:"project_id"`
	ProjectName       string      `json:"project_name,omitempty"`
	Subject           string      `json:"subject"`
	SenderID          uuid.UUID   `json:"sender_id"`
	SenderName        string      `json:"sender_name,omitempty"`
	SenderLayer       LayerType   `json:"sender_layer,omitempty"`
	RecipientID       uuid.UUID   `json:"recipient_id"`
	RecipientName     string      `json:"recipient_name,omitempty"`
	RecipientLayer    LayerType   `json:"recipient_layer,omitempty"`
	Status            QueryStatus `json:"status"`
	SenderResolved    bool        `json:"sender_resolved"`
	RecipientResolved bool        `json:"recipient_resolved"`
	Messages          []QueryMessage `json:"messages,omitempty"`
	LastMessage       *QueryMessage  `json:"last_message,omitempty"`
	UnreadCount       int            `json:"unread_count,omitempty"`
	CreatedAt         time.Time   `json:"created_at"`
	UpdatedAt         time.Time   `json:"updated_at"`
}

type QueryMessage struct {
	ID        uuid.UUID   `json:"id"`
	QueryID   uuid.UUID   `json:"query_id"`
	SenderID  uuid.UUID   `json:"sender_id"`
	SenderName string     `json:"sender_name,omitempty"`
	Message   string      `json:"message,omitempty"`
	Files     []FileAsset `json:"files,omitempty"`
	CreatedAt time.Time   `json:"created_at"`
}

type DailyReport struct {
	ID           uuid.UUID   `json:"id"`
	ProjectID    uuid.UUID   `json:"project_id"`
	ProjectName  string      `json:"project_name,omitempty"`
	DepartmentID uuid.UUID   `json:"department_id"`
	DeptName     string      `json:"dept_name,omitempty"`
	SubmittedBy  uuid.UUID   `json:"submitted_by"`
	SubmittedByName string   `json:"submitted_by_name,omitempty"`
	TaskID       *uuid.UUID  `json:"task_id,omitempty"`
	Description  string      `json:"description"`
	ReportDate   time.Time   `json:"report_date"`
	Files        []FileAsset `json:"files,omitempty"`
	CreatedAt    time.Time   `json:"created_at"`
}

type FileAsset struct {
	ID           uuid.UUID     `json:"id"`
	OrganizationID uuid.UUID   `json:"organization_id"`
	OwnerType    FileOwnerType `json:"owner_type"`
	OwnerID      uuid.UUID     `json:"owner_id"`
	ProjectID    *uuid.UUID    `json:"project_id,omitempty"`
	FileName     string        `json:"file_name"`
	OriginalName string        `json:"original_name"`
	FileSize     int64         `json:"file_size"`
	MimeType     string        `json:"mime_type"`
	S3Key        string        `json:"s3_key"`
	S3URL        string        `json:"s3_url"`
	UploadedBy   uuid.UUID     `json:"uploaded_by"`
	UploaderName string        `json:"uploader_name,omitempty"`
	CreatedAt    time.Time     `json:"created_at"`
}

type Notification struct {
	ID           uuid.UUID        `json:"id"`
	OrganizationID uuid.UUID      `json:"organization_id"`
	RecipientID  uuid.UUID        `json:"recipient_id"`
	Type         NotificationType `json:"type"`
	Title        string           `json:"title"`
	Body         string           `json:"body,omitempty"`
	ProjectID    *uuid.UUID       `json:"project_id,omitempty"`
	ProjectName  string           `json:"project_name,omitempty"`
	EntityType   string           `json:"entity_type,omitempty"`
	EntityID     *uuid.UUID       `json:"entity_id,omitempty"`
	IsRead       bool             `json:"is_read"`
	CreatedAt    time.Time        `json:"created_at"`
}

type AuditLog struct {
	ID             uuid.UUID   `json:"id"`
	OrganizationID uuid.UUID   `json:"organization_id"`
	ProjectID      *uuid.UUID  `json:"project_id,omitempty"`
	ActorID        *uuid.UUID  `json:"actor_id,omitempty"`
	ActorName      string      `json:"actor_name,omitempty"`
	Action         AuditAction `json:"action"`
	EntityType     string      `json:"entity_type"`
	EntityID       *uuid.UUID  `json:"entity_id,omitempty"`
	EntityName     string      `json:"entity_name,omitempty"`
	BeforeState    interface{} `json:"before_state,omitempty"`
	AfterState     interface{} `json:"after_state,omitempty"`
	Metadata       interface{} `json:"metadata,omitempty"`
	IPAddress      string      `json:"ip_address,omitempty"`
	CreatedAt      time.Time   `json:"created_at"`
}

type RoutingTemplate struct {
	ID             uuid.UUID   `json:"id"`
	OrganizationID uuid.UUID   `json:"organization_id"`
	Name           string      `json:"name"`
	Description    string      `json:"description,omitempty"`
	TemplateData   interface{} `json:"template_data"`
	CreatedBy      uuid.UUID   `json:"created_by"`
	IsActive       bool        `json:"is_active"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

type RoutingEditTimeline struct {
	ID             uuid.UUID `json:"id"`
	RoutingID      uuid.UUID `json:"routing_id"`
	EditedBy       uuid.UUID `json:"edited_by"`
	EditorEmail    string    `json:"editor_email"`
	EditorName     string    `json:"editor_name"`
	EditReason     string    `json:"edit_reason"`
	ChangesSummary string    `json:"changes_summary,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

// ============================================================
// REQUEST/RESPONSE TYPES
// ============================================================

type PaginationParams struct {
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
	Search   string `json:"search"`
}

type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}

type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// NullableUUID helpers
func UUIDPtrFromString(s string) (*uuid.UUID, error) {
	if s == "" {
		return nil, nil
	}
	id, err := uuid.Parse(s)
	if err != nil {
		return nil, err
	}
	return &id, nil
}

func NullUUID(u *uuid.UUID) sql.NullString {
	if u == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: u.String(), Valid: true}
}
