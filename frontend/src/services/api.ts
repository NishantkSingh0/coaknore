import axios, { AxiosError } from 'axios'
import type {
  Employee, Department, Project, ProjectRevision, Routing, RoutingEditTimeline, DepartmentTask,
  Subtask, Issue, ReworkRequest, Query, QueryMessage, DailyReport,
  MaterialRequisition, Notification, AuditLog, FileAsset, Organization,
  DashboardStats, SearchResult, PaginatedResponse, ApiResponse,
  ProjectStatus, TaskStatus, IssueType, DependencyPolicy, DepartmentLayer,
  LayerType, MaterialItem, UpcomingTask
} from '../types'
import { cacheService } from './cache'

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
    const cacheKey = '/organization'
    const cached = cacheService.get<Organization>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<Organization>>('/organization')
    const data = unwrap(res)
    cacheService.set(cacheKey, data)
    return data
  },

  // Departments
  listDepartments: async (layer?: DepartmentLayer) => {
    const cacheKey = '/departments'
    const params = { layer }
    const cached = cacheService.get<Department[]>(cacheKey, params)
    if (cached) return cached

    const res = await api.get<ApiResponse<Department[]>>('/departments', { params })
    const data = unwrap(res) || []
    cacheService.set(cacheKey, data, params)
    return data
  },
  getDepartment: async (id: string) => {
    const cacheKey = `/departments/${id}`
    const cached = cacheService.get<Department>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<Department>>(`/departments/${id}`)
    const data = unwrap(res)
    cacheService.set(cacheKey, data)
    return data
  },
  createDepartment: async (data: { name: string; description?: string; layer: DepartmentLayer }) => {
    const res = await api.post<ApiResponse<Department>>('/departments', data)
    const result = unwrap(res)
    cacheService.invalidate('/departments') // Invalidate departments cache
    return result
  },
  updateDepartment: async (id: string, data: { name: string; description?: string }) => {
    const res = await api.put<ApiResponse<Department>>(`/departments/${id}`, data)
    const result = unwrap(res)
    cacheService.invalidate('/departments') // Invalidate departments cache
    return result
  },
  toggleDepartment: async (id: string, active: boolean) => {
    const res = await api.patch<ApiResponse<{ active: boolean }>>(`/departments/${id}/toggle`, { active })
    const result = unwrap(res)
    cacheService.invalidate('/departments') // Invalidate departments cache
    return result
  },

  // Employees
  listEmployees: async (params?: {
    page?: number; page_size?: number; search?: string;
    layer?: LayerType; department_id?: string; active?: boolean
  }) => {
    const cacheKey = '/employees'
    const cached = cacheService.get<PaginatedResponse<Employee>>(cacheKey, params)
    if (cached) return cached

    const res = await api.get<ApiResponse<PaginatedResponse<Employee>>>('/employees', { params })
    const data = unwrap(res)
    cacheService.set(cacheKey, data, params)
    return data
  },
  getEmployee: async (id: string) => {
    const cacheKey = `/employees/${id}`
    const cached = cacheService.get<Employee>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<Employee>>(`/employees/${id}`)
    const data = unwrap(res)
    cacheService.set(cacheKey, data)
    return data
  },
  createEmployee: async (data: {
    department_id?: string; email: string; password: string;
    first_name: string; last_name: string; phone?: string; layer: LayerType
  }) => {
    const res = await api.post<ApiResponse<Employee>>('/employees', data)
    const result = unwrap(res)
    cacheService.invalidate('/employees') // Invalidate employees cache
    return result
  },
  updateEmployee: async (id: string, data: {
    department_id?: string; first_name: string; last_name: string;
    phone?: string; layer?: string
  }) => {
    const res = await api.put<ApiResponse<Employee>>(`/employees/${id}`, data)
    const result = unwrap(res)
    cacheService.invalidate('/employees') // Invalidate employees cache
    return result
  },
  toggleEmployee: async (id: string, active: boolean) => {
    const res = await api.patch<ApiResponse<{ active: boolean }>>(`/employees/${id}/toggle`, { active })
    const result = unwrap(res)
    cacheService.invalidate('/employees') // Invalidate employees cache
    return result
  },
  transferEmployee: async (id: string, department_id: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/employees/${id}/transfer`, { department_id })
    const result = unwrap(res)
    cacheService.invalidate('/employees') // Invalidate employees cache
    return result
  },
  resetEmployeePassword: async (id: string, new_password: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/employees/${id}/reset-password`, { new_password })
    return unwrap(res)
  },
  searchEmployees: async (q: string) => {
    const cacheKey = '/employees/search'
    const params = { q }
    const cached = cacheService.get<Employee[]>(cacheKey, params)
    if (cached) return cached

    const res = await api.get<ApiResponse<Employee[]>>('/employees/search', { params })
    const data = unwrap(res) || []
    cacheService.set(cacheKey, data, params)
    return data
  },
  deleteEmployee: async (id: string) => {
    const res = await api.delete<ApiResponse<{ message: string }>>(`/employees/${id}`)
    const result = unwrap(res)
    cacheService.invalidate('/employees') // Invalidate employees cache
    return result
  },
}

