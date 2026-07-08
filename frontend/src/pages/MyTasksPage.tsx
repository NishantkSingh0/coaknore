import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClockIcon } from '@heroicons/react/24/outline'
import { taskApi } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { fmtDate, taskStatusColor, taskStatusLabel, priorityColor, priorityLabel } from '../utils/helpers'
import { TaskBadge } from '../components/ui/StatusBadge'
import type { TaskStatus } from '../types'
import clsx from 'clsx'

const STATUS_OPTS: { label: string; value: TaskStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'On Hold', value: 'hold' },
  { label: 'Issue Hold', value: 'issue_hold' },
  { label: 'Completed', value: 'completed' },
]

export default function MyTasksPage() {
  const [status, setStatus] = useState<TaskStatus | ''>('')
  const [page, setPage] = useState(1)

  const { data, loading } = useAsync(
    () => taskApi.getMyTasks({ page, page_size: 20, status: status || undefined }),
    [page, status]
  )

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">My Tasks</h1>
      </div>

      <div className="card p-4 flex flex-wrap gap-2">
        {STATUS_OPTS.map((opt) => (
          <button key={opt.value}
            onClick={() => { setStatus(opt.value); setPage(1) }}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              status === opt.value ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}>
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {data?.data?.length === 0 && (
            <div className="card p-8 text-center text-gray-400 text-sm">No tasks found</div>
          )}
          {data?.data?.map((task) => {
            const completedSubs = task.subtasks?.filter((s) => s.status === 'completed').length || 0
            const totalSubs = task.subtasks?.length || 0
            return (
              <Link key={task.id} to={`/tasks/${task.id}`} className="card p-5 block hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <TaskBadge status={task.status} />
                      <span className={clsx('badge', priorityColor[task.priority])}>
                        {priorityLabel[task.priority]}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {task.title || task.department_name}
                    </p>
                    {task.due_date && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5" />
                        Due {fmtDate(task.due_date)}
                      </p>
                    )}
                  </div>
                  {totalSubs > 0 && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-500 mb-1">{completedSubs}/{totalSubs} subtasks</p>
                      <div className="w-24 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-brand-500 rounded-full h-1.5"
                          style={{ width: `${(completedSubs / totalSubs) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Link>
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
