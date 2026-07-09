import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../services/api'
import toast from 'react-hot-toast'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'


export default function SettingsPage() {
  const { logout } = useAuth()
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
        <div className="card-header flex items-center justify-between">
          <h2 className="font-semibold">My Profile</h2>
          <button
            onClick={logout}
            className="group flex items-center w-10 hover:w-28 h-10 overflow-hidden rounded-lg border border-gray-200 bg-white hover:bg-red-50 transition-all duration-300"
          >
            <ArrowRightOnRectangleIcon
              className="w-5 h-5 flex-shrink-0 text-black ml-2 group-hover:text-red-600 transition-colors duration-300"
            />

            <span className="ml-2 whitespace-nowrap text-sm font-medium text-red-600 opacity-0 max-w-0 group-hover:max-w-20 group-hover:opacity-100 transition-all duration-300 overflow-hidden">
              Logout
            </span>
          </button>
        </div>
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
                {user?.department_name ? ` · ${user.department_name}` : 'Admin'}
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
