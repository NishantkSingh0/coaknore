import React, { useState, useRef, useEffect } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
import { formatDateTime } from '../../utils'
import { cn } from '../../utils/cn'

export const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, markOne, markAll } = useNotifications()

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white
            text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200
          rounded-xl shadow-lg z-40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-900">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAll()}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-gray-400">You're all caught up</li>
            ) : notifications.map(n => (
              <li
                key={n.id}
                onClick={() => { if (!n.is_read) markOne(n.id) }}
                className={cn(
                  'px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors',
                  !n.is_read && 'bg-indigo-50/60'
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                  )}
                  <div className={cn(!n.is_read ? '' : 'pl-4')}>
                    <p className="text-sm font-medium text-gray-900 leading-tight">{n.title}</p>
                    {n.body && <p className="text-xs text-gray-500 mt-0.5 leading-snug">{n.body}</p>}
                    <p className="text-[11px] text-gray-400 mt-1">{formatDateTime(n.created_at)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
