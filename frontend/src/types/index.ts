export type Role = 'admin' | 'layer2' | 'layer3'

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  role: Role
  department_id?: string
  dept_layer: number
  is_active: boolean
  last_login_at?: string
  addon?: string
  avatar_url?: string
  created_at: string
}

export interface Department {
  id: string
  name: string
  layer: 2 | 3
  description?: string
  is_active: boolean
  created_at: string
}

export type ProjectStatus = 'pending' | 'routing_set' | 'in_progress' | 'completed' | 'on_hold'

export interface Project {
  id: string
  po_number: string
  project_name: string
  receiving_date: string
  image_url?: string
  quantity: number
  rates: number
  dimensions?: string
  remarks?: string
  specification?: string
  upholstery_finish?: string
  cad_urls?: string
  pdf_urls?: string
  render_urls?: string
  jobcard_urls?: string
  current_status: ProjectStatus
  created_by?: string
  routing_set_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export type TaskStatus = 'pending' | 'in_progress' | 'hold' | 'issue_hold' | 'completed'

export interface Task {
  id: string
  routing_id: string
  project_id: string
  department_id: string
  assigned_to_user_id?: string
  start_date?: string
  due_date?: string
  status: TaskStatus
  completed_at?: string
  is_overdue: boolean
  addon?: string
  project_name: string
  po_number: string
  dept_name: string
  sequence_order: number
  created_at: string
}

export type IssueType = 'item_missing' | 'design_change' | 'routing_required' | 'fullscale_required' | 'rework_required'
export type IssueStatus = 'open' | 'pending_approval' | 'approved' | 'rejected' | 'closed'

export interface Issue {
  id: string
  project_id: string
  task_id?: string
  raised_by_dept_id: string
  raised_by_user_id: string
  issue_type: IssueType
  status: IssueStatus
  description?: string
  approved_by_user_id?: string
  approved_at?: string
  closed_at?: string
  created_at: string
}

export interface DailyReport {
  id: string
  project_id: string
  department_id: string
  submitted_by: string
  report_date: string
  description: string
  image_url?: string
  project_name: string
  dept_name: string
  user_name: string
  created_at: string
}

export interface Notification {
  id: string
  recipient_id?: string
  dept_id?: string
  project_id?: string
  issue_id?: string
  title: string
  body?: string
  type: string
  is_read: boolean
  read_at?: string
  created_at: string
}

export interface RoutingEntry {
  id: string
  project_id: string
  department_id: string
  department_name: string
  sequence_order: number
  status: string
  started_at?: string
  completed_at?: string
  completion_proof_url?: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  department_id: string
  dept_layer: number
  avatar_url?: string
}
