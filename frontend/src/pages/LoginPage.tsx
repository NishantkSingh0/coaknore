import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const DOMAIN = '@oaknore.in'

export default function LoginPage() {
  const { user, login } = useAuth()
  const [nameInput, setNameInput] = useState('')     // exactly what's in the visible input
  const [suggestionExpired, setSuggestionExpired] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [anim, setAnim] = useState("");

  if (user) return <Navigate to="/dashboard" replace />

  // The value actually used for login
  const email = nameInput === ''
    ? ''
    : (suggestionExpired || nameInput.includes('@'))
      ? nameInput
      : nameInput + DOMAIN

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value

    if (raw === '') {
      setNameInput('')
      setSuggestionExpired(false) // reset once cleared, so suggestion can work again
      return
    }

    if (raw.includes('@')) {
      // User typed '@' themselves — suggestion expires permanently for this entry
      setSuggestionExpired(true)
    }

    setNameInput(raw)
  }

  const handleNameBlur = () => {
    // On blur, "apply" the suggestion: bake the domain into the actual value
    // so it renders as normal dark text instead of a light ghost overlay.
    if (nameInput !== '' && !suggestionExpired && !nameInput.includes('@')) {
      setNameInput(nameInput + DOMAIN)
      setSuggestionExpired(true) // it's now real text; treat like manual entry going forward
    }
  }

  const showGhostSuggestion = nameInput !== '' && !suggestionExpired && !nameInput.includes('@')

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
            <div className="relative">
              {showGhostSuggestion && (
                <div
                  className="input absolute inset-0 pointer-events-none flex items-center bg-transparent border-transparent"
                  aria-hidden="true"
                >
                  <span className="invisible whitespace-pre">{nameInput}</span>
                  <span className="text-gray-400">{DOMAIN}</span>
                </div>
              )}
              <input
                type="text"
                value={nameInput}
                onChange={handleNameChange}
                onBlur={handleNameBlur}
                className="input relative bg-transparent"
                placeholder="•••@oaknore.in"
                autoComplete="email"
                required
              />
            </div>
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