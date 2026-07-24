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
      localStorage.removeItem('pms_user')
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
// AUTH
// ============================================================

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post<ApiResponse<{ token: string; employee: Employee }>>('/auth/login', { email, password })
    return unwrap(res)
  },
  me: async () => {
    const res = await api.get<ApiResponse<Employee>>('/auth/me')
    return unwrap(res)
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    return unwrap(res)
  },
  forgotPassword: async (email: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>('/auth/forgot-password', { email })
    return unwrap(res)
  },
  resetPassword: async (token: string, newPassword: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>('/auth/reset-password', {
      token,
      new_password: newPassword,
    })
    return unwrap(res)
  },
  updateAvatar: async (file: File) => {
    const formData = new FormData()
    formData.append('avatar', file)
    const res = await api.post<ApiResponse<Employee>>('/auth/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return unwrap(res)
  },
  removeAvatar: async () => {
    const res = await api.delete<ApiResponse<Employee>>('/auth/me/avatar')
    return unwrap(res)
  },
}

// ============================================================
// ORGANIZATION
// ============================================================

export const orgApi = {
  getOrganization: async () => {
    const res = await api.get<ApiResponse<Organization>>('/organization')
    return unwrap(res)
  },

  // Departments
  listDepartments: async (layer?: DepartmentLayer) => {
    const res = await api.get<ApiResponse<Department[]>>('/departments', {
      params: { layer },
    })
    return unwrap(res) || []
  },
  getDepartment: async (id: string) => {
    const res = await api.get<ApiResponse<Department>>(`/departments/${id}`)
    return unwrap(res)
  },
  createDepartment: async (data: { name: string; description?: string; layer: DepartmentLayer }) => {
    const res = await api.post<ApiResponse<Department>>('/departments', data)
    return unwrap(res)
  },
  updateDepartment: async (id: string, data: { name: string; description?: string }) => {
    const res = await api.put<ApiResponse<Department>>(`/departments/${id}`, data)
    return unwrap(res)
  },
  toggleDepartment: async (id: string, active: boolean) => {
    const res = await api.patch<ApiResponse<{ active: boolean }>>(`/departments/${id}/toggle`, { active })
    return unwrap(res)
  },

  // Employees
  listEmployees: async (params?: {
    page?: number; page_size?: number; search?: string;
    layer?: LayerType; department_id?: string; active?: boolean
  }) => {
    const res = await api.get<ApiResponse<PaginatedResponse<Employee>>>('/employees', { params })
    return unwrap(res)
  },
  getEmployee: async (id: string) => {
    const res = await api.get<ApiResponse<Employee>>(`/employees/${id}`)
    return unwrap(res)
  },
  createEmployee: async (data: {
    department_id?: string; email: string; password: string;
    first_name: string; last_name: string; phone?: string; layer: LayerType
  }) => {
    const res = await api.post<ApiResponse<Employee>>('/employees', data)
    return unwrap(res)
  },
  updateEmployee: async (id: string, data: {
    department_id?: string; first_name: string; last_name: string;
    phone?: string; layer?: string
  }) => {
    const res = await api.put<ApiResponse<Employee>>(`/employees/${id}`, data)
    return unwrap(res)
  },
  toggleEmployee: async (id: string, active: boolean) => {
    const res = await api.patch<ApiResponse<{ active: boolean }>>(`/employees/${id}/toggle`, { active })
    return unwrap(res)
  },
  transferEmployee: async (id: string, department_id: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/employees/${id}/transfer`, { department_id })
    return unwrap(res)
  },
  resetEmployeePassword: async (id: string, new_password: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/employees/${id}/reset-password`, { new_password })
    return unwrap(res)
  },
  searchEmployees: async (q: string) => {
    const res = await api.get<ApiResponse<Employee[]>>('/employees/search', { params: { q } })
    return unwrap(res) || []
  },
}

// ============================================================
// PROJECTS
// ============================================================

