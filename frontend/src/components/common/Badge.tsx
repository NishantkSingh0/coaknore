import React from 'react'
import { STATUS_COLORS, STATUS_LABELS, ISSUE_STATUS_COLORS } from '../../constants'
import { cn } from '../../utils/cn'

interface BadgeProps {
  status: string
  variant?: 'status' | 'issue'
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({ status, variant = 'status', className }) => {
  const colorMap = variant === 'issue' ? ISSUE_STATUS_COLORS : STATUS_COLORS
  const color = colorMap[status] ?? 'bg-gray-100 text-gray-600'
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, ' ')

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
      color, className
    )}>
      {label}
    </span>
  )
}
