import React from 'react'
import { TaskCard } from './TaskCard'
import { EmptyState } from '../common/EmptyState'
import type { Task, TaskStatus } from '../../types'

interface TaskBoardProps { tasks: Task[] }

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'pending',    label: 'Pending',    color: 'bg-gray-100' },
  { status: 'in_progress',label: 'In Progress',color: 'bg-blue-100' },
  { status: 'hold',       label: 'Hold',       color: 'bg-amber-100' },
  { status: 'issue_hold', label: 'Issue Hold', color: 'bg-purple-100' },
  { status: 'completed',  label: 'Completed',  color: 'bg-green-100' },
]

export const TaskBoard: React.FC<TaskBoardProps> = ({ tasks }) => (
  <div className="flex gap-4 overflow-x-auto pb-4">
    {COLUMNS.map(col => {
      const colTasks = tasks.filter(t => t.status === col.status)
      return (
        <div key={col.status} className="min-w-65 w-64 shrink-0">
          <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg ${col.color}`}>
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              {col.label}
            </span>
            <span className="text-xs font-bold text-gray-500">{colTasks.length}</span>
          </div>
          <div className="space-y-3 p-2 bg-gray-50/80 rounded-b-lg min-h-30">
            {colTasks.length === 0
              ? <p className="text-xs text-gray-400 text-center py-6">Empty</p>
              : colTasks.map(t => <TaskCard key={t.id} task={t} />)
            }
          </div>
        </div>
      )
    })}
  </div>
)