// ============================================================
// PROJECTS
// ============================================================

export const projectApi = {
  list: async (params?: { page?: number; page_size?: number; search?: string; status?: ProjectStatus }) => {
    const cacheKey = '/projects'
    const cached = cacheService.get<PaginatedResponse<Project>>(cacheKey, params)
    if (cached) return cached

    const res = await api.get<ApiResponse<PaginatedResponse<Project>>>('/projects', { params })
    const data = unwrap(res)
    cacheService.set(cacheKey, data, params)
    return data
  },
  get: async (id: string) => {
    const cacheKey = `/projects/${id}`
    const cached = cacheService.get<Project>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<Project>>(`/projects/${id}`)
    const data = unwrap(res)
    cacheService.set(cacheKey, data)
    return data
  },
  getRestricted: async (id: string) => {
    const res = await api.get<ApiResponse<Record<string, unknown>>>(`/projects/${id}/restricted`)
    return unwrap(res)
  },
  create: async (data: Partial<Project>) => {
    const res = await api.post<ApiResponse<Project>>('/projects', data)
    const result = unwrap(res)
    cacheService.invalidate('/projects') // Invalidate projects cache
    return result
  },
  update: async (id: string, data: Partial<Project> & { revision_reason: string; client_request?: string }) => {
    const res = await api.put<ApiResponse<Project>>(`/projects/${id}`, data)
    const result = unwrap(res)
    cacheService.invalidate('/projects') // Invalidate projects cache
    cacheService.invalidate(`/projects/${id}`) // Invalidate specific project cache
    return result
  },
  updateStatus: async (id: string, status: ProjectStatus) => {
    const res = await api.patch<ApiResponse<{ status: string }>>(`/projects/${id}/status`, { status })
    const result = unwrap(res)
    cacheService.invalidate('/projects') // Invalidate projects cache
    cacheService.invalidate(`/projects/${id}`) // Invalidate specific project cache
    return result
  },
  uploadDrawing: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post<ApiResponse<FileAsset>>(`/projects/${id}/drawing`, form)
    const result = unwrap(res)
    cacheService.invalidate(`/projects/${id}`) // Invalidate specific project cache
    return result
  },
  getRevisions: async (id: string) => {
    const cacheKey = `/projects/${id}/revisions`
    const cached = cacheService.get<ProjectRevision[]>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<ProjectRevision[]>>(`/projects/${id}/revisions`)
    const data = unwrap(res) || []
    cacheService.set(cacheKey, data)
    return data
  },
  getTimeline: async (id: string, params?: { page?: number; page_size?: number }) => {
    const cacheKey = `/projects/${id}/timeline`
    const cached = cacheService.get<PaginatedResponse<AuditLog>>(cacheKey, params)
    if (cached) return cached

    const res = await api.get<ApiResponse<PaginatedResponse<AuditLog>>>(`/projects/${id}/timeline`, { params })
    const data = unwrap(res)
    cacheService.set(cacheKey, data, params)
    return data
  },
  delete: async (id: string) => {
    const res = await api.delete<ApiResponse<{ message: string }>>(`/projects/${id}`)
    const result = unwrap(res)
    cacheService.invalidate('/projects') // Invalidate projects cache
    return result
  },
}

// ============================================================
// ROUTING
// ============================================================

