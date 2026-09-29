import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../services/api'
import type { Employee } from '../types'

interface AuthContextValue {
  user: Employee | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (updatedUser: Employee) => void
  isAdmin: boolean
  isLayerTwo: boolean
  isLayerThree: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Employee | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('pms_token')
    if (storedToken) {
      setToken(storedToken)
      // Fetch fresh user data from backend
      authApi.me()
        .then(employee => setUser(employee))
        .catch(() => {
          // If token is invalid, clear it
          localStorage.removeItem('pms_token')
          setToken(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    localStorage.setItem('pms_token', res.token)
    setToken(res.token)
    setUser(res.employee)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('pms_token')
    setToken(null)
    setUser(null)
  }, [])

  const updateUser = useCallback((updatedUser: Employee) => {
    setUser(updatedUser)
  }, [])

  const isAdmin = user?.layer === 'layer1' || user?.layer === 'super_admin'
  const isLayerTwo = user?.layer === 'layer2'
  const isLayerThree = user?.layer === 'layer3'

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser, isAdmin, isLayerTwo, isLayerThree }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
