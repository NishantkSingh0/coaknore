import api from './client'
import type { AuthUser } from '../types'

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

export const login = (payload: LoginPayload) =>
  api
    .post<{ success: boolean; data: LoginResponse }>('/auth/login', payload)
    .then(r => r.data.data)

export const changePassword = (payload: { old_password: string; new_password: string }) =>
  api
    .post('/auth/change-password', payload)
    .then(r => r.data)
