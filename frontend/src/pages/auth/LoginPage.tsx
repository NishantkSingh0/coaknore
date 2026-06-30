import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../store/authStore'
import { Input } from '../../components/common/Input'
import { Button } from '../../components/common/Button'
import toast from 'react-hot-toast'
import { getRoleRoute } from '../../utils'

export const LoginPage: React.FC = () => {
  const { login } = useAuth()
  const { user, isAuthenticated } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated() && user) {
    return <Navigate to={getRoleRoute(user.role, user.dept_layer)} replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message ?? 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen
      flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="/images/logo4.png" alt="PMS Logo" className="h-16 w-16 object-contain"/>
          </div>
          <div className="inline-block group cursor-pointer">
            <h1 className="relative text-2xl font-bold text-gray-900">
              Crafted Oak &amp; Ore Pvt Ltd.
              <span
                className="absolute left-0 -bottom-1 h-0.5 w-full origin-center scale-x-0 bg-black transition-transform duration-500 ease-in-out group-hover:scale-x-100"/>
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-5">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@oaknore.in"
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          <Button type="submit" className="w-full justify-center" loading={loading} size="lg">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  )
}