export const routingApi = {
  listForProject: async (projectId: string) => {
    const cacheKey = `/projects/${projectId}/routings`
    const cached = cacheService.get<Routing[]>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<Routing[]>>(`/projects/${projectId}/routings`)
    const data = unwrap(res) || []
    cacheService.set(cacheKey, data)
    return data
  },
  get: async (id: string) => {
    const cacheKey = `/routings/${id}`
    const cached = cacheService.get<Routing>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<Routing>>(`/routings/${id}`)
    const data = unwrap(res)
    cacheService.set(cacheKey, data)
    return data
  },
  create: async (projectId: string, data: {
    name?: string; description?: string;
    steps: Array<{ step_order: number; name?: string; dependency_policy: DependencyPolicy; department_ids: string[] }>
  }) => {
    const res = await api.post<ApiResponse<Routing>>(`/projects/${projectId}/routings`, data)
    const result = unwrap(res)
    cacheService.invalidate(`/projects/${projectId}/routings`) // Invalidate project routings cache
    return result
  },
  update: async (routingId: string, data: {
    name?: string; description?: string; edit_reason: string;
    steps: Array<{ step_order: number; name?: string; dependency_policy: DependencyPolicy; department_ids: string[] }>
  }) => {
    const res = await api.put<ApiResponse<Routing>>(`/routings/${routingId}`, data)
    const result = unwrap(res)
    cacheService.invalidate(`/routings/${routingId}`) // Invalidate specific routing cache
    cacheService.invalidatePattern('/projects/') // Invalidate project routings cache
    return result
  },
  createNewVersion: async (routingId: string, data: {
    name?: string; description?: string; change_reason: string;
    steps: Array<{ step_order: number; name?: string; dependency_policy: DependencyPolicy; department_ids: string[] }>
  }) => {
    const res = await api.post<ApiResponse<Routing>>(`/routings/${routingId}/new-version`, data)
    const result = unwrap(res)
    cacheService.invalidate(`/routings/${routingId}`) // Invalidate specific routing cache
    cacheService.invalidatePattern('/projects/') // Invalidate project routings cache
    return result
  },
  publish: async (id: string) => {
    const res = await api.post<ApiResponse<Routing>>(`/routings/${id}/publish`)
    const result = unwrap(res)
    cacheService.invalidate(`/routings/${id}`) // Invalidate specific routing cache
    cacheService.invalidatePattern('/projects/') // Invalidate project routings cache
    return result
  },
  getEditTimeline: async (id: string) => {
    const cacheKey = `/routings/${id}/timeline`
    const cached = cacheService.get<RoutingEditTimeline[]>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<RoutingEditTimeline[]>>(`/routings/${id}/timeline`)
    const data = unwrap(res) || []
    cacheService.set(cacheKey, data)
    return data
  },
  getTemplates: async () => {
    const cacheKey = '/routing-templates'
    const cached = cacheService.get<unknown[]>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<unknown[]>>('/routing-templates')
    const data = unwrap(res) || []
    cacheService.set(cacheKey, data)
    return data
  },
  getUpcomingTasks: async (departmentId: string) => {
    const cacheKey = `/departments/${departmentId}/upcoming-tasks`
    const cached = cacheService.get<UpcomingTask[]>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<UpcomingTask[]>>(`/departments/${departmentId}/upcoming-tasks`)
    const data = unwrap(res) || []
    cacheService.set(cacheKey, data)
    return data
  },
}

// ============================================================
// TASKS
// ============================================================

