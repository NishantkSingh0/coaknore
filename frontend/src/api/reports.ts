import api from './client'
import type { DailyReport } from '../types'

const wrap = <T>(res: { data: { data: T } }) => res.data.data

export const getReports = () =>
  api.get<{ success: boolean; data: DailyReport[] }>('/reports').then(wrap)

export const getReport = (id: string) =>
  api.get<{ success: boolean; data: DailyReport | null }>(`/reports/${id}`).then(wrap)

export const createReport = (payload: {
  project_id: string
  description: string
  image_url?: string
}) =>
  api.post<{ success: boolean; data: DailyReport }>('/reports', payload).then(wrap)
