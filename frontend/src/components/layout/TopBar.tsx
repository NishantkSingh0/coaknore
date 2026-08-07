import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellIcon, ArrowRightOnRectangleIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../context/AuthContext'
import { notifApi } from '../../services/api'
import { useEffect } from 'react'
import BellButton from './bellIcon'
import { useFullscreen } from '../../hooks/useFullscreen'


export default function TopBar() {
  const { logout } = useAuth()
  const { isFullscreen, toggleFullscreen } = useFullscreen()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    loadUnreadCount()
    const interval = setInterval(loadUnreadCount, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [toggleFullscreen])

  const loadUnreadCount = async () => {
    try {
      const res = await notifApi.getCount()
      setUnreadCount(res.count)
    } catch {
      // silent
    }
  }

  return (
    <header className="h-[55px] bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 flex-shrink-0">
      <div />
      <div className="flex items-center gap-4">
        {/* Fullscreen toggle button */}
        <button
          onClick={toggleFullscreen}
          className="p-2 text-gray-400 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white rounded-lg transition-colors"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? (
            <ArrowsPointingInIcon className="w-5 h-5" />
          ) : (
            <ArrowsPointingOutIcon className="w-5 h-5" />
          )}
        </button>

        {/* Notification icon */}
        <Link
          to="/notifications"
          className="relative p-2 text-gray-400 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white rounded-lg transition-colors"
        >
          <BellButton isNotification={unreadCount > 0} unreadCount={unreadCount}/>
        </Link>
      </div>
    </header>
  )
}