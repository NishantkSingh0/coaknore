import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../services/api'
import toast from 'react-hot-toast'
import { ArrowRightOnRectangleIcon, CameraIcon } from '@heroicons/react/24/outline'
import { Avatar } from '../components/ui/Avatar'
import DayNightBtn from '../components/layout/day_night_btn'


export default function SettingsPage() {
  const { logout, updateUser } = useAuth()
  const { user } = useAuth()
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Limit to 5MB and image types
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    setUploading(true)
    try {
      const updatedUser = await authApi.updateAvatar(file)
      updateUser(updatedUser)
      toast.success('Avatar updated successfully')
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to upload avatar')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Are you sure you want to remove your avatar?')) return
    setUploading(true)
    try {
      const updatedUser = await authApi.removeAvatar()
      updateUser(updatedUser)
      toast.success('Avatar removed successfully')
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to remove avatar')
    } finally {
      setUploading(false)
    }
  }

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
      

      {/* Profile Card */}
      <div className="card mt-16">
        <div className="card-header flex items-center justify-between">
          <h2 className="font-semibold text-xl">Settings</h2>
          <div className="flex items-center gap-3">
            <DayNightBtn />
            <button
              onClick={logout}
              className="flex items-center w-10 h-10 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-800 hover:bg-red-400 dark:hover:bg-red-700 transition-all duration-300"
            >
              <ArrowRightOnRectangleIcon
                className="w-5 h-5 flex-shrink-0 text-black dark:text-gray-100 ml-2 transition-colors duration-300"
              />
            </button>
          </div>
        </div>
        <div className="card-body space-y-3 text-sm">
          <div className="flex items-center gap-4">
            <div className="relative group w-16 h-16 rounded-full overflow-hidden border border-gray-500">
              <Avatar src={user?.avatar_url} firstName={user?.first_name} lastName={user?.last_name} size="lg" />
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
              >
                <CameraIcon className="w-5 h-5 text-white" />
              </label>
              <input
                type="file"
                id="avatar-upload"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={uploading}
                className="hidden"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <div>
              <p className="text-lg font-bold dark:text-gray-200 text-gray-900">{user?.first_name} {user?.last_name}</p>
              <p className="text-gray-500 dark:text-gray-400">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400 font-semibold dark:text-gray-200 capitalize">
                  {user?.department_name ? ` ${user.department_name}` : 'Admin'}
                </span>
                {user?.avatar_url && (
                  <>
                    <span className="text-gray-300">•</span>
                    <button
                      onClick={handleRemoveAvatar}
                      disabled={uploading}
                      className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-500 font-medium cursor-pointer"
                    >
                      Remove avatar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card">
        <div className="card-header"><h2 className="font-semibold">Change Password</h2> <h5 className='text-xs'>Contact Admin If you Forget your Current Password</h5> </div>
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
                className="input" required />
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
