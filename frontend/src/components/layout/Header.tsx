import React from 'react'
import { LogOut, Menu } from 'lucide-react'
import { NotificationBell } from '../notifications/NotificationBell'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

interface HeaderProps { title?: string }

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const { clearAuth } = useAuthStore()
  const { toggleSidebar } = useUIStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
    toast.success('Logged out successfully')
  }

  return (
    <header className="h-16 px-6 flex items-center justify-between bg-white border-b border-gray-200 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
        {title && <h1 className="text-lg font-semibold text-gray-900">{title}</h1>}
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <div className="h-6 w-px bg-gray-200" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-600
            hover:bg-gray-100 hover:text-gray-900 transition-colors"
          aria-label="Log out"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  )
}
