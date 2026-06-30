import { useAuthStore } from '../store/authStore'
import { login as loginApi } from '../api/auth'
import { useNavigate } from 'react-router-dom'
import { getRoleRoute } from '../utils'
import toast from 'react-hot-toast'

export function useAuth() {
  const { user, setAuth, clearAuth, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  const login = async (email: string, password: string) => {
    const data = await loginApi({ email, password })
    setAuth(data.user, data.token)
    navigate(getRoleRoute(data.user.role, data.user.dept_layer))
  }

  const logout = () => {
    clearAuth()
    navigate('/login')
    toast.success('Logged out')
  }

  return { user, login, logout, isAuthenticated }
}
