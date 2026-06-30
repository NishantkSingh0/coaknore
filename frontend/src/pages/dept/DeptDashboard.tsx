import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTasks } from '../../api/tasks'
import { TaskBoard } from '../../components/task/TaskBoard'
import { Spinner } from '../../components/common/Spinner'
import { EmptyState } from '../../components/common/EmptyState'

export const DeptDashboard: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-700">
        Failed to load tasks. Please refresh.
      </div>
    )
  }

  const tasks = Array.isArray(data) ? data : []

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">My Tasks</h2>
      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks assigned"
          description="Tasks will appear here once Production sets routing for a project."
        />
      ) : (
        <TaskBoard tasks={tasks} />
      )}
    </div>
  )
}
