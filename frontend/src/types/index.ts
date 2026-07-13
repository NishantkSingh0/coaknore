// ============================================================
// ENUMS
// ============================================================

export type LayerType = 'super_admin' | 'layer1' | 'layer2' | 'layer3'
export type DepartmentLayer = 'layer2' | 'layer3'
export type ProjectStatus = 'created' | 'routing' | 'in_progress' | 'completed' | 'archived' | 'on_hold'
export type TaskStatus = 'pending' | 'in_progress' | 'hold' | 'issue_hold' | 'completed' | 'on_hold'
export type SubtaskStatus = 'pending' | 'in_progress' | 'completed'
export type RoutingStatus = 'draft' | 'active' | 'superseded' | 'archived'
export type DependencyPolicy = 'require_all' | 'require_any'
export type IssueStatus = 'open' | 'pending_approval' | 'approved' | 'rejected' | 'resolved' | 'closed'
export type IssueType = 'material_missing' | 'design_change' | 'routing_required' | 'full_scale_requirement' | 'quality_issue' | 'rework_required' | 'custom'
export type ReworkStatus = 'pending' | 'approved' | 'rejected' | 'in_progress' | 'completed'
export type QueryStatus = 'open' | 'sender_resolved' | 'recipient_resolved' | 'closed'
export type MaterialRequestStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled'
export type NotificationType = string

// ============================================================
// MODELS
// ============================================================

export interface Organization {
  id: string
  name: string
  description: string
  logo_url?: string
  created_at: string
  updated_at: string
}

export interface Department {
  id: string
  organization_id: string
  name: string
  description?: string
  layer: DepartmentLayer
  is_active: boolean
  employee_count?: number
  created_at: string
  updated_at: string
}

export interface Employee {
  id: string
  organization_id: string
  department_id?: string
  department_name?: string
  email: string
  first_name: string
  last_name: string
  full_name?: string
  phone?: string
  avatar_url?: string
  layer: LayerType
  is_active: boolean
  last_login_at?: string
  created_at: string
  updated_at: string
}

export interface Dimensions {
  width: number
  height: number
  depth: number
  unit: string
}

export interface Project {
  id: string
  organization_id: string
  po_number: string
  project_name: string
  client_name: string
  client_email?: string
  client_phone?: string
  client_address?: string
  quantity: number
  specifications?: string
  material_details?: string
  upholstery_details?: string
  delivery_date?: string
  delivery_address?: string
  cover_image_url?: string
  cad_files_url?: string
  job_cards_url?: string
  render_files_url?: string
  drawing_file_id?: string
  drawing_file?: FileAsset
  status: ProjectStatus
  created_by: string
  created_by_name?: string
  current_revision: number
  completed_at?: string
  archived_at?: string
  created_at: string
  updated_at: string
}

export interface ProjectRevision {
  id: string
  project_id: string
  revision_number: number
  revised_by: string
  revised_by_name?: string
  reason: string
  client_request?: string
  previous_values: Record<string, unknown>
  updated_values: Record<string, unknown>
  routing_changed: boolean
  departments_reopened: string[]
  subtasks_reopened: string[]
  notifications_sent: boolean
  created_at: string
}

export interface RoutingStep {
  id: string
  routing_id: string
  step_order: number
  name?: string
  dependency_policy: DependencyPolicy
  is_active: boolean
  departments: Department[]
  tasks?: DepartmentTask[]
  created_at: string
}

export interface Routing {
  id: string
  project_id: string
  version: number
  name?: string
  description?: string
  status: RoutingStatus
  parent_routing_id?: string
  routing_type: string
  created_by: string
  created_by_name?: string
  published_at?: string
  steps: RoutingStep[]
  created_at: string
  updated_at: string
}

export interface DepartmentTask {
  id: string
  project_id: string
  project_name?: string
  routing_id: string
  routing_step_id: string
  department_id: string
  department_name?: string
  title?: string
  description?: string
  priority: number
  status: TaskStatus
  start_date?: string
  due_date?: string
  expected_completion_date?: string
  completion_date_locked: boolean
  routed_to_dept_at?: string
  dates_frozen: boolean
  started_at?: string
  completed_at?: string
  assigned_employees?: Employee[]
  subtasks?: Subtask[]
  created_at: string
  updated_at: string
}

