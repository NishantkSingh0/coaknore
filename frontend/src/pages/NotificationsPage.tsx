import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellIcon, CheckIcon } from '@heroicons/react/24/outline'
import { notifApi } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { fmtRelative } from '../utils/helpers'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const NOTIF_ICON: Record<string, string> = {
  project_created: '📁',
  routing_assigned: '🔀',
  routing_updated: '🔄',
  task_assigned: '📋',
  task_started: '▶️',
  task_completed: '✅',
  subtask_completed: '☑️',
  proof_uploaded: '📎',
  daily_report_submitted: '📊',
  issue_raised: '⚠️',
  issue_approved: '✅',
  issue_closed: '🔒',
  issue_rejected: '❌',
  material_request: '📦',
  material_approved: '✅',
  material_rejected: '❌',
  rework_request: '🔁',
  rework_approved: '✅',
  rework_rejected: '❌',
  query_received: '💬',
  query_replied: '↩️',
  query_closed: '🔒',
  project_revision: '📝',
  department_reopened: '🔓',
  overdue_task: '⏰',
}

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)

  const { data, loading, refetch } = useAsync(
    () => notifApi.list({ page, page_size: 30, unread: unreadOnly }),
    [page, unreadOnly]
  )

  const markRead = async (id: string) => {
    await notifApi.markRead(id)
    refetch()
  }

  const markAllRead = async () => {
    await notifApi.markAllRead()
    toast.success('All notifications marked as read')
    refetch()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="page-header">
        <h1 className="page-title">Notifications</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1) }}
              className="w-4 h-4 text-brand-600 rounded"
            />
            Unread only
          </label>
          <button onClick={markAllRead} className="btn-secondary btn-sm">
            <CheckIcon className="w-4 h-4" /> Mark all read
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {data?.data?.length === 0 && (
            <div className="p-12 text-center">
              <BellIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No notifications</p>
            </div>
          )}
          {data?.data?.map((notif) => (
            <div
              key={notif.id}
              className={clsx(
                'flex items-start gap-3 px-5 py-4 transition-colors',
                !notif.is_read ? 'bg-brand-50/50' : ''
              )}
            >
              <span className="text-xl flex-shrink-0 mt-0.5">
                {NOTIF_ICON[notif.type] || '🔔'}
              </span>
              <div className="flex-1 min-w-0">
                <p className={clsx('text-sm', !notif.is_read ? 'font-semibold text-gray-900' : 'text-gray-700')}>
                  {notif.title}
                </p>
                {notif.body && (
                  <p className="text-xs text-gray-500 mt-0.5">{notif.body}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">{fmtRelative(notif.created_at)}</span>
                  {notif.project_name && (
                    <span className="text-xs text-brand-600">· {notif.project_name}</span>
                  )}
                </div>
              </div>
              {!notif.is_read && (
                <button
                  onClick={() => markRead(notif.id)}
                  className="p-1 text-gray-400 hover:text-brand-600 flex-shrink-0"
                  title="Mark as read"
                >
                  <CheckIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary btn-sm">Previous</button>
          <span className="text-sm text-gray-500">Page {page} of {data.total_pages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.total_pages} className="btn-secondary btn-sm">Next</button>
        </div>
      )}
    </div>
  )
}
