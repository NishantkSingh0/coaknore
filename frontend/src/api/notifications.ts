import api from './client'
import type { Notification } from '../types'

const wrap = <T>(res: { data: { data: T } }) => res.data.data

export const getNotifications = () =>
  api
    .get<{ success: boolean; data: Notification[] }>('/notifications')
    .then(wrap)

export const markRead = (id: string) =>
  api.put(`/notifications/${id}/read`).then(res => res.data)

export const markAllRead = () =>
  api.put('/notifications/read-all').then(res => res.data)