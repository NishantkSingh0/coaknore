import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard, FolderKanban, Users, Building2,
  FileText, AlertCircle, ClipboardList, Upload, UserCircle,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { getInitials } from '../../utils'
import { cn } from '../../utils/cn'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { changePassword } from '../../api/auth'
import { getUser, updateUser } from '../../api/users'
import { uploadFile } from '../../api/files'
import toast from 'react-hot-toast'

interface NavItem { to: string; label: string; icon: React.ReactNode }

function getNavItems(role: string): NavItem[] {
  if (role === 'admin') return [
    { to: '/admin/dashboard',   label: 'Dashboard',   icon: <LayoutDashboard size={18} /> },
    { to: '/admin/projects',    label: 'Projects',    icon: <FolderKanban size={18} /> },
    { to: '/admin/employees',   label: 'Employees',   icon: <Users size={18} /> },
    { to: '/admin/departments', label: 'Departments', icon: <Building2 size={18} /> },
    { to: '/admin/reports',     label: 'Reports',     icon: <FileText size={18} /> },
  ]
  if (role === 'layer2') return [
    { to: '/production/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/production/projects',  label: 'Projects',  icon: <FolderKanban size={18} /> },
    { to: '/production/issues',    label: 'Issues',    icon: <AlertCircle size={18} /> },
    { to: '/production/reports',   label: 'Reports',   icon: <FileText size={18} /> },
  ]
  // layer3
  return [
    { to: '/dept/dashboard',  label: 'My Tasks',      icon: <LayoutDashboard size={18} /> },
    { to: '/dept/issues',     label: 'Issues',        icon: <AlertCircle size={18} /> },
    { to: '/dept/reports/new',label: 'Submit Report', icon: <ClipboardList size={18} /> },
  ]
}

export const Sidebar: React.FC = () => {
  const { user, setUser } = useAuthStore()
  const qc = useQueryClient()
  const [showProfile, setShowProfile] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarPreview, setAvatarPreview] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: () => getUser(user!.id),
    enabled: !!user?.id,
  })

  React.useEffect(() => {
    if (profile && user) {
      setAvatarUrl(profile.addon ?? '')
      setAvatarPreview(profile.avatar_url ?? '')
      if (profile.avatar_url !== user.avatar_url) {
        setUser({ ...user, avatar_url: profile.avatar_url })
      }
    }
  }, [profile, setUser, user])

  const avatarMutation = useMutation({
    mutationFn: () => updateUser(user!.id, { addon: avatarUrl }),
    onSuccess: updated => {
      if (user) setUser({ ...user, avatar_url: updated.avatar_url })
      qc.invalidateQueries({ queryKey: ['user-profile', user?.id] })
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Avatar updated')
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message ?? 'Failed to update avatar'),
  })

  const passwordMutation = useMutation({
    mutationFn: () => changePassword({ old_password: oldPassword, new_password: newPassword }),
    onSuccess: () => {
      setOldPassword('')
      setNewPassword('')
      toast.success('Password changed')
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message ?? 'Failed to change password'),
  })

  const handleAvatarUpload = async (file: File) => {
    if (!user) return
    setUploadingAvatar(true)
    try {
      const uploaded = await uploadFile(file, `users/${user.id}/avatar`)
      setAvatarUrl(uploaded.public_url ?? uploaded.url)
      setAvatarPreview(uploaded.url)
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message ?? 'Avatar upload failed')
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (!user) return null
  const navItems = getNavItems(user.role)

  return (
    <aside
      className=" group flex flex-col h-screen w-16 hover:w-60 bg-gray-900 text-gray-100 transition-all duration-300 ease-in-out shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
        <img src="/images/logo4.png" alt="PMS Logo" className="h-8 w-8 shrink-0 object-contain"/>
        <span
          className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-bold tracking-tight"
        >
          Crafted Oak & Ore
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all",
              isActive
                ? "bg-black text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            )
          }        >
          <span className="shrink-0 pl-1">
            {item.icon}
          </span>
        
          <span
            className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            {item.label}
          </span>
        </NavLink>
        ))}
      </nav>

      {/* User + Collapse */}
      <div className="border-t border-gray-800 p-3">
        <button
          type="button"
          onClick={() => setShowProfile(true)}
          className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left hover:bg-gray-800 transition-colors"
          aria-label="Open profile"
        >
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.name} className="h-8 w-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {getInitials(user.name)}
            </div>
          )}

          <div
            className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <p className="text-sm font-medium truncate">
              {user.name}
            </p>

            <p className="text-xs text-gray-400 capitalize">
              {user.role}
            </p>
          </div>
        </button>
      </div>

      <Modal open={showProfile} onClose={() => setShowProfile(false)} title="Profile" size="md">
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            {avatarPreview ? (
              <img src={avatarPreview} alt={user.name} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <UserCircle size={64} className="text-gray-300" />
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">{profile?.name ?? user.name}</p>
              <p className="text-xs text-gray-500">{profile?.email ?? user.email}</p>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                <Upload size={13} /> Upload Avatar
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingAvatar}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleAvatarUpload(file)
                  }}
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => avatarMutation.mutate()}
              loading={avatarMutation.isPending || uploadingAvatar}
              disabled={!avatarUrl}
            >
              Save Avatar
            </Button>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <Input
              label="Current Password"
              type="password"
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
            />
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              helper="Minimum 8 characters"
            />
            <div className="flex justify-end">
              <Button
                onClick={() => passwordMutation.mutate()}
                loading={passwordMutation.isPending}
                disabled={!oldPassword || !newPassword}
              >
                Change Password
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </aside>
  )
}
