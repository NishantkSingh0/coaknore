import axios, { AxiosError } from 'axios'
import type {
  Employee, Department, Project, ProjectRevision, Routing, RoutingEditTimeline, DepartmentTask,
  Subtask, Issue, ReworkRequest, Query, QueryMessage, DailyReport,
  MaterialRequisition, Notification, AuditLog, FileAsset, Organization,
  DashboardStats, SearchResult, PaginatedResponse, ApiResponse,
  ProjectStatus, TaskStatus, IssueType, DependencyPolicy, DepartmentLayer,
  LayerType, MaterialItem, UpcomingTask
} from '../types'

const RAW_BASE_URL = import.meta.env.VITE_API_URL ?? '/api'
export const API_BASE_URL = RAW_BASE_URL.endsWith('/') ? RAW_BASE_URL.slice(0, -1) : RAW_BASE_URL

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

// Attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pms_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pms_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

const unwrap = <T>(res: { data: ApiResponse<T> }): T => {
  if (!res.data.success) throw new Error(res.data.error || 'Unknown error')
  return res.data.data as T
}

// ============================================================
// AUTH API - Pure API calls, no caching
// ============================================================
export const authApi = {
  login: (email: string, password: string) => 
    api.post<ApiResponse<{ token: string; employee: Employee }>>('/auth/login', { email, password }).then(unwrap),
  
  me: () => 
    api.get<ApiResponse<Employee>>('/auth/me').then(unwrap),
  
  changePassword: (currentPassword: string, newPassword: string) => 
    api.post<ApiResponse<{ message: string }>>('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }).then(unwrap),
  
  forgotPassword: (email: string) => 
    api.post<ApiResponse<{ message: string }>>('/auth/forgot-password', { email }).then(unwrap),
  
  resetPassword: (token: string, newPassword: string) => 
    api.post<ApiResponse<{ message: string }>>('/auth/reset-password', {
      token,
      new_password: newPassword,
    }).then(unwrap),
  
  updateAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('avatar', file)
    return api.post<ApiResponse<Employee>>('/auth/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },
  
  removeAvatar: () => 
    api.delete<ApiResponse<Employee>>('/auth/me/avatar').then(unwrap),
}

// ============================================================
// ORGANIZATION API
// ============================================================
export const orgApi = {
  getOrganization: () => 
    api.get<ApiResponse<Organization>>('/organization').then(unwrap),
  
  listDepartments: (layer?: DepartmentLayer) => 
    api.get<ApiResponse<Department[]>>('/departments', { params: { layer } }).then(unwrap),
  
  getDepartment: (id: string) => 
    api.get<ApiResponse<Department>>(`/departments/${id}`).then(unwrap),
  
  createDepartment: (data: { name: string; description?: string; layer: DepartmentLayer }) => 
    api.post<ApiResponse<Department>>('/departments', data).then(unwrap),
  
  updateDepartment: (id: string, data: { name: string; description?: string }) => 
    api.put<ApiResponse<Department>>(`/departments/${id}`, data).then(unwrap),
  
  toggleDepartment: (id: string, active: boolean) => 
    api.patch<ApiResponse<{ active: boolean }>>(`/departments/${id}/toggle`, { active }).then(unwrap),
  
  listEmployees: (params?: {
    page?: number; page_size?: number; search?: string;
    layer?: LayerType; department_id?: string; active?: boolean
  }) => 
    api.get<ApiResponse<PaginatedResponse<Employee>>>('/employees', { params }).then(unwrap),
  
  getEmployee: (id: string) => 
    api.get<ApiResponse<Employee>>(`/employees/${id}`).then(unwrap),
  
  createEmployee: (data: {
    department_id?: string; email: string; password: string;
    first_name: string; last_name: string; phone?: string; layer: LayerType
  }) => 
    api.post<ApiResponse<Employee>>('/employees', data).then(unwrap),
  
  updateEmployee: (id: string, data: {
    department_id?: string; first_name: string; last_name: string;
    phone?: string; layer?: string
  }) => 
    api.put<ApiResponse<Employee>>(`/employees/${id}`, data).then(unwrap),
  
  toggleEmployee: (id: string, active: boolean) => 
    api.patch<ApiResponse<{ active: boolean }>>(`/employees/${id}/toggle`, { active }).then(unwrap),
  
  transferEmployee: (id: string, department_id: string) => 
    api.post<ApiResponse<{ message: string }>>(`/employees/${id}/transfer`, { department_id }).then(unwrap),
  
  resetEmployeePassword: (id: string, new_password: string) => 
    api.post<ApiResponse<{ message: string }>>(`/employees/${id}/reset-password`, { new_password }).then(unwrap),
  
  searchEmployees: (q: string) => 
    api.get<ApiResponse<Employee[]>>('/employees/search', { params: { q } }).then(unwrap),
}

// ============================================================
// PROJECT API
// ============================================================
export const projectApi = {
  list: (params?: { page?: number; page_size?: number; status?: ProjectStatus; search?: string }) => 
    api.get<ApiResponse<PaginatedResponse<Project>>>('/projects', { params }).then(unwrap),
  
  get: (id: string) => 
    api.get<ApiResponse<Project>>(`/projects/${id}`).then(unwrap),
  
  getRestricted: (id: string) => 
    api.get<ApiResponse<Project>>(`/projects/${id}/restricted`).then(unwrap),
  
  create: (data: Partial<Project>) => 
    api.post<ApiResponse<Project>>('/projects', data).then(unwrap),
  
  update: (id: string, data: Partial<Project>) => 
    api.put<ApiResponse<Project>>(`/projects/${id}`, data).then(unwrap),
  
  updateStatus: (id: string, status: ProjectStatus) => 
    api.patch<ApiResponse<Project>>(`/projects/${id}/status`, { status }).then(unwrap),
  
  uploadDrawing: (id: string, file: File) => {
    const formData = new FormData()
    formData.append('drawing', file)
    return api.post<ApiResponse<Project>>(`/projects/${id}/drawing`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },
  
  delete: (id: string) => 
    api.delete<ApiResponse<{ message: string }>>(`/projects/${id}`).then(unwrap),
  
  getRevisions: (id: string) => 
    api.get<ApiResponse<ProjectRevision[]>>(`/projects/${id}/revisions`).then(unwrap),
  
  getTimeline: (id: string) => 
    api.get<ApiResponse<AuditLog[]>>(`/projects/${id}/timeline`).then(unwrap),
  
  raise: (projectId: string, data: {
    type: IssueType
    title: string
    description: string
    department_id: string
  }) => 
    api.post<ApiResponse<Issue>>(`/projects/${projectId}/issues`, data).then(unwrap),
}

// ============================================================
// ROUTING API
// ============================================================
export const routingApi = {
  list: (projectId: string) => 
    api.get<ApiResponse<Routing[]>>(`/projects/${projectId}/routings`).then(unwrap),
  
  listForProject: (projectId: string) => 
    api.get<ApiResponse<Routing[]>>(`/projects/${projectId}/routings`).then(unwrap),
  
  get: (id: string) => 
    api.get<ApiResponse<Routing>>(`/routings/${id}`).then(unwrap),
  
  create: (projectId: string, data: Partial<Routing>) => 
    api.post<ApiResponse<Routing>>(`/projects/${projectId}/routings`, data).then(unwrap),
  
  update: (id: string, data: Partial<Routing>) => 
    api.put<ApiResponse<Routing>>(`/routings/${id}`, data).then(unwrap),
  
  createNewVersion: (id: string) => 
    api.post<ApiResponse<Routing>>(`/routings/${id}/new-version`).then(unwrap),
  
  publish: (id: string) => 
    api.post<ApiResponse<Routing>>(`/routings/${id}/publish`).then(unwrap),
  
  getTemplates: () => 
    api.get<ApiResponse<Routing[]>>('/routing-templates').then(unwrap),
  
  getTimeline: (id: string) => 
    api.get<ApiResponse<RoutingEditTimeline[]>>(`/routings/${id}/timeline`).then(unwrap),
  
  getEditTimeline: (id: string) => 
    api.get<ApiResponse<RoutingEditTimeline[]>>(`/routings/${id}/timeline`).then(unwrap),
  
  getUpcomingTasks: (departmentId: string) => 
    api.get<ApiResponse<UpcomingTask[]>>(`/departments/${departmentId}/upcoming-tasks`).then(unwrap),
}

// ============================================================
// TASK API
// ============================================================
export const taskApi = {
  list: (projectId: string) => 
    api.get<ApiResponse<DepartmentTask[]>>(`/projects/${projectId}/tasks`).then(unwrap),
  
  getProjectTasks: (projectId: string) => 
    api.get<ApiResponse<DepartmentTask[]>>(`/projects/${projectId}/tasks`).then(unwrap),
  
  get: (id: string) => 
    api.get<ApiResponse<DepartmentTask>>(`/tasks/${id}`).then(unwrap),
  
  getTask: (id: string) => 
    api.get<ApiResponse<DepartmentTask>>(`/tasks/${id}`).then(unwrap),
  
  getMyTasks: (params?: { page?: number; page_size?: number; status?: TaskStatus }) => 
    api.get<ApiResponse<DepartmentTask[]>>('/my-tasks', { params }).then(unwrap),
  
  updateStatus: (id: string, status: TaskStatus) => 
    api.patch<ApiResponse<DepartmentTask>>(`/tasks/${id}/status`, { status }).then(unwrap),
  
  assignEmployees: (id: string, employee_ids: string[]) => 
    api.post<ApiResponse<DepartmentTask>>(`/tasks/${id}/assign-employees`, { employee_ids }).then(unwrap),
  
  setDates: (id: string, start_date?: string, due_date?: string) => 
    api.patch<ApiResponse<DepartmentTask>>(`/tasks/${id}/dates`, { start_date, due_date }).then(unwrap),
  
  setExpectedCompletion: (id: string, expected_completion: string) =>
    api.patch<ApiResponse<DepartmentTask>>(`/tasks/${id}/expected-completion`, { expected_completion_date: expected_completion }).then(unwrap),
  
  uploadDepartmentFile: (id: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ApiResponse<{ message: string }>>(`/tasks/${id}/department-file`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },
  
  // Subtasks
  createSubtask: (taskId: string, data: { title: string; description?: string }) => 
    api.post<ApiResponse<Subtask>>(`/tasks/${taskId}/subtasks`, data).then(unwrap),
  
  updateSubtask: (id: string, data: { title?: string; description?: string }) => 
    api.put<ApiResponse<Subtask>>(`/subtasks/${id}`, data).then(unwrap),
  
  completeSubtask: (id: string) => 
    api.patch<ApiResponse<Subtask>>(`/subtasks/${id}/complete`).then(unwrap),
  
  uploadSubtaskProof: (id: string, files: File[]) => {
    const formData = new FormData()
    files.forEach(file => formData.append('proofs', file))
    return api.post<ApiResponse<Subtask>>(`/subtasks/${id}/proof`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },
}

// ============================================================
// ISSUE API
// ============================================================
export const issueApi = {
  list: (params?: { page?: number; page_size?: number; status?: string; search?: string }) => 
    api.get<ApiResponse<Issue[]>>('/issues', { params }).then(unwrap),
  
  get: (id: string) => 
    api.get<ApiResponse<Issue>>(`/issues/${id}`).then(unwrap),
  
  create: (projectId: string, data: {
    type: IssueType
    title: string
    description: string
    department_id: string
  }) => 
    api.post<ApiResponse<Issue>>(`/projects/${projectId}/issues`, data).then(unwrap),
  
  resolve: (id: string, resolution_notes: string) => 
    api.post<ApiResponse<Issue>>(`/issues/${id}/resolve`, { resolution_notes }).then(unwrap),
  
  review: (id: string, approved: boolean, review_notes?: string) => 
    api.post<ApiResponse<Issue>>(`/issues/${id}/review`, { approved, review_notes }).then(unwrap),
  
  uploadFiles: (id: string, files: File[]) => {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    return api.post<ApiResponse<{ message: string }>>(`/issues/${id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },
  
  uploadFile: (id: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ApiResponse<{ message: string }>>(`/issues/${id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },
  
  raise: (projectId: string, data: {
    type: IssueType
    title: string
    description: string
    department_id: string
  }) => 
    api.post<ApiResponse<Issue>>(`/projects/${projectId}/issues`, data).then(unwrap),
}

// ============================================================
// REWORK API
// ============================================================
export const reworkApi = {
  list: (params?: { page?: number; page_size?: number; status?: string }) => 
    api.get<ApiResponse<ReworkRequest[]>>('/reworks', { params }).then(unwrap),
  
  get: (id: string) => 
    api.get<ApiResponse<ReworkRequest>>(`/reworks/${id}`).then(unwrap),
  
  create: (projectId: string, data: {
    task_id: string
    department_id: string
    reason: string
  }) => 
    api.post<ApiResponse<ReworkRequest>>(`/projects/${projectId}/reworks`, data).then(unwrap),
  
  approve: (id: string, review_notes?: string) => 
    api.post<ApiResponse<ReworkRequest>>(`/reworks/${id}/approve`, { review_notes }).then(unwrap),
  
  reject: (id: string, review_notes?: string) => 
    api.post<ApiResponse<ReworkRequest>>(`/reworks/${id}/reject`, { review_notes }).then(unwrap),
}

// ============================================================
// MATERIAL API
// ============================================================
export const materialApi = {
  list: (params?: { page?: number; page_size?: number; status?: string }) => 
    api.get<ApiResponse<MaterialRequisition[]>>('/materials', { params }).then(unwrap),
  
  get: (id: string) => 
    api.get<ApiResponse<MaterialRequisition>>(`/materials/${id}`).then(unwrap),
  
  create: (data: {
    project_id: string
    title: string
    description: string
    dept_id: string
    items: MaterialItem[]
  }) => 
    api.post<ApiResponse<MaterialRequisition>>('/materials', data).then(unwrap),
  
  review: (id: string, approved: boolean, review_notes?: string) => 
    api.post<ApiResponse<MaterialRequisition>>(`/materials/${id}/review`, { approved, review_notes }).then(unwrap),
}

// ============================================================
// QUERY API
// ============================================================
export const queryApi = {
  list: (params?: { page?: number; page_size?: number }) => 
    api.get<ApiResponse<Query[]>>('/queries', { params }).then(unwrap),
  
  get: (id: string) => 
    api.get<ApiResponse<Query>>(`/queries/${id}`).then(unwrap),
  
  create: (data: { subject: string; message: string; project_id?: string }) => 
    api.post<ApiResponse<Query>>('/queries', data).then(unwrap),
  
  sendMessage: (id: string, message: string) => 
    api.post<ApiResponse<QueryMessage>>(`/queries/${id}/messages`, { message }).then(unwrap),
  
  uploadFiles: (id: string, files: File[]) => {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    return api.post<ApiResponse<{ message: string }>>(`/queries/${id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },
  
  resolve: (id: string) => 
    api.post<ApiResponse<Query>>(`/queries/${id}/resolve`).then(unwrap),
  
  markResolved: (id: string) => 
    api.post<ApiResponse<Query>>(`/queries/${id}/resolve`).then(unwrap),
  
  uploadFile: (id: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ApiResponse<{ message: string }>>(`/queries/${id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },
}

// ============================================================
// REPORT API
// ============================================================
export const reportApi = {
  list: (params?: { page?: number; page_size?: number; search?: string }) => 
    api.get<ApiResponse<DailyReport[]>>('/reports', { params }).then(unwrap),
  
  get: (id: string) => 
    api.get<ApiResponse<DailyReport>>(`/reports/${id}`).then(unwrap),
  
  create: (data: {
    project_id: string
    dept_id: string
    description: string
    report_date: string
  }) => 
    api.post<ApiResponse<DailyReport>>('/reports', data).then(unwrap),
  
  uploadFiles: (id: string, files: File[]) => {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    return api.post<ApiResponse<{ message: string }>>(`/reports/${id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },
  
  uploadFile: (id: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ApiResponse<{ message: string }>>(`/reports/${id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap)
  },
}

// ============================================================
// NOTIFICATION API
// ============================================================
export const notificationApi = {
  list: (params?: { page?: number; page_size?: number; unread?: boolean }) => 
    api.get<ApiResponse<Notification[]>>('/notifications', { params }).then(unwrap),
  
  getCount: () => 
    api.get<ApiResponse<{ count: number }>>('/notifications/count').then(unwrap),
  
  markRead: (id: string) => 
    api.patch<ApiResponse<Notification>>(`/notifications/${id}/read`).then(unwrap),
  
  markAllRead: () => 
    api.post<ApiResponse<{ message: string }>>('/notifications/read-all').then(unwrap),
  
  deleteRead: () => 
    api.delete<ApiResponse<{ message: string }>>('/notifications/read').then(unwrap),
}

// ============================================================
// SEARCH API
// ============================================================
export const searchApi = {
  search: (q: string) => 
    api.get<ApiResponse<SearchResult>>('/search', { params: { q } }).then(unwrap),
  
  getDashboardStats: () => 
    api.get<ApiResponse<DashboardStats>>('/dashboard/stats').then(unwrap),
}

// ============================================================
// AI API
// ============================================================
export const aiApi = {
  chat: (message: string, context?: string) => 
    api.post<ApiResponse<{ response: string }>>('/ai/chat', { message, context }).then(unwrap),
}
