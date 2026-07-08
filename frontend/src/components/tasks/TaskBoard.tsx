import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClockIcon, UserCircleIcon, PlusIcon } from '@heroicons/react/24/outline'
import { taskApi } from '../../services/api'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../context/AuthContext'
import { fmtDate } from '../../utils/helpers'
import { TaskBadge } from '../ui/StatusBadge'
import type { TaskStatus, DepartmentTask } from '../../types'

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'pending', label: 'Pending', color: 'bg-gray-50 border-gray-200' },
  { status: 'in_progress', label: 'In Progress', color: 'bg-blue-50 border-blue-200' },
  { status: 'hold', label: 'On Hold', color: 'bg-yellow-50 border-yellow-200' },
  { status: 'issue_hold', label: 'Issue Hold', color: 'bg-red-50 border-red-200' },
  { status: 'completed', label: 'Completed', color: 'bg-green-50 border-green-200' },
]

export default function TaskBoard({ projectId }: { projectId: string }) {
  const { isLayerThree } = useAuth()

  const { data: tasks, loading } = useAsync(
    () => taskApi.getProjectTasks(projectId),
    [projectId]
  )

  if (loading) {
    return <div className="flex justify-center py-12">
      <div className="w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  }

  const getByStatus = (status: TaskStatus) =>
    (tasks || []).filter((t) => t.status === status)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Task Board</h3>
        <span className="text-sm text-gray-500">{tasks?.length || 0} tasks total</span>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-5 gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const colTasks = getByStatus(col.status)
          return (
            <div key={col.status} className={`rounded-xl border p-3 min-h-48 ${col.color}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-600">{col.label}</span>
                <span className="text-xs bg-white/80 text-gray-500 rounded-full px-2 py-0.5">
                  {colTasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {colTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
                {colTasks.length === 0 && (
                  <div className="text-center py-4 text-xs text-gray-400">Empty</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* List view fallback for small screens */}
      {tasks && tasks.length === 0 && (
        <div className="card p-8 text-center text-gray-400">
          <p className="text-sm">No tasks yet. Publish a routing to generate tasks.</p>
        </div>
      )}
    </div>
  )
}

function TaskCard({ task }: { task: DepartmentTask }) {
  const completedSubtasks = task.subtasks?.filter((s) => s.status === 'completed').length || 0
  const totalSubtasks = task.subtasks?.length || 0

  return (
    <Link
      to={`/tasks/${task.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer"
    >
      <p className="text-xs font-semibold text-gray-800 mb-1">
        {task.department_name}
      </p>
      {task.title && (
        <p className="text-xs text-gray-500 mb-2 truncate">{task.title}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.assigned_employees && task.assigned_employees.length > 0 && (
            <div className="flex -space-x-1">
              {task.assigned_employees.slice(0, 3).map((e) => (
                <div key={e.id} className="w-5 h-5 rounded-full bg-brand-100 border border-white flex items-center justify-center">
                  <span className="text-brand-700 text-xs font-bold leading-none">
                    {e.first_name?.[0]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {task.due_date && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <ClockIcon className="w-3 h-3" />
            {fmtDate(task.due_date)}
          </span>
        )}
      </div>
      {totalSubtasks > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Progress</span>
            <span>{completedSubtasks}/{totalSubtasks}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1">
            <div
              className="bg-brand-500 rounded-full h-1 transition-all"
              style={{ width: `${totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  )
}
