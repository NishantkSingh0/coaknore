import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export default function LoginPage() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [anim, setAnim] = useState("");

  if (user) return <Navigate to="/dashboard" replace />

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back!')
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Login failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center px-4">
      <div className="hero-enter bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="hero-enter hero-enter-delay-1 group flex flex-col items-center mb-8">
          <img
            src="/invertedLogo.png"
            alt="Logo"
            onMouseEnter={() => {
              setAnim("");
              requestAnimationFrame(() => setAnim("animate-logo-spin"));
            }}
            onMouseLeave={() => {
              setAnim("");
              requestAnimationFrame(() => setAnim("animate-logo-spin"));
            }}
            onAnimationEnd={() => setAnim("")}
            className={clsx("w-16 h-16", anim)}
          />
          <h1 className="text-2xl font-bold pt-3 text-gray-900">Crafted Oak & Ore Pvt. Ltd.</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="hero-enter hero-enter-delay-2">
            <label className="label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="your@email.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="hero-enter hero-enter-delay-3">
            <label className="label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="hero-enter hero-enter-delay-4 btn-primary w-full"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="hero-enter hero-enter-delay-5 mt-6 text-center text-xs text-gray-500 leading-relaxed">This application is strictly intended for authorized staff and personnel of this Organization only! </p>
      </div>
      
    </div>
  )
}