export interface Subtask {
  id: string
  task_id: string
  title: string
  description?: string
  is_required: boolean
  status: SubtaskStatus
  assigned_to?: string
  assignee_name?: string
  notes?: string
  sort_order: number
  completed_at?: string
  completed_by?: string
  files?: FileAsset[]
  created_at: string
  updated_at: string
}

export interface Issue {
  id: string
  project_id: string
  task_id?: string
  department_id: string
  department_name?: string
  raised_by: string
  raised_by_name?: string
  type: IssueType
  title: string
  description: string
  status: IssueStatus
  assigned_to_dept_id?: string
  assigned_to_dept?: string
  reviewed_by?: string
  reviewed_by_name?: string
  review_notes?: string
  reviewed_at?: string
  resolved_by?: string
  resolved_by_name?: string
  resolved_at?: string
  resolution_notes?: string
  // Material Missing extras
  material_name?: string
  material_description?: string
  required_quantity?: number
  material_unit?: string
  material_remarks?: string
  files?: FileAsset[]
  created_at: string
  updated_at: string
}

export interface RoutingEditTimeline {
  id: string
  routing_id: string
  edited_by: string
  editor_email: string
  editor_name: string
  edit_reason: string
  changes_summary?: string
  created_at: string
}

export interface ReworkRequest {
  id: string
  project_id: string
  requesting_task_id: string
  requesting_dept_id: string
  requesting_dept_name?: string
  requested_by: string
  requested_by_name?: string
  target_department_id: string
  target_dept_name?: string
  reason: string
  description?: string
  status: ReworkStatus
  reviewed_by?: string
  reviewed_by_name?: string
  review_notes?: string
  reviewed_at?: string
  new_routing_id?: string
  files?: FileAsset[]
  created_at: string
  updated_at: string
}

export interface MaterialItem {
  id: string
  requisition_id: string
  material_name: string
  quantity: number
  unit: string
  description?: string
  estimated_cost?: number
  created_at: string
}

export interface MaterialRequisition {
  id: string
  project_id: string
  task_id?: string
  department_id: string
  dept_name?: string
  requested_by: string
  requested_by_name?: string
  title: string
  description?: string
  status: MaterialRequestStatus
  reviewed_by?: string
  review_notes?: string
  reviewed_at?: string
  items?: MaterialItem[]
  files?: FileAsset[]
  created_at: string
  updated_at: string
}

export interface QueryMessage {
  id: string
  query_id: string
  sender_id: string
  sender_name?: string
  message?: string
  files?: FileAsset[]
  created_at: string
}

export interface Query {
  id: string
  project_id: string
  project_name?: string
  subject: string
  sender_id: string
  sender_name?: string
  sender_layer?: LayerType
  recipient_id: string
  recipient_name?: string
  recipient_layer?: LayerType
  status: QueryStatus
  sender_resolved: boolean
  recipient_resolved: boolean
  messages?: QueryMessage[]
  last_message?: QueryMessage
  unread_count?: number
  created_at: string
  updated_at: string
}

export interface DailyReport {
  id: string
  project_id: string
  project_name?: string
  department_id: string
  dept_name?: string
  submitted_by: string
  submitted_by_name?: string
  task_id?: string
  description: string
  report_date: string
  files?: FileAsset[]
  created_at: string
}

export interface FileAsset {
  id: string
  organization_id: string
  owner_type: string
  owner_id: string
  project_id?: string
  file_name: string
  original_name: string
  file_size: number
  mime_type: string
  s3_key: string
  s3_url: string
  uploaded_by: string
  uploader_name?: string
  created_at: string
}

export interface Notification {
  id: string
  organization_id: string
  recipient_id: string
  type: NotificationType
  title: string
  body?: string
  project_id?: string
  project_name?: string
  entity_type?: string
  entity_id?: string
  is_read: boolean
  created_at: string
}

export interface AuditLog {
  id: string
  organization_id: string
  project_id?: string
  actor_id?: string
  actor_name?: string
  action: string
  entity_type: string
  entity_id?: string
  entity_name?: string
  before_state?: Record<string, unknown>
  after_state?: Record<string, unknown>
  metadata?: Record<string, unknown>
  ip_address?: string
  created_at: string
}

export interface DashboardStats {
  total_projects: number
  active_projects: number
  delayed_projects: number
  completed_projects: number
  open_issues: number
  pending_reworks: number
  pending_materials: number
  total_employees: number
  total_departments: number
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface SearchResult {
  entity_type: string
  entity_id: string
  title: string
  description?: string
  project_id?: string
  project_name?: string
  status?: string
}
