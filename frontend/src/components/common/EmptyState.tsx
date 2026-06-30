import React from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
  action?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No data yet',
  description = 'Nothing to show here right now.',
  action,
}) => (
  <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500">
    <Inbox size={48} className="mb-4 text-gray-300" />
    <p className="text-lg font-medium text-gray-700">{title}</p>
    <p className="text-sm mt-1">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
)
