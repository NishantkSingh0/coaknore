import api from './client'
import type { Department } from '../types'

const wrap = <T>(res: { data: { data: T } }) => res.data.data

export const getDepartments = () =>
  api.get<{ success: boolean; data: Department[] }>('/departments').then(wrap)

export const createDepartment = (payload: {
  name: string
  layer: number
  description?: string
}) =>
  api
    .post<{ success: boolean; data: Department }>('/departments', payload)
    .then(wrap)

export const updateDepartment = (
  id: string,
  payload: Partial<Department>
) =>
  api
    .put<{ success: boolean; data: Department }>(`/departments/${id}`, payload)
    .then(wrap)

export const deleteDepartment = (id: string) =>
  api.delete(`/departments/${id}`).then(r => r.data)
