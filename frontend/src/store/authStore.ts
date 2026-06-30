import { create } from 'zustand'
import type { AuthUser } from '../types'

interface AuthState {
  user: AuthUser | null
  token: string | null
  setAuth: (user: AuthUser, token: string) => void
  setUser: (user: AuthUser) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
}

// Hydrate from localStorage on store init
const storedToken = localStorage.getItem('pms_token')
const storedUser = localStorage.getItem('pms_user')

export const useAuthStore = create<AuthState>((set, get) => ({
  user:  storedUser  ? JSON.parse(storedUser) : null,
  token: storedToken ?? null,

  setAuth: (user, token) => {
    localStorage.setItem('pms_token', token)
    localStorage.setItem('pms_user',  JSON.stringify(user))
    set({ user, token })
  },

  setUser: (user) => {
    localStorage.setItem('pms_user', JSON.stringify(user))
    set({ user })
  },

  clearAuth: () => {
    localStorage.removeItem('pms_token')
    localStorage.removeItem('pms_user')
    set({ user: null, token: null })
  },

  isAuthenticated: () => !!get().token,
}))