export const taskApi = {
  getProjectTasks: async (projectId: string, departmentId?: string) => {
    const cacheKey = `/projects/${projectId}/tasks`
    const params = { department_id: departmentId }
    const cached = cacheService.get<DepartmentTask[]>(cacheKey, params)
    if (cached) return cached

    const res = await api.get<ApiResponse<DepartmentTask[]>>(`/projects/${projectId}/tasks`, { params })
    const data = unwrap(res) || []
    cacheService.set(cacheKey, data, params)
    return data
  },
  getTask: async (id: string) => {
    const cacheKey = `/tasks/${id}`
    const cached = cacheService.get<DepartmentTask>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<DepartmentTask>>(`/tasks/${id}`)
    const data = unwrap(res)
    cacheService.set(cacheKey, data)
    return data
  },
  getMyTasks: async (params?: { page?: number; page_size?: number; status?: TaskStatus }) => {
    const cacheKey = '/my-tasks'
    const cached = cacheService.get<PaginatedResponse<DepartmentTask>>(cacheKey, params)
    if (cached) return cached

    const res = await api.get<ApiResponse<PaginatedResponse<DepartmentTask>>>('/my-tasks', { params })
    const data = unwrap(res)
    cacheService.set(cacheKey, data, params)
    return data
  },
  updateStatus: async (id: string, status: TaskStatus) => {
    const res = await api.patch<ApiResponse<{ status: string }>>(`/tasks/${id}/status`, { status })
    const result = unwrap(res)
    cacheService.invalidate('/my-tasks') // Invalidate my tasks cache
    cacheService.invalidate(`/tasks/${id}`) // Invalidate specific task cache
    cacheService.invalidatePattern('/projects/') // Invalidate project tasks cache
    cacheService.invalidate('/dashboard/stats') // Invalidate dashboard stats
    return result
  },
  setDates: async (id: string, start_date?: string, due_date?: string) => {
    const res = await api.patch<ApiResponse<DepartmentTask>>(`/tasks/${id}/dates`, { start_date, due_date })
    const result = unwrap(res)
    cacheService.invalidate(`/tasks/${id}`) // Invalidate specific task cache
    cacheService.invalidatePattern('/projects/') // Invalidate project tasks cache
    return result
  },
  setExpectedCompletion: async (id: string, expected_completion_date: string) => {
    const res = await api.patch<ApiResponse<DepartmentTask>>(`/tasks/${id}/expected-completion`, { expected_completion_date })
    const result = unwrap(res)
    cacheService.invalidate(`/tasks/${id}`) // Invalidate specific task cache
    cacheService.invalidatePattern('/projects/') // Invalidate project tasks cache
    return result
  },
  assignEmployees: async (id: string, employee_ids: string[]) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/tasks/${id}/assign-employees`, { employee_ids })
    const result = unwrap(res)
    cacheService.invalidate(`/tasks/${id}`) // Invalidate specific task cache
    return result
  },
  createSubtask: async (taskId: string, data: {
    title: string; description?: string; is_required?: boolean;
    assigned_to?: string; sort_order?: number
  }) => {
    const res = await api.post<ApiResponse<Subtask>>(`/tasks/${taskId}/subtasks`, data)
    const result = unwrap(res)
    cacheService.invalidate(`/tasks/${taskId}`) // Invalidate parent task cache
    return result
  },
  completeSubtask: async (id: string, notes?: string) => {
    const res = await api.patch<ApiResponse<{ message: string }>>(`/subtasks/${id}/complete`, { notes })
    const result = unwrap(res)
    cacheService.invalidatePattern('/tasks/') // Invalidate tasks cache
    cacheService.invalidate('/dashboard/stats') // Invalidate dashboard stats
    return result
  },
  updateSubtask: async (id: string, data: { title?: string; description?: string; notes?: string; assigned_to?: string }) => {
    const res = await api.put<ApiResponse<{ message: string }>>(`/subtasks/${id}`, data)
    const result = unwrap(res)
    cacheService.invalidatePattern('/tasks/') // Invalidate tasks cache
    return result
  },
  uploadSubtaskProof: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post<ApiResponse<FileAsset>>(`/subtasks/${id}/proof`, form)
    return unwrap(res)
  },
  uploadDepartmentFile: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post<ApiResponse<FileAsset>>(`/tasks/${id}/department-file`, form)
    return unwrap(res)
  },
}

// ============================================================
// ISSUES
// ============================================================

export const issueApi = {
  list: async (params?: { page?: number; page_size?: number; project_id?: string; status?: string }) => {
    const cacheKey = '/issues'
    const cached = cacheService.get<PaginatedResponse<Issue>>(cacheKey, params)
    if (cached) return cached

    const res = await api.get<ApiResponse<PaginatedResponse<Issue>>>('/issues', { params })
    const data = unwrap(res)
    cacheService.set(cacheKey, data, params)
    return data
  },
  get: async (id: string) => {
    const cacheKey = `/issues/${id}`
    const cached = cacheService.get<Issue>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<Issue>>(`/issues/${id}`)
    const data = unwrap(res)
    cacheService.set(cacheKey, data)
    return data
  },
  raise: async (projectId: string, data: {
    task_id?: string; type: IssueType; title: string;
    description: string; assigned_to_dept_id?: string
    material_name?: string; material_description?: string;
    required_quantity?: number; material_unit?: string; material_remarks?: string
  }) => {
    const res = await api.post<ApiResponse<Issue>>(`/projects/${projectId}/issues`, data)
    const result = unwrap(res)
    cacheService.invalidate('/issues') // Invalidate issues cache
    cacheService.invalidate('/dashboard/stats') // Invalidate dashboard stats
    return result
  },
  review: async (id: string, approve: boolean, notes?: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/issues/${id}/review`, { approve, notes })
    const result = unwrap(res)
    cacheService.invalidate('/issues') // Invalidate issues cache
    cacheService.invalidate(`/issues/${id}`) // Invalidate specific issue cache
    cacheService.invalidate('/dashboard/stats') // Invalidate dashboard stats
    return result
  },
  resolve: async (id: string, resolution_notes?: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/issues/${id}/resolve`, { resolution_notes })
    const result = unwrap(res)
    cacheService.invalidate('/issues') // Invalidate issues cache
    cacheService.invalidate(`/issues/${id}`) // Invalidate specific issue cache
    cacheService.invalidate('/dashboard/stats') // Invalidate dashboard stats
    return result
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
    const cacheKey = '/reworks'
    const cached = cacheService.get<PaginatedResponse<ReworkRequest>>(cacheKey, params)
    if (cached) return cached

    const res = await api.get<ApiResponse<PaginatedResponse<ReworkRequest>>>('/reworks', { params })
    const data = unwrap(res)
    cacheService.set(cacheKey, data, params)
    return data
  },
  get: async (id: string) => {
    const cacheKey = `/reworks/${id}`
    const cached = cacheService.get<ReworkRequest>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<ReworkRequest>>(`/reworks/${id}`)
    const data = unwrap(res)
    cacheService.set(cacheKey, data)
    return data
  },
  request: async (projectId: string, data: {
    requesting_task_id: string; target_department_id: string;
    reason: string; description?: string
  }) => {
    const res = await api.post<ApiResponse<ReworkRequest>>(`/projects/${projectId}/reworks`, data)
    const result = unwrap(res)
    cacheService.invalidate('/reworks') // Invalidate reworks cache
    cacheService.invalidate('/dashboard/stats') // Invalidate dashboard stats
    return result
  },
  approve: async (id: string, data: { notes?: string; new_routing_steps?: unknown[] }) => {
    const res = await api.post<ApiResponse<ReworkRequest>>(`/reworks/${id}/approve`, data)
    const result = unwrap(res)
    cacheService.invalidate('/reworks') // Invalidate reworks cache
    cacheService.invalidate(`/reworks/${id}`) // Invalidate specific rework cache
    cacheService.invalidate('/dashboard/stats') // Invalidate dashboard stats
    return result
  },
  reject: async (id: string, notes?: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/reworks/${id}/reject`, { notes })
    const result = unwrap(res)
    cacheService.invalidate('/reworks') // Invalidate reworks cache
    cacheService.invalidate(`/reworks/${id}`) // Invalidate specific rework cache
    cacheService.invalidate('/dashboard/stats') // Invalidate dashboard stats
    return result
  },
}

