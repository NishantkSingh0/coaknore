import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClockIcon, FolderIcon, CalendarDaysIcon, LockClosedIcon, PhotoIcon, PaperClipIcon, PlusIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { routingApi, projectApi } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../utils/helpers'
import clsx from 'clsx'
import { usePreviewModal } from '../hooks/usePreviewModal'
import { TaskBadge } from '../components/ui/StatusBadge'

export default function UpcomingTasksPage() {
  const { user, isLayerThree } = useAuth()
  const [page, setPage] = useState(1)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)

  const { data, loading } = useAsync(
    () => user?.department_id ? routingApi.getUpcomingTasks(user.department_id) : Promise.resolve([]),
    [user?.department_id]
  )

  const handleExpand = async (taskId: string) => {
    if (expandedTask === taskId) {
      setExpandedTask(null)
    } else {
      setExpandedTask(taskId)
    }
  }

  const isComingSoon = (upcoming: any) => {
    // Show as "Coming Soon" if the task doesn't have an assignment date
    // This means it's not the immediate next step in the routing sequence
    return !upcoming.assignment_date
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Upcoming Tasks</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          These tasks will be routed to you very soon. Actions are disabled until the task is assigned.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {data?.length === 0 && (
            <div className="card p-8 text-center text-gray-400 text-sm">No upcoming tasks</div>
          )}
          {data?.map((upcoming) => (
            <div key={upcoming.id} className="card">
              <div 
                className="p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                onClick={() => handleExpand(upcoming.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="badge-gray bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        Step {upcoming.step_order}
                      </span>
                      {isComingSoon(upcoming) ? (
                        <span className="text-xs text-orange-500 dark:text-orange-400 flex items-center gap-1">
                          <ClockIcon className="w-3.5 h-3.5" />
                          Coming Soon
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <LockClosedIcon className="w-3.5 h-3.5" />
                          Upcoming
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {upcoming.project_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <FolderIcon className="w-3.5 h-3.5" />
                        {upcoming.step_name || `Step ${upcoming.step_order}`}
                      </span>
                      <span>•</span>
                      <span>{upcoming.dept_name}</span>
                    </div>
                    {isLayerThree && upcoming.assignment_date && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <CalendarDaysIcon className="w-3.5 h-3.5" />
                        Assignment Date: {fmtDate(upcoming.assignment_date)}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <CalendarDaysIcon className="w-3.5 h-3.5" />
                      Added {fmtDate(upcoming.created_at)}
                    </p>
                  </div>
                </div>
              </div>
              
              {expandedTask === upcoming.id && (
                <ExpandedTaskView upcoming={upcoming} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExpandedTaskView({ upcoming }: { upcoming: any }) {
  const { isLayerThree } = useAuth()
  const { openPreview } = usePreviewModal()
  const { data: restrictedProject } = useAsync(
    () => projectApi.getRestricted(upcoming.project_id),
    [upcoming.project_id]
  )

  const rp = restrictedProject as Record<string, string> | null

  // Calculate expected coming date
  const expectedComingDate = upcoming.assignment_date ? fmtDate(upcoming.assignment_date) : 'Coming Soon'

  return (
    <div className="border-t border-gray-100 dark:border-gray-800">
      <div className="p-5 space-y-4">
        {/* Drawing Preview (Level 3) - Match TaskDetailPage layout */}
        {isLayerThree && rp?.drawing_url && (
          <div className="card p-4">
            <div 
              className="relative group bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer"
              onClick={() => openPreview(rp.drawing_url!, rp.drawing_name || 'Project Drawing')}
            >
              <img
                src={rp.drawing_url}
                alt={rp.drawing_name || 'Project Drawing'}
                className="w-full h-auto max-h-96 object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                onError={(e) => {
                  e.currentTarget.parentElement?.style.setProperty('display', 'none')
                }}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                <PhotoIcon className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>
        )}

        {/* Header - Match TaskDetailPage layout */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">{upcoming.project_name}</span>
              <span className="text-gray-400 dark:text-gray-600">/</span>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{upcoming.step_name || `Step ${upcoming.step_order}`}</h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <span>{upcoming.dept_name}</span>
              <TaskBadge status="pending" />
            </div>
          </div>
          {/* Disabled Action Buttons */}
          <div className="flex gap-2">
            <button disabled className="btn-secondary flex items-center gap-1 opacity-50 cursor-not-allowed">
              <PlusIcon className="w-4 h-4" /> Add Subtask
            </button>
            <button disabled className="btn-danger flex items-center gap-1 opacity-50 cursor-not-allowed">
              <ExclamationCircleIcon className="w-4 h-4" /> Raise Issue
            </button>
          </div>
        </div>

        {/* Subtask Progress - Match TaskDetailPage layout */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Subtask Progress</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">0/0 completed</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: '0%' }} />
          </div>
        </div>

        {/* Expected Coming Date - Match TaskDetailPage layout */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Expected Coming Date</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{expectedComingDate}</p>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <LockClosedIcon className="w-3 h-3" /> Locked
            </span>
          </div>
        </div>

        {/* Project Information (Layer 3) - Match TaskDetailPage layout */}
        {isLayerThree && rp && (
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Project Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">PO Number</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{rp.po_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Step Order</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{upcoming.step_order}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Department</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{upcoming.dept_name}</p>
              </div>
              {upcoming.assignment_date && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Assignment Date</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{fmtDate(upcoming.assignment_date)}</p>
                </div>
              )}
            </div>
            {rp.render_files_url && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => openPreview(rp.render_files_url!, 'Render Files')}
                  className="text-sm text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <PaperClipIcon className="w-4 h-4" /> View Render Files
                </button>
              </div>
            )}
            {rp.drawing_url && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Drawing File</p>
                <button
                  type="button"
                  onClick={() => openPreview(rp.drawing_url!, rp.drawing_name || 'Drawing File')}
                  className="text-sm text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <PaperClipIcon className="w-4 h-4" /> {rp.drawing_name || 'View Drawing'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
