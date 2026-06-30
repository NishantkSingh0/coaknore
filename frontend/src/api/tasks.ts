import api from './client'
import type { Task } from '../types'

const wrap = <T>(res: { data: { data: T } }) => res.data.data

export const getTasks = () =>
  api.get<{ success: boolean; data: Task[] }>('/tasks').then(wrap)

export const getTask = (id: string) =>
  api.get<{ success: boolean; data: Task }>(`/tasks/${id}`).then(wrap)

export const updateTask = (
  id: string,
  payload: {
    start_date?: string
    due_date?: string
    status?: string
    assigned_to_user_id?: string
    addon?: string
  }
) =>
  api.put(`/tasks/${id}`, payload).then(r => r.data)
