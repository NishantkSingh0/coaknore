import React from 'react'
import { Link } from 'react-router-dom'
import { Calendar, AlertTriangle } from 'lucide-react'
import { Badge } from '../common/Badge'
import { formatDate, taskCardBg } from '../../utils'
import { cn } from '../../utils/cn'
import type { Task } from '../../types'

interface TaskCardProps { task: Task }

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => (
  <Link
    to={`/dept/tasks/${task.id}`}
    className={cn(
      'block rounded-xl border p-4 hover:shadow-md transition-shadow',
      task.status === 'completed'  && 'border-green-200 bg-[#F0FFF4]',
      task.is_overdue               && 'border-red-200 bg-[#FFF0F0]',
      task.status === 'issue_hold' && 'border-purple-200 bg-purple-50',
      task.status === 'hold'       && 'border-amber-200 bg-amber-50',
      !task.status.includes('hold') && !task.is_overdue && task.status !== 'completed' && 'border-gray-200 bg-white',
    )}
  >
    <div className="flex items-start justify-between gap-2 mb-2">
      <div>
        <span className="text-xs font-mono text-indigo-600">#{task.po_number}</span>
        <p className="text-sm font-semibold text-gray-900 mt-0.5">{task.project_name}</p>
      </div>
      <Badge status={task.status} />
    </div>

    {task.is_overdue && (
      <div className="flex items-center gap-1 text-xs text-red-600 mb-2">
        <AlertTriangle size={12} />
        Overdue
      </div>
    )}

    <div className="flex items-center gap-4 text-xs text-gray-500">
      {task.start_date && (
        <span className="flex items-center gap-1">
          <Calendar size={11} /> Start: {formatDate(task.start_date)}
        </span>
      )}
      {task.due_date && (
        <span className={cn('flex items-center gap-1', task.is_overdue && 'text-red-500 font-medium')}>
          <Calendar size={11} /> Due: {formatDate(task.due_date)}
        </span>
      )}
    </div>
  </Link>
)