export const projectApi = {
  list: async (params?: { page?: number; page_size?: number; search?: string; status?: ProjectStatus }) => {
    const res = await api.get<ApiResponse<PaginatedResponse<Project>>>('/projects', { params })
    return unwrap(res)
  },
  get: async (id: string) => {
    const res = await api.get<ApiResponse<Project>>(`/projects/${id}`)
    return unwrap(res)
  },
  getRestricted: async (id: string) => {
    const res = await api.get<ApiResponse<Record<string, unknown>>>(`/projects/${id}/restricted`)
    return unwrap(res)
  },
  create: async (data: Partial<Project>) => {
    const res = await api.post<ApiResponse<Project>>('/projects', data)
    return unwrap(res)
  },
  update: async (id: string, data: Partial<Project> & { revision_reason: string; client_request?: string }) => {
    const res = await api.put<ApiResponse<Project>>(`/projects/${id}`, data)
    return unwrap(res)
  },
  updateStatus: async (id: string, status: ProjectStatus) => {
    const res = await api.patch<ApiResponse<{ status: string }>>(`/projects/${id}/status`, { status })
    return unwrap(res)
  },
  uploadDrawing: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post<ApiResponse<FileAsset>>(`/projects/${id}/drawing`, form)
    return unwrap(res)
  },
  getRevisions: async (id: string) => {
    const res = await api.get<ApiResponse<ProjectRevision[]>>(`/projects/${id}/revisions`)
    return unwrap(res) || []
  },
  getTimeline: async (id: string, params?: { page?: number; page_size?: number }) => {
    const res = await api.get<ApiResponse<PaginatedResponse<AuditLog>>>(`/projects/${id}/timeline`, { params })
    return unwrap(res)
  },
}

// ============================================================
// ROUTING
// ============================================================

export const routingApi = {
  listForProject: async (projectId: string) => {
    const res = await api.get<ApiResponse<Routing[]>>(`/projects/${projectId}/routings`)
    return unwrap(res) || []
  },
  get: async (id: string) => {
    const res = await api.get<ApiResponse<Routing>>(`/routings/${id}`)
    return unwrap(res)
  },
  create: async (projectId: string, data: {
    name?: string; description?: string;
    steps: Array<{ step_order: number; name?: string; dependency_policy: DependencyPolicy; department_ids: string[] }>
  }) => {
    const res = await api.post<ApiResponse<Routing>>(`/projects/${projectId}/routings`, data)
    return unwrap(res)
  },
  update: async (routingId: string, data: {
    name?: string; description?: string; edit_reason: string;
    steps: Array<{ step_order: number; name?: string; dependency_policy: DependencyPolicy; department_ids: string[] }>
  }) => {
    const res = await api.put<ApiResponse<Routing>>(`/routings/${routingId}`, data)
    return unwrap(res)
  },
  createNewVersion: async (routingId: string, data: {
    name?: string; description?: string; change_reason: string;
    steps: Array<{ step_order: number; name?: string; dependency_policy: DependencyPolicy; department_ids: string[] }>
  }) => {
    const res = await api.post<ApiResponse<Routing>>(`/routings/${routingId}/new-version`, data)
    return unwrap(res)
  },
  publish: async (id: string) => {
    const res = await api.post<ApiResponse<Routing>>(`/routings/${id}/publish`)
    return unwrap(res)
  },
  getEditTimeline: async (id: string) => {
    const res = await api.get<ApiResponse<RoutingEditTimeline[]>>(`/routings/${id}/timeline`)
    return unwrap(res) || []
  },
  getTemplates: async () => {
    const res = await api.get<ApiResponse<unknown[]>>('/routing-templates')
    return unwrap(res) || []
  },
  getUpcomingTasks: async (departmentId: string) => {
    const res = await api.get<ApiResponse<UpcomingTask[]>>(`/departments/${departmentId}/upcoming-tasks`)
    return unwrap(res) || []
  },
}

// ============================================================
// TASKS
// ============================================================

