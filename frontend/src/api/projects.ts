import api from './client'
import type { Project, RoutingEntry } from '../types'

export interface ProjectListParams {
  status?: string
  search?: string
  date_from?: string
  date_to?: string
  page?: number
  limit?: number
}

export interface ProjectListResponse {
  projects: Project[]
  total: number
  page: number
  limit: number
}

const wrap = <T>(res: { data: { data: T } }) => res.data.data

export const getProjects = (params?: ProjectListParams) =>
  api
    .get<{ success: boolean; data: ProjectListResponse }>('/projects', { params })
    .then(wrap)

export const getProject = (id: string) =>
  api
    .get<{ success: boolean; data: Project }>(`/projects/${id}`)
    .then(wrap)

export const createProject = (payload: Partial<Project>) =>
  api
    .post<{ success: boolean; data: Project }>('/projects', payload)
    .then(wrap)

export const updateProject = (id: string, payload: Partial<Project>) =>
  api
    .put<{ success: boolean; data: Project }>(`/projects/${id}`, payload)
    .then(wrap)

export const deleteProject = (id: string) =>
  api
    .delete<{ success: boolean; data: null }>(`/projects/${id}`)
    .then(wrap)

export const getRouting = (id: string) =>
  api
    .get<{ success: boolean; data: RoutingEntry[] }>(`/projects/${id}/routing`)
    .then(wrap)

export const setRouting = (
  id: string,
  routing: { department_id: string; sequence_order: number }[]
) =>
  api
    .post<{ success: boolean; data: RoutingEntry[] }>(
      `/projects/${id}/routing`,
      { routing }
    ).then(wrap)