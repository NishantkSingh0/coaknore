import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  authApi, orgApi, projectApi, routingApi, taskApi, 
  issueApi, reworkApi, materialApi, queryApi, reportApi,
  notificationApi, searchApi, aiApi 
} from '../services/api'
import type { 
  ProjectStatus, TaskStatus, IssueType, 
  DepartmentLayer, LayerType, MaterialItem 
} from '../types'

// ============================================================
// AUTH HOOKS
// ============================================================
export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    staleTime: 5 * 60 * 1000, // 5 minutes - user data doesn't change often
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => 
      authApi.login(email, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { 
      currentPassword: string; 
      newPassword: string 
    }) => authApi.changePassword(currentPassword, newPassword),
  })
}

// ============================================================
// ORGANIZATION HOOKS
// ============================================================
export function useOrganization() {
  return useQuery({
    queryKey: ['organization'],
    queryFn: orgApi.getOrganization,
    staleTime: 10 * 60 * 1000, // 10 minutes - org data rarely changes
  })
}

export function useDepartments(layer?: DepartmentLayer) {
  return useQuery({
    queryKey: ['departments', layer],
    queryFn: () => orgApi.listDepartments(layer),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useDepartment(id: string) {
  return useQuery({
    queryKey: ['departments', id],
    queryFn: () => orgApi.getDepartment(id),
    enabled: !!id,
  })
}

export function useCreateDepartment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: { name: string; description?: string; layer: DepartmentLayer }) => 
      orgApi.createDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
    },
  })
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      orgApi.updateDepartment(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      queryClient.invalidateQueries({ queryKey: ['departments', variables.id] })
    },
  })
}

export function useEmployees(params?: {
  page?: number; page_size?: number; search?: string;
  layer?: LayerType; department_id?: string; active?: boolean
}) {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => orgApi.listEmployees(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employees', id],
    queryFn: () => orgApi.getEmployee(id),
    enabled: !!id,
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: orgApi.createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      orgApi.updateEmployee(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employees', variables.id] })
    },
  })
}

// ============================================================
// PROJECT HOOKS
// ============================================================
export function useProjects(params?: { page?: number; page_size?: number; status?: ProjectStatus }) {
  return useQuery({
    queryKey: ['projects', params],
    queryFn: () => projectApi.list(params),
    staleTime: 1 * 60 * 1000, // 1 minute - projects change frequently
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => projectApi.get(id),
    enabled: !!id,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: projectApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      projectApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects', variables.id] })
    },
  })
}

export function useUpdateProjectStatus() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProjectStatus }) => 
      projectApi.updateStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects', variables.id] })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: projectApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

// ============================================================
// ROUTING HOOKS
// ============================================================
export function useRoutings(projectId: string) {
  return useQuery({
    queryKey: ['routings', projectId],
    queryFn: () => routingApi.list(projectId),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useRouting(id: string) {
  return useQuery({
    queryKey: ['routings', id],
    queryFn: () => routingApi.get(id),
    enabled: !!id,
  })
}

export function useCreateRouting() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: any }) => 
      routingApi.create(projectId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['routings', variables.projectId] })
    },
  })
}

export function useUpdateRouting() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      routingApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['routings', variables.id] })
    },
  })
}

// ============================================================
// TASK HOOKS
// ============================================================
export function useTasks(projectId: string) {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => taskApi.list(projectId),
    enabled: !!projectId,
    staleTime: 30 * 1000, // 30 seconds - tasks change very frequently
  })
}

export function useMyTasks(params?: { page?: number; page_size?: number; status?: TaskStatus }) {
  return useQuery({
    queryKey: ['tasks', 'my', params],
    queryFn: () => taskApi.getMyTasks(params),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // Refetch every minute
  })
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => 
      taskApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

// ============================================================
// ISSUE HOOKS
// ============================================================
export function useIssues() {
  return useQuery({
    queryKey: ['issues'],
    queryFn: issueApi.list,
    staleTime: 1 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  })
}

export function useCreateIssue() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: any }) => 
      issueApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] })
    },
  })
}

// ============================================================
// NOTIFICATION HOOKS
// ============================================================
export function useNotifications(params?: { page?: number; page_size?: number; unread?: boolean }) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notificationApi.list(params),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // Refetch every minute
  })
}

export function useNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: notificationApi.getCount,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    select: (data) => data,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: notificationApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notifications', 'count'] })
    },
  })
}

// ============================================================
// SEARCH HOOKS
// ============================================================
export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => searchApi.search(query),
    enabled: query.length > 2,
    staleTime: 5 * 60 * 1000,
  })
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: searchApi.getDashboardStats,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })
}