export const taskApi = {
  getProjectTasks: async (projectId: string, departmentId?: string) => {
    const res = await api.get<ApiResponse<DepartmentTask[]>>(`/projects/${projectId}/tasks`, {
      params: { department_id: departmentId },
    })
    return unwrap(res) || []
  },
  getTask: async (id: string) => {
    const res = await api.get<ApiResponse<DepartmentTask>>(`/tasks/${id}`)
    return unwrap(res)
  },
  getMyTasks: async (params?: { page?: number; page_size?: number; status?: TaskStatus }) => {
    const res = await api.get<ApiResponse<PaginatedResponse<DepartmentTask>>>('/my-tasks', { params })
    return unwrap(res)
  },
  updateStatus: async (id: string, status: TaskStatus) => {
    const res = await api.patch<ApiResponse<{ status: string }>>(`/tasks/${id}/status`, { status })
    return unwrap(res)
  },
  setDates: async (id: string, start_date?: string, due_date?: string) => {
    const res = await api.patch<ApiResponse<DepartmentTask>>(`/tasks/${id}/dates`, { start_date, due_date })
    return unwrap(res)
  },
  setExpectedCompletion: async (id: string, expected_completion_date: string) => {
    const res = await api.patch<ApiResponse<DepartmentTask>>(`/tasks/${id}/expected-completion`, { expected_completion_date })
    return unwrap(res)
  },
  assignEmployees: async (id: string, employee_ids: string[]) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/tasks/${id}/assign-employees`, { employee_ids })
    return unwrap(res)
  },
  createSubtask: async (taskId: string, data: {
    title: string; description?: string; is_required?: boolean;
    assigned_to?: string; sort_order?: number
  }) => {
    const res = await api.post<ApiResponse<Subtask>>(`/tasks/${taskId}/subtasks`, data)
    return unwrap(res)
  },
  completeSubtask: async (id: string, notes?: string) => {
    const res = await api.patch<ApiResponse<{ message: string }>>(`/subtasks/${id}/complete`, { notes })
    return unwrap(res)
  },
  updateSubtask: async (id: string, data: { title?: string; description?: string; notes?: string; assigned_to?: string }) => {
    const res = await api.put<ApiResponse<{ message: string }>>(`/subtasks/${id}`, data)
    return unwrap(res)
  },
  uploadSubtaskProof: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post<ApiResponse<FileAsset>>(`/subtasks/${id}/proof`, form)
    return unwrap(res)
  },
}

// ============================================================
// ISSUES
// ============================================================

export const issueApi = {
  list: async (params?: { page?: number; page_size?: number; project_id?: string; status?: string }) => {
    const res = await api.get<ApiResponse<PaginatedResponse<Issue>>>('/issues', { params })
    return unwrap(res)
  },
  get: async (id: string) => {
    const res = await api.get<ApiResponse<Issue>>(`/issues/${id}`)
    return unwrap(res)
  },
  raise: async (projectId: string, data: {
    task_id?: string; type: IssueType; title: string;
    description: string; assigned_to_dept_id?: string
    material_name?: string; material_description?: string;
    required_quantity?: number; material_unit?: string; material_remarks?: string
  }) => {
    const res = await api.post<ApiResponse<Issue>>(`/projects/${projectId}/issues`, data)
    return unwrap(res)
  },
  review: async (id: string, approve: boolean, notes?: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/issues/${id}/review`, { approve, notes })
    return unwrap(res)
  },
  resolve: async (id: string, resolution_notes?: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/issues/${id}/resolve`, { resolution_notes })
    return unwrap(res)
  },
  uploadFile: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post<ApiResponse<FileAsset>>(`/issues/${id}/files`, form)
    return unwrap(res)
  },
}

// ============================================================
// REWORKS
// ============================================================

export const reworkApi = {
  list: async (params?: { page?: number; page_size?: number; project_id?: string; status?: string }) => {
    const res = await api.get<ApiResponse<PaginatedResponse<ReworkRequest>>>('/reworks', { params })
    return unwrap(res)
  },
  get: async (id: string) => {
    const res = await api.get<ApiResponse<ReworkRequest>>(`/reworks/${id}`)
    return unwrap(res)
  },
  request: async (projectId: string, data: {
    requesting_task_id: string; target_department_id: string;
    reason: string; description?: string
  }) => {
    const res = await api.post<ApiResponse<ReworkRequest>>(`/projects/${projectId}/reworks`, data)
    return unwrap(res)
  },
  approve: async (id: string, data: { notes?: string; new_routing_steps?: unknown[] }) => {
    const res = await api.post<ApiResponse<ReworkRequest>>(`/reworks/${id}/approve`, data)
    return unwrap(res)
  },
  reject: async (id: string, notes?: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/reworks/${id}/reject`, { notes })
    return unwrap(res)
  },
}

// ============================================================
// QUERIES
// ============================================================

