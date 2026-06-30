import api from './client'
import type { User } from '../types'

const wrap = <T>(res: { data: { data: T } }) => res.data.data

export const getUsers = () =>
  api.get<{ success: boolean; data: User[] }>('/users').then(wrap)

export const getUser = (id: string) =>
  api.get<{ success: boolean; data: User }>(`/users/${id}`).then(wrap)

export const createUser = (payload: {
  name: string
  email: string
  password: string
  role: string
  phone?: string
  department_id?: string
}) =>
  api
    .post<{ success: boolean; data: User }>('/users', payload)
    .then(wrap)

export const updateUser = (id: string, payload: Partial<User>) =>
  api
    .put<{ success: boolean; data: User }>(`/users/${id}`, payload)
    .then(wrap)

export const deleteUser = (id: string) =>
  api.delete(`/users/${id}`).then(r => r.data)

export const resetUserPassword = (id: string, newPassword: string) =>
  api.put(`/users/${id}/password`, { new_password: newPassword }).then(r => r.data)
