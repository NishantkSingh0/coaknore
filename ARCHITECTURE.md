# PMS System Architecture & API Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Flow](#architecture-flow)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Frontend-Backend Data Flow](#frontend-backend-data-flow)
6. [Authentication & Authorization](#authentication--authorization)
7. [Caching Strategy](#caching-strategy)
8. [Background Jobs](#background-jobs)
9. [File Management](#file-management)
10. [Notification System](#notification-system)

---

## System Overview

The Production Management System (PMS) is a full-stack web application for luxury furniture manufacturing, featuring a multi-layer organizational structure with role-based access control.

### Technology Stack

**Backend:**
- Go 1.25.0 with Chi HTTP router
- PostgreSQL database
- JWT authentication
- AWS S3 for file storage
- Real-time notifications

**Frontend:**
- React 18.3.1 with TypeScript
- Vite build system
- TailwindCSS styling
- Axios for API calls
- In-memory caching system

### Access Layers

The system implements a 4-layer hierarchical access model:

1. **Super Admin** - Full system access, organization management
2. **Layer 1 (Admin)** - Department management, employee management, project CRUD
3. **Layer 2 (Management)** - Routing builder, approvals, oversight
4. **Layer 3 (Execution)** - Task execution, reporting, issue raising

---

## Architecture Flow

### Request Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   React     │     │   Chi       │     │  Service    │     │ PostgreSQL  │
│  Frontend   │────▶│   Router    │────▶│   Layer     │────▶│  Database   │
│             │HTTP │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       │                   │                   │                   │
       │                   ▼                   │                   │
       │            ┌─────────────┐           │                   │
       │            │ Middleware  │           │                   │
       │            │  - Auth     │           │                   │
       │            │  - CORS     │           │                   │
       │            │  - Logger   │           │                   │
       │            └─────────────┘           │                   │
       │                   │                   │                   │
       │                   │                   ▼                   │
       │                   │            ┌─────────────┐           │
       │                   │            │   Handler   │           │
       │                   │            │   Layer     │           │
       │                   │            └─────────────┘           │
       │                   │                   │                   │
       │                   │                   │                   │
       │                   │                   │                   │
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Cache     │     │   Audit     │     │ Notif       │     │    S3       │
│  Service    │     │   Service   │     │  Service    │     │  Storage    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Backend Layer Structure

```
cmd/main.go                    # Application entry point
├── Configuration Load
├── Database Connection
├── Migration & Seed
├── Service Initialization
├── Handler Registration
└── Server Startup

internal/
├── config/                   # Environment configuration
├── database/                 # DB connection & migrations
├── handlers/                 # HTTP request handlers
│   ├── auth_handler.go
│   ├── organization_handler.go
│   ├── project_handler.go
│   ├── routing_handler.go
│   ├── task_handler.go
│   ├── issue_handler.go
│   ├── rework_handler.go
│   ├── query_handler.go
│   ├── material_handler.go
│   ├── report_handler.go
│   ├── notification_handler.go
│   ├── search_handler.go
│   └── ai_handler.go
├── middleware/               # Request processing
│   ├── auth.go               # JWT validation
│   ├── layer.go              # Role-based access
│   └── logger.go             # Request logging
├── services/                 # Business logic
│   ├── auth_service.go
│   ├── organization_service.go
│   ├── project_service.go
│   ├── routing_service.go
│   ├── task_service.go
│   ├── issue_service.go
│   ├── rework_service.go
│   ├── query_service.go
│   ├── material_service.go
│   ├── daily_report_service.go
│   ├── notification_service.go
│   ├── search_service.go
│   ├── file_service.go
│   ├── audit_service.go
│   └── ai_service.go
└── models/                   # Data structures
    └── models.go             # All model definitions
```

---

## Database Schema

### Core Entities

#### Organizations
```go
type Organization struct {
    ID          uuid.UUID
    Name        string
    CreatedAt   time.Time
    UpdatedAt   time.Time
}
```

#### Departments
```go
type Department struct {
    ID          uuid.UUID
    OrgID       uuid.UUID
    Name        string
    Description string
    Layer       DepartmentLayer  // layer2 or layer3
    IsActive    bool
    CreatedAt   time.Time
    UpdatedAt   time.Time
}
```

#### Employees
```go
type Employee struct {
    ID           uuid.UUID
    OrgID        uuid.UUID
    DepartmentID *uuid.UUID
    Email        string
    PasswordHash string
    FirstName    string
    LastName     string
    Phone        string
    Layer        LayerType        // super_admin, layer1, layer2, layer3
    IsActive     bool
    AvatarURL    *string
    LastLoginAt  *time.Time
    CreatedAt    time.Time
    UpdatedAt    time.Time
}
```

#### Projects
```go
type Project struct {
    ID                uuid.UUID
    OrgID             uuid.UUID
    PONumber          string
    ProjectName       string
    ClientName        string
    ClientEmail       string
    ClientPhone       string
    ClientAddress     string
    ClientGSTNum      string
    Rate              float64
    Quantity          int
    Specifications    string
    MaterialDetails   string
    UpholsteryDetails string
    DeliveryDate      *time.Time
    DeliveryAddress   string
    CADFilesURL       *string
    JobCardsURL       *string
    RenderFilesURL    *string
    Status            ProjectStatus
    CurrentRevision   int
    DrawingFile       *FileAsset
    CreatedAt         time.Time
    UpdatedAt         time.Time
}
```

#### Routings
```go
type Routing struct {
    ID               uuid.UUID
    ProjectID        uuid.UUID
    Name             string
    Description      string
    Status           RoutingStatus  // draft, active, superseded, archived
    IsLatest         bool
    Steps            []RoutingStep
    CreatedBy        uuid.UUID
    CreatedAt        time.Time
    UpdatedAt        time.Time
}

type RoutingStep struct {
    ID                uuid.UUID
    StepOrder         int
    Name              string
    DependencyPolicy  DependencyPolicy  // require_all, require_any
    DepartmentIDs     []uuid.UUID
}
```

#### Department Tasks
```go
type DepartmentTask struct {
    ID                uuid.UUID
    ProjectID         uuid.UUID
    RoutingID         uuid.UUID
    DepartmentID      uuid.UUID
    Title             string
    Description       string
    Status            TaskStatus  // pending, in_progress, hold, issue_hold, completed, on_hold
    DueDate           *time.Time
    StartDate         *time.Time
    ExpectedCompletion *time.Time
    RoutingIsLatest    bool
    AssignedEmployees []Employee
    Subtasks          []Subtask
    CreatedAt         time.Time
    UpdatedAt         time.Time
}
```

#### Subtasks
```go
type Subtask struct {
    ID          uuid.UUID
    TaskID      uuid.UUID
    Title       string
    Description string
    Status      SubtaskStatus  // pending, in_progress, completed
    ProofFiles  []FileAsset
    CreatedAt   time.Time
    UpdatedAt   time.Time
}
```

#### Issues
```go
type Issue struct {
    ID               uuid.UUID
    ProjectID        uuid.UUID
    TaskID           *uuid.UUID
    Type             IssueType  // material_missing, design_change, etc.
    Title            string
    Description      string
    DepartmentID     uuid.UUID
    RaisedBy         uuid.UUID
    Status           IssueStatus  // open, pending_approval, approved, rejected, resolved, closed
    ReviewNotes      *string
    ResolvedBy       *uuid.UUID
    ResolutionNotes  *string
    Files            []FileAsset
    CreatedAt        time.Time
    UpdatedAt        time.Time
}
```

#### Rework Requests
```go
type ReworkRequest struct {
    ID               uuid.UUID
    ProjectID        uuid.UUID
    TaskID           uuid.UUID
    DepartmentID     uuid.UUID
    RequestedBy      uuid.UUID
    Reason           string
    Status           ReworkStatus  // pending, approved, rejected, completed
    ReviewNotes      *string
    NewRoutingID     *uuid.UUID
    CreatedAt        time.Time
    UpdatedAt        time.Time
}
```

#### Material Requisitions
```go
type MaterialRequisition struct {
    ID          uuid.UUID
    ProjectID   uuid.UUID
    Title       string
    Description string
    DeptID      uuid.UUID
    RequestedBy uuid.UUID
    Status      MaterialRequestStatus  // pending, approved, rejected, fulfilled
    ReviewNotes *string
    Items       []MaterialItem
    CreatedAt   time.Time
    UpdatedAt   time.Time
}
```

#### Queries
```go
type Query struct {
    ID          uuid.UUID
    ProjectID   *uuid.UUID
    RaisedBy    uuid.UUID
    Subject     string
    Status      QueryStatus  // open, resolved
    ResolvedBy  *uuid.UUID
    CreatedAt   time.Time
    UpdatedAt   time.Time
}
```

#### Daily Reports
```go
type DailyReport struct {
    ID          uuid.UUID
    ProjectID   uuid.UUID
    DeptID      uuid.UUID
    SubmittedBy uuid.UUID
    ReportDate  time.Time
    Description string
    Files       []FileAsset
    CreatedAt   time.Time
}
```

#### Notifications
```go
type Notification struct {
    ID          uuid.UUID
    OrgID       uuid.UUID
    EmployeeID  uuid.UUID
    Type        NotificationType
    Title       string
    Message     string
    EntityType  string  // project, task, issue, etc.
    EntityID    *uuid.UUID
    IsRead      bool
    Priority    string  // critical, important, standard
    CreatedAt   time.Time
}
```

#### File Assets
```go
type FileAsset struct {
    ID          uuid.UUID
    OwnerType   string  // project, task, subtask, issue, etc.
    OwnerID     uuid.UUID
    S3Key       string
    S3URL       string
    FileName    string
    FileType    string
    FileSize    int64
    UploadedBy  uuid.UUID
    CreatedAt   time.Time
}
```

#### Audit Logs
```go
type AuditLog struct {
    ID          uuid.UUID
    OrgID       uuid.UUID
    EmployeeID  uuid.UUID
    Action      string
    EntityType  string
    EntityID    uuid.UUID
    Changes     string  // JSON encoded changes
    IPAddress   string
    CreatedAt   time.Time
}
```

---

## API Endpoints

### Authentication

#### Public Endpoints
```http
POST   /api/auth/login
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/public/avatar
GET    /health
```

#### Authenticated Endpoints
```http
GET    /api/auth/me
POST   /api/auth/change-password
POST   /api/auth/me/avatar
DELETE /api/auth/me/avatar
```

**Functionality:**
- JWT-based authentication
- Password reset via email tokens
- Avatar management with S3 integration
- Session validation middleware

---

### Organization Management

#### All Layers (Read)
```http
GET    /api/organization
GET    /api/departments
GET    /api/departments/{id}
GET    /api/employees/search
```

#### Admin Only (Write)
```http
POST   /api/departments
PUT    /api/departments/{id}
PATCH  /api/departments/{id}/toggle

GET    /api/employees
GET    /api/employees/{id}
POST   /api/employees
PUT    /api/employees/{id}
PATCH  /api/employees/{id}/toggle
POST   /api/employees/{id}/transfer
POST   /api/employees/{id}/reset-password
DELETE /api/employees/{id}
```

**Functionality:**
- Multi-tenant organization support
- Department creation with layer classification
- Employee management with role assignment
- Department transfer and password reset
- Active/inactive status management

---

### Project Management

#### All Layers (Read)
```http
GET    /api/projects
GET    /api/projects/{id}
GET    /api/projects/{id}/restricted
GET    /api/projects/{id}/revisions
GET    /api/projects/{id}/timeline
```

#### Admin Only (Write)
```http
POST   /api/projects
PUT    /api/projects/{id}
PATCH  /api/projects/{id}/status
POST   /api/projects/{id}/drawing
DELETE /api/projects/{id}
```

**Functionality:**
- Project CRUD with specifications
- Client information management
- Project revision tracking
- Timeline and audit log retrieval
- Drawing file upload to S3
- Status workflow management

---

### Routing Management

#### Layer 2 + Admin (Write)
```http
POST   /api/projects/{projectId}/routings
PUT    /api/routings/{id}
POST   /api/routings/{id}/new-version
POST   /api/routings/{id}/publish
GET    /api/routing-templates
```

#### All Layers (Read)
```http
GET    /api/projects/{projectId}/routings
GET    /api/routings/{id}
GET    /api/routings/{id}/timeline
```

**Functionality:**
- Visual routing builder
- Multi-step workflow creation
- Department assignment per step
- Dependency policies (require_all, require_any)
- Routing versioning and publishing
- Template-based creation
- Edit timeline tracking

---

### Task Management

#### All Layers (Read)
```http
GET    /api/projects/{projectId}/tasks
GET    /api/tasks/{id}
GET    /api/my-tasks
GET    /api/departments/{departmentId}/upcoming-tasks
```

#### Layer 2/3 + Admin (Write)
```http
PATCH  /api/tasks/{id}/status
POST   /api/tasks/{id}/assign-employees
PATCH  /api/tasks/{id}/dates
PATCH  /api/tasks/{id}/expected-completion

POST   /api/tasks/{taskId}/subtasks
PATCH  /api/subtasks/{id}/complete
PUT    /api/subtasks/{id}
POST   /api/subtasks/{id}/proof
```

#### Layer 2 + Admin
```http
POST   /api/tasks/{id}/department-file
```

**Functionality:**
- Task assignment from routing
- Employee assignment to tasks
- Subtask creation and tracking
- Task status management
- Due date and expected completion
- Proof upload with file attachments
- Department-specific file uploads

---

### Issue Management

#### All Layers
```http
GET    /api/issues
GET    /api/issues/{id}
POST   /api/projects/{projectId}/issues
POST   /api/issues/{id}/resolve
POST   /api/issues/{id}/files
```

#### Layer 2 + Admin
```http
POST   /api/issues/{id}/review
```

**Functionality:**
- Issue raising with multiple types
- Issue review and approval workflow
- Issue resolution tracking
- File attachments for evidence
- Department-specific issue tracking

---

### Rework Management

#### All Layers
```http
GET    /api/reworks
GET    /api/reworks/{id}
POST   /api/projects/{projectId}/reworks
```

#### Layer 2 + Admin
```http
POST   /api/reworks/{id}/approve
POST   /api/reworks/{id}/reject
```

**Functionality:**
- Cross-department rework requests
- Approval/rejection workflow
- Automatic new routing creation on approval
- Rework status tracking

---

### Material Requisitions

#### All Layers
```http
GET    /api/materials
POST   /api/materials
GET    /api/materials/{id}
```

#### Layer 2 + Admin
```http
POST   /api/materials/{id}/review
```

**Functionality:**
- Material request creation
- Line item management
- Approval workflow
- Status tracking (pending, approved, rejected, fulfilled)

---

### Query System

#### All Layers
```http
GET    /api/queries
POST   /api/queries
GET    /api/queries/{id}
POST   /api/queries/{id}/messages
POST   /api/queries/{id}/files
POST   /api/queries/{id}/resolve
```

**Functionality:**
- Cross-layer communication
- Message threading
- File attachments
- Query resolution tracking

---

### Daily Reports

#### All Layers
```http
GET    /api/reports
POST   /api/reports
GET    /api/reports/{id}
POST   /api/reports/{id}/files
```

**Functionality:**
- Daily progress reporting
- Department-wise reporting
- File attachments
- Project-specific reports

---

### Notifications

#### All Layers
```http
GET    /api/notifications
GET    /api/notifications/count
PATCH  /api/notifications/{id}/read
POST   /api/notifications/read-all
DELETE /api/notifications/read
```

**Functionality:**
- Real-time notification system
- Priority-based categorization
- Read/unread status management
- Bulk operations (mark all read, delete read)

---

### Search & Dashboard

#### All Layers
```http
GET    /api/search
```

#### Admin Only
```http
GET    /api/dashboard/stats
```

**Functionality:**
- Global search across entities
- Dashboard statistics
- Real-time metrics calculation

---

### AI Assistant

#### Admin Only
```http
POST   /api/ai/chat
```

**Functionality:**
- AI-powered workflow guidance
- Context-aware responses
- Process optimization suggestions

---

## Frontend-Backend Data Flow

### API Service Layer Pattern

The frontend uses a centralized API service layer with caching:

```typescript
// Example API Call Pattern
export const projectApi = {
  list: async (params?: { page?: number; page_size?: number }) => {
    const cacheKey = '/projects'
    const cached = cacheService.get<PaginatedResponse<Project>>(cacheKey, params)
    if (cached) return cached  // Return cached data if available

    const res = await api.get<ApiResponse<PaginatedResponse<Project>>>('/projects', { params })
    const data = unwrap(res)
    cacheService.set(cacheKey, data, params)  // Cache the response
    return data
  },
  
  create: async (data: Partial<Project>) => {
    const res = await api.post<ApiResponse<Project>>('/projects', data)
    const result = unwrap(res)
    cacheService.invalidate('/projects')  // Invalidate cache on write
    return result
  }
}
```

### Request Lifecycle

1. **User Action** → UI Component
2. **API Call** → Frontend Service Layer
3. **Cache Check** → In-Memory Cache Service
4. **HTTP Request** → Axios with JWT token
5. **Backend Processing** → Chi Router → Middleware → Handler → Service → Database
6. **Response** → JSON response with standardized format
7. **Cache Update** → Store response in cache
8. **UI Update** → React state update with new data

### Standard API Response Format

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

### Error Handling

- **401 Unauthorized**: Auto-redirect to login, clear tokens
- **403 Forbidden**: Show permission error
- **404 Not Found**: Show entity not found error
- **500 Server Error**: Show generic error message
- **Network Error**: Show connection error

---

## Authentication & Authorization

### JWT Token Flow

```
┌─────────────┐
│   Login     │
│  Request    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Validate    │
│ Credentials │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Generate    │
│ JWT Token   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Return      │
│ Token +     │
│ User Data   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Store in    │
│ localStorage│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Attach to   │
│ All Requests│
└─────────────┘
```

### Middleware Chain

```go
// Request Flow
Request → Logger → CORS → AuthMiddleware → ValidateEmployee → LayerMiddleware → Handler
```

### Layer-Based Access Control

```go
// Example: Require specific layers
r.Use(appmiddleware.RequireLayer(models.LayerTwo, models.LayerOne, models.LayerSuperAdmin))
```

**Access Matrix:**

| Feature | Super Admin | Layer 1 | Layer 2 | Layer 3 |
|---------|-------------|---------|---------|---------|
| Organization Management | ✅ | ✅ | ❌ | ❌ |
| Employee Management | ✅ | ✅ | ❌ | ❌ |
| Project CRUD | ✅ | ✅ | ❌ | ❌ |
| Routing Builder | ✅ | ✅ | ✅ | ❌ |
| Approvals | ✅ | ✅ | ✅ | ❌ |
| Task Execution | ✅ | ✅ | ✅ | ✅ |
| Issue Raising | ✅ | ✅ | ✅ | ✅ |
| Reporting | ✅ | ✅ | ✅ | ✅ |

---

## Caching Strategy

### Frontend In-Memory Cache

**Implementation:** JavaScript Map-based singleton service

**Cache Keys:** URL + parameters (JSON sorted)

**Invalidation:**
- Write operations invalidate related cache entries
- Pattern-based invalidation for nested resources
- Manual refresh buttons for user-triggered updates

**Example:**
```typescript
// Cache Key Generation
private generateKey(url: string, params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) {
    return url
  }
  const paramString = JSON.stringify(params, Object.keys(params).sort())
  return `${url}:${paramString}`
}
```

**Cache Flow:**
```
API Request → Check Cache → Hit? Return Data : Miss? Fetch API → Cache Response → Return Data
Write Operation → Invalidate Related Cache → Next Request Fetches Fresh Data
```

---

## Background Jobs

### Overdue Task Notifier

**Schedule:** Every hour

**Process:**
1. Scan all overdue tasks across all organizations
2. Identify tasks past due date (not completed)
3. Send notifications to Layer 1, Layer 2, and Super Admin
4. Include project and department context

**Implementation:**
```go
go func() {
    ticker := time.NewTicker(1 * time.Hour)
    defer ticker.Stop()
    for range ticker.C {
        tasks, err := taskSvc.GetOverdueTasks(uuid.Nil)
        // Send notifications for each overdue task
    }
}()
```

---

## File Management

### S3 Integration

**Upload Flow:**
```
File Selection → Client Compression → Generate S3 Key → Upload to S3 → Store File Asset Record → Return URL
```

**File Types Supported:**
- Images (JPG, PNG, GIF) - Auto-compressed
- Documents (PDF, DOC, DOCX)
- CAD Files (DWG, DXF)
- Archives (ZIP, RAR)

**Access Control:**
- Presigned URLs for secure access
- Owner-based access validation
- Public avatar proxy endpoint

**Compression:**
- Images automatically compressed on upload
- Quality: 85%
- Max dimensions: 1920x1080

---

## Notification System

### Notification Types

```go
const (
    NotifProjectCreated          NotificationType = "project_created"
    NotifRoutingAssigned         NotificationType = "routing_assigned"
    NotifRoutingUpdated          NotificationType = "routing_updated"
    NotifTaskAssigned            NotificationType = "task_assigned"
    NotifTaskStarted             NotificationType = "task_started"
    NotifTaskCompleted           NotificationType = "task_completed"
    NotifSubtaskCompleted        NotificationType = "subtask_completed"
    NotifProofUploaded           NotificationType = "proof_uploaded"
    NotifDailyReportSubmitted    NotificationType = "daily_report_submitted"
    NotifIssueRaised             NotificationType = "issue_raised"
    NotifIssueApproved           NotificationType = "issue_approved"
    NotifIssueClosed             NotificationType = "issue_closed"
    NotifIssueRejected           NotificationType = "issue_rejected"
    NotifMaterialRequest         NotificationType = "material_request"
    NotifMaterialApproved        NotificationType = "material_approved"
    NotifMaterialRejected        NotificationType = "material_rejected"
    NotifReworkRequest           NotificationType = "rework_request"
    NotifReworkApproved          NotificationType = "rework_approved"
    NotifReworkRejected          NotificationType = "rework_rejected"
    NotifQueryReceived           NotificationType = "query_received"
    NotifQueryReplied            NotificationType = "query_replied"
    NotifQueryClosed             NotificationType = "query_closed"
    NotifOverdueTask             NotificationType = "overdue_task"
)
```

### Priority Levels

- **Critical**: Immediate attention required (overdue tasks, rework requests)
- **Important**: Resolution needed (approvals, material requests)
- **Standard**: Informational (task completion, daily reports)

### Notification Flow

```
Event Occurs → Service Layer Detects → Notification Service Creates → Database Store → Real-time Delivery
```

### Layer-Based Notifications

```go
// Send to specific layers
notifSvc.NotifyLayer(orgID, 
    []models.LayerType{models.LayerTwo, models.LayerOne, models.LayerSuperAdmin},
    models.NotifOverdueTask,
    "Overdue Task",
    message,
    &projectID, "task", &taskID,
)
```

---

## Performance Optimizations

### Database
- Connection pooling
- Indexed foreign keys
- Query optimization with joins
- Pagination for large datasets

### Frontend
- In-memory caching
- Lazy loading for large lists
- Code splitting with Vite
- Image optimization
- Debounced search inputs

### Backend
- Gzip compression middleware
- Request timeout handling
- Efficient JSON marshaling
- Background job processing

---

## Security Considerations

### Authentication
- JWT token expiration
- Secure password hashing (bcrypt)
- Token refresh mechanism
- Session validation on each request

### Authorization
- Layer-based access control
- Employee validation middleware
- Department-level restrictions
- Admin-only endpoints protection

### Data Protection
- SQL injection prevention (parameterized queries)
- XSS protection (input sanitization)
- CSRF protection (same-site cookies)
- File upload validation

### Audit Trail
- Immutable audit logs
- User action attribution
- IP address logging
- Entity change tracking

---

## Deployment Architecture

### Production Setup

```
┌─────────────┐
│   Load      │
│  Balancer   │
└──────┬──────┘
       │
       ├──────────┬──────────┐
       │          │          │
       ▼          ▼          ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│ Backend │ │ Backend │ │ Backend │
│ Instance│ │ Instance│ │ Instance│
└────┬────┘ └────┬────┘ └────┬────┘
     │           │           │
     └───────────┴───────────┘
                 │
                 ▼
         ┌───────────────┐
         │  PostgreSQL   │
         │  (Primary)    │
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │  PostgreSQL   │
         │  (Replica)    │
         └───────────────┘
```

### Environment Variables

**Backend:**
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret
- `AWS_ACCESS_KEY_ID`: S3 access key
- `AWS_SECRET_ACCESS_KEY`: S3 secret key
- `AWS_REGION`: S3 region
- `S3_BUCKET`: S3 bucket name
- `APP_ENV`: Environment (development, production)

**Frontend:**
- `VITE_API_URL`: Backend API URL

---

## Monitoring & Logging

### Request Logging
- Request ID tracking
- Response time logging
- Error logging with stack traces
- IP address logging

### Audit Logging
- All write operations logged
- Entity change tracking
- User attribution
- Timestamp tracking

### Health Checks
- Database connectivity
- S3 connectivity
- Memory usage
- Request latency

---

## Development Workflow

### Backend Development
1. Make changes to service/handler layers
2. Run migrations: `go run cmd/migrate.go`
3. Test with Postman/curl
4. Build: `go build -o pms-backend cmd/main.go`
5. Run: `./pms-backend`

### Frontend Development
1. Make changes to components/services
2. Test with: `npm run dev`
3. Build: `npm run build`
4. Preview: `npm run preview`

### Database Migrations
- Located in `backend/migrations/`
- Run automatically on server startup
- Manual migration: `go run cmd/migrate.go`

---

## Troubleshooting

### Common Issues

**CORS Errors:**
- Check CORS configuration in backend
- Verify frontend API URL

**Authentication Failures:**
- Verify JWT secret matches
- Check token expiration
- Validate employee is active

**Database Connection:**
- Check DATABASE_URL format
- Verify PostgreSQL is running
- Check network connectivity

**File Upload Failures:**
- Verify S3 credentials
- Check bucket permissions
- Validate file size limits

---

## Future Enhancements

### Planned Features
- WebSocket real-time updates
- Mobile application (React Native)
- Advanced analytics dashboard
- Machine learning for production optimization
- Integration with ERP systems
- Multi-language support
- Advanced reporting with PDF export
- Calendar integration
- Email notifications
- Two-factor authentication

### Scalability Improvements
- Redis caching layer
- Message queue for background jobs
- Microservices architecture
- CDN for static assets
- Database sharding for multi-tenant

---

## Support & Maintenance

### Backup Strategy
- Daily database backups
- S3 bucket versioning
- Audit log archival
- Configuration backup

### Monitoring
- Application performance monitoring
- Error tracking (Sentry)
- Uptime monitoring
- Resource usage tracking

### Update Process
- Zero-downtime deployments
- Database migration testing
- Feature flags for gradual rollout
- Rollback capability

---

*This architecture document is maintained alongside the codebase and should be updated with any significant architectural changes.*
