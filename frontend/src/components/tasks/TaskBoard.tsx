import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClockIcon, UserCircleIcon, PlusIcon } from '@heroicons/react/24/outline'
import { taskApi, routingApi } from '../../services/api'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../context/AuthContext'
import { fmtDate } from '../../utils/helpers'
import { TaskBadge } from '../ui/StatusBadge'
import { Avatar } from '../ui/Avatar'
import type { TaskStatus, DepartmentTask, Routing } from '../../types'

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'pending', label: 'Pending', color: 'bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-700'},
  { status: 'on_hold', label: 'On Hold', color: 'bg-yellow-50 border-yellow-300 dark:bg-yellow-800/20 dark:border-yellow-700'},
  { status: 'issue_hold', label: 'Issue Hold', color: 'bg-red-50 border-red-200 dark:bg-red-800/20 dark:border-red-700'},
  { status: 'in_progress', label: 'In Progress', color: 'bg-blue-50 border-blue-200 dark:bg-blue-800/20 dark:border-blue-700'},
  { status: 'completed', label: 'Completed', color: 'bg-green-50 border-green-200 dark:bg-green-800/20 dark:border-green-700'}
]

export default function TaskBoard({ projectId }: { projectId: string }) {
  const { isLayerThree } = useAuth()

  const { data: tasks, loading } = useAsync(
    () => taskApi.getProjectTasks(projectId),
    [projectId]
  )

  const { data: routings } = useAsync(
    () => routingApi.listForProject(projectId),
    [projectId]
  )

  if (loading) {
    return <div className="flex justify-center py-12">
      <div className="w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  }

  // Get active routing to determine all departments in the workflow
  const activeRouting = routings?.find(r => r.status === 'active')
  
  // Collect all departments from routing steps
  const routingDepartments = new Map<string, { id: string; name: string }>()
  if (activeRouting) {
    activeRouting.steps.forEach(step => {
      step.departments.forEach(dept => {
        if (!routingDepartments.has(dept.name)) {
          routingDepartments.set(dept.name, { id: dept.id, name: dept.name })
        }
      })
    })
  }

  // Preserve department order as they first appear in the routing, then tasks.
  // Each department gets a fixed row, regardless of which status column
  // its task currently sits in.
  const departmentOrder: string[] = []
  const taskByDept = new Map<string, DepartmentTask>()
  
  // First add departments from routing
  routingDepartments.forEach((dept, name) => {
    if (!departmentOrder.includes(name)) {
      departmentOrder.push(name)
    }
  })
  
  // Then add departments from existing tasks (in case routing is not set yet)
  ;(tasks || []).forEach((t) => {
    const key = t.department_name || 'Unknown'
    if (!departmentOrder.includes(key)) {
      departmentOrder.push(key)
    }
    // If a department somehow has multiple tasks, keep the first one
    // for row placement (adjust here if multiple tasks per dept/row is needed).
    if (!taskByDept.has(key)) {
      taskByDept.set(key, t)
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Task Board</h3>
        <span className="text-sm text-gray-500">{tasks?.length || 0} tasks total</span>
      </div>

      {tasks && tasks.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          <p className="text-sm">No tasks yet. Publish a routing to generate tasks.</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div
            className="grid gap-x-3 min-w-[900px]"
            style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(0, 1fr))` }}
          >
            {/* Header row */}
            {COLUMNS.map((col) => {
              const count = departmentOrder.filter(
                (dep) => taskByDept.get(dep)?.status === col.status
              ).length
              return (
                <div
                  key={col.status}
                  className={`rounded-lg border p-2 mb-2 ${col.color} flex items-center justify-between`}
                >
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-200">
                    {col.label}
                  </span>
                  <span className="text-xs bg-white/80 dark:bg-gray-700/70 text-gray-500 dark:text-gray-200 rounded-full px-2 py-0.5">
                    {count}
                  </span>
                </div>
              )
            })}

            {/* One row per department, in stable order */}
            {departmentOrder.map((dep) => {
              const task = taskByDept.get(dep)
              return COLUMNS.map((col) => (
                <div
                  key={`${dep}-${col.status}`}
                  className={`py-1 px-2 ${col.color.split(' ')[0]} dark:bg-gray-900`}
                >
                  {task && task.status === col.status && <TaskCard task={task} />}
                  {!task && col.status === 'pending' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-gray-900 dark:text-gray-100">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{dep}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-300">Pending assignment</p>
                    </div>
                  )}
                </div>
              ))
            })}
          </div>
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
      className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:shadow-md transition-shadow cursor-pointer text-gray-900 dark:text-gray-100"
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
                <Avatar key={e.id} src={e.avatar_url} firstName={e.first_name} lastName={e.last_name} size="xs" className="border border-white" />
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