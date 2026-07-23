import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellIcon } from '@heroicons/react/24/outline'
import { CheckIcon } from '@heroicons/react/24/solid'
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

// Priority tiers — drive the color-coding so the most time-sensitive
// notifications visually stand out first.
type Priority = 'critical' | 'important' | 'standard'

const NOTIF_PRIORITY: Record<string, Priority> = {
  // Critical — needs immediate attention / blocks work
  overdue_task: 'critical',
  department_reopened: 'critical',
  project_revision: 'critical',
  rework_request: 'critical',
  material_request: 'critical',
  query_received: 'critical',
  issue_raised: 'critical',
  routing_assigned: 'critical',
  routing_updated: 'critical',
  project_created: 'critical',

  // Important — resolutions / decisions on the above
  query_replied: 'important',
  query_closed: 'important',
  rework_approved: 'important',
  rework_rejected: 'important',
  material_approved: 'important',
  material_rejected: 'important',
  issue_closed: 'important',
  issue_rejected: 'important',
  issue_approved: 'important',

  // Standard — routine day-to-day progress updates
  task_assigned: 'standard',
  task_started: 'standard',
  task_completed: 'standard',
  subtask_completed: 'standard',
  proof_uploaded: 'standard',
  daily_report_submitted: 'standard',
}

const getPriority = (type: string): Priority => NOTIF_PRIORITY[type] || 'standard'

const PRIORITY_META: Record<Priority, {
  label: string
  badge: string
  border: string
  bgUnread: string
  iconRing: string
}> = {
  critical: {
    label: 'Critical',
    badge: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-800',
    border: 'border-l-4 border-l-red-500 dark:border-l-red-500',
    bgUnread: 'bg-red-50/60 dark:bg-red-950/30',
    iconRing: 'bg-red-100 dark:bg-red-950 ring-1 ring-red-200 dark:ring-red-800',
  },
  important: {
    label: 'Important',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    border: 'border-l-4 border-l-amber-500 dark:border-l-amber-500',
    bgUnread: 'bg-amber-50/60 dark:bg-amber-950/20',
    iconRing: 'bg-amber-100 dark:bg-amber-950 ring-1 ring-amber-200 dark:ring-amber-800',
  },
  standard: {
    label: 'Standard',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
    border: 'border-l-4 border-l-gray-300 dark:border-l-gray-600',
    bgUnread: 'bg-brand-50/50 dark:bg-gray-800',
    iconRing: 'bg-gray-100 dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700',
  },
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
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-brand-400  cursor-pointer">
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

      {/* Priority legend — orients people before they scan the list */}
      {!loading && data?.data && data.data.length > 0 && (
        <div className="flex items-center gap-4 px-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
            Critical
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
            Important
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
            Standard
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card divide-y divide-gray-300 dark:divide-gray-400">
          {data?.data?.length === 0 && (
            <div className="p-12 text-center">
              <BellIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No notifications</p>
            </div>
          )}
          {data?.data?.map((notif) => {
            const priority = getPriority(notif.type)
            const meta = PRIORITY_META[priority]
            return (
              <div
                key={notif.id}
                className={clsx(
                  'flex items-start gap-3 px-5 py-4 transition-colors',
                  meta.border,
                  !notif.is_read ? meta.bgUnread : 'dark:bg-gray-900'
                )}
              >
                <span className={clsx(
                  'text-xl flex-shrink-0 mt-0.5 w-9 h-9 rounded-full flex items-center justify-center',
                  meta.iconRing
                )}>
                  {NOTIF_ICON[notif.type] || '🔔'}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className={clsx(
                        'text-sm',
                        !notif.is_read
                          ? 'font-semibold text-gray-900 dark:text-white'
                          : 'text-gray-700 dark:text-gray-300'
                      )}
                    >
                      {notif.title}
                    </p>

                    {priority !== 'standard' && (
                      <span className={clsx(
                        'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0',
                        meta.badge
                      )}>
                        {meta.label}
                      </span>
                    )}
                  </div>

                  {notif.body && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {notif.body}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {fmtRelative(notif.created_at)}
                    </span>

                    {notif.project_name && (
                      <span className="text-xs text-brand-600 dark:text-brand-400">
                        · {notif.project_name}
                      </span>
                    )}
                  </div>
                </div>

                {!notif.is_read && (
                  <button
                    onClick={() => markRead(notif.id)}
                    className="p-1 text-gray-400 dark:text-white hover:text-brand-600 dark:hover:text-brand-100 flex-shrink-0"
                    title="Mark as read"
                  >
                    <CheckIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
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