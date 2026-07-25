import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BellIcon,
  FolderPlusIcon,
  ArrowsRightLeftIcon,
  ArrowPathIcon,
  ClipboardDocumentListIcon,
  PlayIcon,
  CheckCircleIcon,
  CheckIcon,
  PaperClipIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  XCircleIcon,
  ArchiveBoxIcon,
  ArrowPathRoundedSquareIcon,
  ChatBubbleLeftRightIcon,
  ArrowUturnLeftIcon,
  PencilSquareIcon,
  LockOpenIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid'
import { notifApi } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { fmtRelative } from '../utils/helpers'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// Icon components per notification type — outline style, no background,
// colored to match the row's priority tint.
const NOTIF_ICON: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  project_created: FolderPlusIcon,
  routing_assigned: ArrowsRightLeftIcon,
  routing_updated: ArrowPathIcon,
  task_assigned: ClipboardDocumentListIcon,
  task_started: PlayIcon,
  task_completed: CheckCircleIconSolid,
  subtask_completed: CheckCircleIcon,
  proof_uploaded: PaperClipIcon,
  daily_report_submitted: ChartBarIcon,
  issue_raised: ExclamationTriangleIcon,
  issue_approved: CheckCircleIconSolid,
  issue_closed: LockClosedIcon,
  issue_rejected: XCircleIcon,
  material_request: ArchiveBoxIcon,
  material_approved: CheckCircleIconSolid,
  material_rejected: XCircleIcon,
  rework_request: ArrowPathRoundedSquareIcon,
  rework_approved: CheckCircleIconSolid,
  rework_rejected: XCircleIcon,
  query_received: ChatBubbleLeftRightIcon,
  query_replied: ArrowUturnLeftIcon,
  query_closed: LockClosedIcon,
  project_revision: PencilSquareIcon,
  department_reopened: LockOpenIcon,
  overdue_task: ClockIcon,
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

// Solid hex values used as an inline-style fallback so the left border
// (and now the icon color) ALWAYS renders correctly on every row,
// regardless of Tailwind's JIT class scanning / purge behavior.
const PRIORITY_HEX: Record<Priority, string> = {
  critical: '#ef4444',   // red-500
  important: '#f97316',  // orange-500
  standard: '#9ca3af',   // gray-400
}

const PRIORITY_META: Record<Priority, {
  label: string
  badge: string
  bgUnread: string
}> = {
  critical: {
    label: 'Critical',
    badge: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-800',
    bgUnread: 'bg-red-50/60 dark:bg-red-950/30',
  },
  important: {
    label: 'Important',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 border border-orange-200 dark:border-orange-800',
    bgUnread: 'bg-orange-50/60 dark:bg-orange-950/20',
  },
  standard: {
    label: 'Standard',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
    bgUnread: 'bg-brand-50/50 dark:bg-gray-800/60',
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
    <div className="max-w-4xl mt-5 mx-auto space-y-6">
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
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_HEX.critical }} />
            Critical
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_HEX.important }} />
            Important
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_HEX.standard }} />
            Standard
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {data?.data?.length === 0 && (
            <div className="card p-12 text-center">
              <BellIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No notifications</p>
            </div>
          )}

          {/*
            Each notification is its own self-contained card with a
            defined background, border and shadow. Icons are now plain
            Heroicons (no circular background), colored to match the
            row's priority.
          */}
          <div className="space-y-2.5">
            {data?.data?.map((notif) => {
              const priority = getPriority(notif.type)
              const meta = PRIORITY_META[priority]
              const Icon = NOTIF_ICON[notif.type] || BellIcon
              return (
                <div
                  key={notif.id}
                  className={clsx(
                    'flex items-start gap-3 px-5 py-4 rounded-xl border transition-colors shadow-sm',
                    'border-gray-200 dark:border-gray-800',
                    !notif.is_read
                      ? meta.bgUnread
                      : 'bg-white dark:bg-gray-900'
                  )}
                  style={{ borderLeft: `4px solid ${PRIORITY_HEX[priority]}` }}
                >
                  <span className="flex-shrink-0 mt-0.5 w-9 h-9 flex items-center justify-center">
                    <Icon
                      className="w-6 h-6"
                      style={{ color: PRIORITY_HEX[priority] }}
                    />
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
        </>
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