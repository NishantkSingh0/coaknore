import api from './client'
import type { Issue } from '../types'

const wrap = <T>(res: { data: { data: T } }) => res.data.data

export const getIssues = () =>
  api.get<{ success: boolean; data: Issue[] }>('/issues').then(wrap)

export const getIssue = (id: string) =>
  api.get<{ success: boolean; data: Issue }>(`/issues/${id}`).then(wrap)

export const createIssue = (payload: {
  project_id: string
  task_id?: string
  issue_type: string
  description?: string
}) =>
  api
    .post<{ success: boolean; data: Issue }>('/issues', payload)
    .then(wrap)

export const approveIssue = (id: string) =>
  api.put(`/issues/${id}/approve`).then(r => r.data)

export const rejectIssue = (id: string) =>
  api.put(`/issues/${id}/reject`).then(r => r.data)

export const closeIssue = (id: string) =>
  api.put(`/issues/${id}/close`).then(r => r.data)

export interface MaterialItem {
  material_name: string
  material_description?: string
  quantity_required: number
  unit?: string
}

export const createMaterialRequisition = (
  issueId: string,
  payload: {
    department: string
    request_date: string
    items: MaterialItem[]
  }
) =>
  api
    .post(`/issues/${issueId}/material-requisition`, payload)
    .then(r => r.data)

export const getMaterialRequisition = (issueId: string) =>
  api
    .get(`/issues/${issueId}/material-requisition`)
    .then(r => r.data.data)

export const createReworkRequest = (issueId: string, description: string) =>
  api
    .put(`/issues/${issueId}/rework-request`, { description })
    .then(r => r.data)