export const queryApi = {
  list: async (params?: { page?: number; page_size?: number; project_id?: string; status?: string }) => {
    const res = await api.get<ApiResponse<PaginatedResponse<Query>>>('/queries', { params })
    return unwrap(res)
  },
  get: async (id: string) => {
    const res = await api.get<ApiResponse<Query>>(`/queries/${id}`)
    return unwrap(res)
  },
  create: async (data: { project_id: string; recipient_ids: string[]; subject: string; message?: string }) => {
    const res = await api.post<ApiResponse<Query[]>>('/queries', data)
    return unwrap(res)
  },
  sendMessage: async (id: string, message: string) => {
    const res = await api.post<ApiResponse<QueryMessage>>(`/queries/${id}/messages`, { message })
    return unwrap(res)
  },
  uploadFile: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post<ApiResponse<FileAsset>>(`/queries/${id}/files`, form)
    return unwrap(res)
  },
  markResolved: async (id: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/queries/${id}/resolve`)
    return unwrap(res)
  },
}

// ============================================================
// DAILY REPORTS
// ============================================================

export const reportApi = {
  list: async (params?: { page?: number; page_size?: number; project_id?: string; department_id?: string; date_from?: string; date_to?: string }) => {
    const res = await api.get<ApiResponse<PaginatedResponse<DailyReport>>>('/reports', { params })
    return unwrap(res)
  },
  get: async (id: string) => {
    const res = await api.get<ApiResponse<DailyReport>>(`/reports/${id}`)
    return unwrap(res)
  },
  create: async (data: { project_id: string; task_id?: string; description: string; report_date?: string }) => {
    const res = await api.post<ApiResponse<DailyReport>>('/reports', data)
    return unwrap(res)
  },
  uploadFile: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post<ApiResponse<FileAsset>>(`/reports/${id}/files`, form)
    return unwrap(res)
  },
}

// ============================================================
// MATERIALS
// ============================================================

export const materialApi = {
  list: async (params?: { page?: number; page_size?: number; project_id?: string; status?: string }) => {
    const res = await api.get<ApiResponse<PaginatedResponse<MaterialRequisition>>>('/materials', { params })
    return unwrap(res)
  },
  get: async (id: string) => {
    const res = await api.get<ApiResponse<MaterialRequisition>>(`/materials/${id}`)
    return unwrap(res)
  },
  create: async (data: {
    project_id: string; task_id?: string; title: string; description?: string;
    items: Omit<MaterialItem, 'id' | 'requisition_id' | 'created_at'>[]
  }) => {
    const res = await api.post<ApiResponse<MaterialRequisition>>('/materials', data)
    return unwrap(res)
  },
  review: async (id: string, approve: boolean, notes?: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/materials/${id}/review`, { approve, notes })
    return unwrap(res)
  },
}

// ============================================================
// NOTIFICATIONS
// ============================================================

export const notifApi = {
  list: async (params?: { page?: number; page_size?: number; unread?: boolean }) => {
    const res = await api.get<ApiResponse<PaginatedResponse<Notification>>>('/notifications', { params })
    return unwrap(res)
  },
  getCount: async () => {
    const res = await api.get<ApiResponse<{ count: number }>>('/notifications/count')
    return unwrap(res)
  },
  markRead: async (id: string) => {
    await api.patch(`/notifications/${id}/read`)
  },
  markAllRead: async () => {
    await api.post('/notifications/read-all')
  },
}

// ============================================================
// SEARCH & DASHBOARD
// ============================================================

export const searchApi = {
  search: async (params: { search?: string; types?: string; project_id?: string; status?: string; page?: number }) => {
    const res = await api.get<ApiResponse<PaginatedResponse<SearchResult>>>('/search', { params })
    return unwrap(res)
  },
  getDashboardStats: async () => {
    const res = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats')
    return unwrap(res)
  },
}

// ============================================================
// AI ASSISTANT
// ============================================================

export const aiApi = {
  chat: async (message: string, signal?: AbortSignal) => {
    const res = await api.post<{ success: boolean; response: string; error?: string }>('/ai/chat', { message }, { signal })
    if (!res.data.success) {
      throw new Error(res.data.error || 'Failed to get response from AI assistant')
    }
    return { response: res.data.response }
  },
}

export default api
