import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../services/api'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { user } = useAuth()
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPwd !== confirmPwd) { toast.error('New passwords do not match'); return }
    if (newPwd.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await authApi.changePassword(currentPwd, newPwd)
      toast.success('Password updated successfully')
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="page-title">Settings</h1>

      {/* Profile Card */}
      <div className="card">
        <div className="card-header"><h2 className="font-semibold">My Profile</h2></div>
        <div className="card-body space-y-3 text-sm">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center">
              <span className="text-brand-700 text-2xl font-bold">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </span>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{user?.first_name} {user?.last_name}</p>
              <p className="text-gray-500">{user?.email}</p>
              <p className="text-xs text-gray-400 mt-1 capitalize">
                {user?.layer?.replace('_', ' ')}
                {user?.department_name ? ` · ${user.department_name}` : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card">
        <div className="card-header"><h2 className="font-semibold">Change Password</h2></div>
        <div className="card-body">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="label">Current Password</label>
              <input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)}
                className="input" required />
            </div>
            <div>
              <label className="label">New Password</label>
              <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
                className="input" placeholder="Min 8 characters" required />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)}
                className="input" required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
