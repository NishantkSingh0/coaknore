import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../context/AuthContext'
import { notifApi } from '../../services/api'
import { useEffect } from 'react'
import BellButton from './bellIcon'


export default function TopBar() {
  const { logout } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    loadUnreadCount()
    const interval = setInterval(loadUnreadCount, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [])

  const loadUnreadCount = async () => {
    try {
      const res = await notifApi.getCount()
      setUnreadCount(res.count)
    } catch {
      // silent
    }
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div />

      <div className="flex items-center gap-4">
        {/* Notification icon */}
        <Link
          to="/notifications"
          className="relative p-2 text-gray-400 hover:text-gray-700 rounded-lg transition-colors"
        >
          <BellButton isNotification={unreadCount > 0} unreadCount={unreadCount}/>
          {/* {unreadCount > 0 && (
            <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )} */}
        </Link>
      </div>
    </header>
  )
}