// ============================================================
// QUERIES
// ============================================================

export const queryApi = {
  list: async (params?: { page?: number; page_size?: number; project_id?: string; status?: string }) => {
    const cacheKey = '/queries'
    const cached = cacheService.get<PaginatedResponse<Query>>(cacheKey, params)
    if (cached) return cached

    const res = await api.get<ApiResponse<PaginatedResponse<Query>>>('/queries', { params })
    const data = unwrap(res)
    cacheService.set(cacheKey, data, params)
    return data
  },
  get: async (id: string) => {
    const cacheKey = `/queries/${id}`
    const cached = cacheService.get<Query>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<Query>>(`/queries/${id}`)
    const data = unwrap(res)
    cacheService.set(cacheKey, data)
    return data
  },
  create: async (data: { project_id: string; recipient_ids: string[]; subject: string; message?: string }) => {
    const res = await api.post<ApiResponse<Query[]>>('/queries', data)
    const result = unwrap(res)
    cacheService.invalidate('/queries') // Invalidate queries cache
    return result
  },
  sendMessage: async (id: string, message: string) => {
    const res = await api.post<ApiResponse<QueryMessage>>(`/queries/${id}/messages`, { message })
    const result = unwrap(res)
    cacheService.invalidate(`/queries/${id}`) // Invalidate specific query cache
    return result
  },
  uploadFile: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await api.post<ApiResponse<FileAsset>>(`/queries/${id}/files`, form)
    return unwrap(res)
  },
  markResolved: async (id: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/queries/${id}/resolve`)
    const result = unwrap(res)
    cacheService.invalidate('/queries') // Invalidate queries cache
    cacheService.invalidate(`/queries/${id}`) // Invalidate specific query cache
    return result
  },
}

// ============================================================
// DAILY REPORTS
// ============================================================

export const reportApi = {
  list: async (params?: { page?: number; page_size?: number; project_id?: string; department_id?: string; date_from?: string; date_to?: string }) => {
    const cacheKey = '/reports'
    const cached = cacheService.get<PaginatedResponse<DailyReport>>(cacheKey, params)
    if (cached) return cached

    const res = await api.get<ApiResponse<PaginatedResponse<DailyReport>>>('/reports', { params })
    const data = unwrap(res)
    cacheService.set(cacheKey, data, params)
    return data
  },
  get: async (id: string) => {
    const cacheKey = `/reports/${id}`
    const cached = cacheService.get<DailyReport>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<DailyReport>>(`/reports/${id}`)
    const data = unwrap(res)
    cacheService.set(cacheKey, data)
    return data
  },
  create: async (data: { project_id: string; task_id?: string; description: string; report_date?: string }) => {
    const res = await api.post<ApiResponse<DailyReport>>('/reports', data)
    const result = unwrap(res)
    cacheService.invalidate('/reports') // Invalidate reports cache
    return result
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
    const cacheKey = '/materials'
    const cached = cacheService.get<PaginatedResponse<MaterialRequisition>>(cacheKey, params)
    if (cached) return cached

    const res = await api.get<ApiResponse<PaginatedResponse<MaterialRequisition>>>('/materials', { params })
    const data = unwrap(res)
    cacheService.set(cacheKey, data, params)
    return data
  },
  get: async (id: string) => {
    const cacheKey = `/materials/${id}`
    const cached = cacheService.get<MaterialRequisition>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<MaterialRequisition>>(`/materials/${id}`)
    const data = unwrap(res)
    cacheService.set(cacheKey, data)
    return data
  },
  create: async (data: {
    project_id: string; task_id?: string; title: string; description?: string;
    items: Omit<MaterialItem, 'id' | 'requisition_id' | 'created_at'>[]
  }) => {
    const res = await api.post<ApiResponse<MaterialRequisition>>('/materials', data)
    const result = unwrap(res)
    cacheService.invalidate('/materials') // Invalidate materials cache
    cacheService.invalidate('/dashboard/stats') // Invalidate dashboard stats
    return result
  },
  review: async (id: string, approve: boolean, notes?: string) => {
    const res = await api.post<ApiResponse<{ message: string }>>(`/materials/${id}/review`, { approve, notes })
    const result = unwrap(res)
    cacheService.invalidate('/materials') // Invalidate materials cache
    cacheService.invalidate(`/materials/${id}`) // Invalidate specific material cache
    cacheService.invalidate('/dashboard/stats') // Invalidate dashboard stats
    return result
  },
}

// ============================================================
// NOTIFICATIONS
// ============================================================

export const notifApi = {
  list: async (params?: { page?: number; page_size?: number; unread?: boolean }) => {
    const cacheKey = '/notifications'
    const cached = cacheService.get<PaginatedResponse<Notification>>(cacheKey, params)
    if (cached) return cached

    const res = await api.get<ApiResponse<PaginatedResponse<Notification>>>('/notifications', { params })
    const data = unwrap(res)
    cacheService.set(cacheKey, data, params)
    return data
  },
  getCount: async () => {
    const cacheKey = '/notifications/count'
    const cached = cacheService.get<{ count: number }>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<{ count: number }>>('/notifications/count')
    const data = unwrap(res)
    cacheService.set(cacheKey, data)
    return data
  },
  markRead: async (id: string) => {
    await api.patch(`/notifications/${id}/read`)
    cacheService.invalidate('/notifications') // Invalidate notifications cache
    cacheService.invalidate('/notifications/count') // Invalidate count cache
  },
  markAllRead: async () => {
    await api.post('/notifications/read-all')
    cacheService.invalidate('/notifications') // Invalidate notifications cache
    cacheService.invalidate('/notifications/count') // Invalidate count cache
  },
  deleteRead: async () => {
    await api.delete('/notifications/read')
    cacheService.invalidate('/notifications') // Invalidate notifications cache
    cacheService.invalidate('/notifications/count') // Invalidate count cache
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
    const cacheKey = '/dashboard/stats'
    const cached = cacheService.get<DashboardStats>(cacheKey)
    if (cached) return cached

    const res = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats')
    const data = unwrap(res)
    cacheService.set(cacheKey, data)
    return data
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
