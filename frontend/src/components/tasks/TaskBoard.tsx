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

const COLUMNS: { status: TaskStatus; label: string; description: string; color: string; bg: string }[] = [
  { status: 'pending', label: 'Pending', description: 'Routing has not been initiated for these departments.', color: 'bg-gray-100 border-gray-300 dark:bg-gray-400/20 dark:border-gray-600', bg: 'bg-gray-50 dark:bg-gray-700/50' },
  { status: 'on_hold', label: 'On Hold', description: 'Routing has been assigned to this department, but the department admin has not started work yet.', color: 'bg-yellow-50 border-yellow-300 dark:bg-yellow-500/20 dark:border-yellow-500/40', bg: 'bg-yellow-50/60 dark:bg-yellow-900/30' },
  { status: 'issue_hold', label: 'Issue Hold', description: 'Work is currently on hold due to an issue in the department listed below.', color: 'bg-red-200 border-red-400 dark:bg-red-500/20 dark:border-red-500/40', bg: 'bg-red-300/60 dark:bg-red-900/50' },
  { status: 'in_progress', label: 'In Progress', description: 'Work is currently in progress in the department listed below.', color: 'bg-blue-200 border-blue-400 dark:bg-blue-500/20 dark:border-blue-500/40', bg: 'bg-blue-200/60 dark:bg-blue-900/30' },
  { status: 'completed', label: 'Completed', description: 'Work has been completed by the department listed below.', color: 'bg-green-200 border-green-400 dark:bg-green-500/20 dark:border-green-500/40', bg: 'bg-green-200/60 dark:bg-green-900/30' },
]

export default function TaskBoard({ projectId }: { projectId: string }) {
  const { isLayerThree } = useAuth()
  const [expandedRoutings, setExpandedRoutings] = useState<Set<string>>(new Set())

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

  // Group tasks by routing_id
  const tasksByRouting = new Map<string, DepartmentTask[]>()
  ;(tasks || []).forEach((t) => {
    const routingId = t.routing_id || 'none'
    if (!tasksByRouting.has(routingId)) {
      tasksByRouting.set(routingId, [])
    }
    tasksByRouting.get(routingId)!.push(t)
  })

  // Sort routings by version descending (latest first)
  const sortedRoutings = (routings || []).sort((a, b) => b.version - a.version)

  // Expand latest routing by default
  if (expandedRoutings.size === 0 && sortedRoutings.length > 0) {
    const latestRouting = sortedRoutings.find(r => r.is_latest)
    if (latestRouting) {
      setExpandedRoutings(new Set([latestRouting.id]))
    }
  }

  const toggleRouting = (routingId: string) => {
    setExpandedRoutings(prev => {
      const next = new Set(prev)
      if (next.has(routingId)) {
        next.delete(routingId)
      } else {
        next.add(routingId)
      }
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Task Board</h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">{tasks?.length || 0} tasks total</span>
      </div>

      {(!routings || routings.length === 0) && (
        <div className="card p-8 text-center text-gray-400 dark:text-gray-500">
          <p className="text-sm">No routings yet. Create a routing to generate tasks.</p>
        </div>
      )}

      {sortedRoutings.map((routing) => {
        const routingTasks = tasksByRouting.get(routing.id) || []
        const isExpanded = expandedRoutings.has(routing.id)

        return (
          <div key={routing.id} className="card">
            <div
              className="card-header cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              onClick={() => toggleRouting(routing.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    v{routing.version}{routing.name ? ` — ${routing.name}` : ''}
                  </span>
                  {routing.is_latest && (
                    <span className="badge-green text-xs">Latest</span>
                  )}
                  <span className={`badge text-xs ${
                    routing.status === 'active' ? 'badge-green' :
                    routing.status === 'draft' ? 'badge-blue' : 
                    routing.status === 'superseded' ? 'badge-orange' : 'badge-gray'
                  }`}>
                    {routing.status}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {routingTasks.length} tasks
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500 max-w-xs truncate">
                    {routing.change_reason || "First Route"}
                  </span>
                  <ClockIcon
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="card-body">
                {routingTasks.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 dark:text-gray-500">
                    <p className="text-sm">No routing is published for this routing version.</p>
                  </div>
                ) : (
                  <RoutingTaskBoard routing={routing} tasks={routingTasks} />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function RoutingTaskBoard({ routing, tasks }: { routing: Routing; tasks: DepartmentTask[] }) {
  // Collect all departments from routing steps
  const routingDepartments = new Map<string, { id: string; name: string }>()
  routing.steps.forEach(step => {
    step.departments.forEach(dept => {
      if (!routingDepartments.has(dept.name)) {
        routingDepartments.set(dept.name, { id: dept.id, name: dept.name })
      }
    })
  })

  // Preserve department order as they first appear in the routing, then tasks.
  const departmentOrder: string[] = []
  const taskByDept = new Map<string, DepartmentTask>()
  
  // First add departments from routing
  routingDepartments.forEach((dept, name) => {
    if (!departmentOrder.includes(name)) {
      departmentOrder.push(name)
    }
  })
  
  // Then add departments from existing tasks
  tasks.forEach((t) => {
    const key = t.department_name || 'Unknown'
    if (!departmentOrder.includes(key)) {
      departmentOrder.push(key)
    }
    if (!taskByDept.has(key)) {
      taskByDept.set(key, t)
    }
  })

  return (
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
              title={col.description}
              className={`rounded-lg border p-2 mb-2 ${col.color} flex items-center justify-between cursor-default`}
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
              className={`py-1 px-2 ${col.bg}`}
            >
              {task && task.status === col.status && <TaskCard task={task} />}
              {!task && col.status === 'pending' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-gray-900 dark:text-gray-100">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">{dep}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-400">Pending Project Assignment</p>
                </div>
              )}
            </div>
          ))
        })}
      </div>
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
      <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 mb-1">
        {task.department_name}
      </p>
      {task.title && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">{task.title}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.assigned_employees && task.assigned_employees.length > 0 && (
            <div className="flex -space-x-1">
              {task.assigned_employees.slice(0, 3).map((e) => (
                <Avatar key={e.id} src={e.avatar_url} firstName={e.first_name} lastName={e.last_name} size="xs" className="border border-white dark:border-gray-800" />
              ))}
            </div>
          )}
        </div>
        {task.due_date && (
          <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
            <ClockIcon className="w-3 h-3" />
            {fmtDate(task.due_date)}
          </span>
        )}
      </div>
      {totalSubtasks > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
            <span>Progress</span>
            <span>{completedSubtasks}/{totalSubtasks}</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1">
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