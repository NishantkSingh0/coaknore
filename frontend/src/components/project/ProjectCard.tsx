import React from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Package, IndianRupee, AlertTriangle } from 'lucide-react'
import { Badge } from '../common/Badge'
import { formatDate, formatCurrency, taskCardBg } from '../../utils'
import { cn } from '../../utils/cn'
import type { Project } from '../../types'

interface ProjectCardProps {
  project: Project
  href: string
  showStatus?: boolean
  routingProgress?: number
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, href, showStatus = true, routingProgress }) => {
  const isOverdue = false // project-level overdue not computed; use task level
  const bg = project.current_status === 'completed' ? 'bg-[#F0FFF4]' : 'bg-white'

  return (
    <Link
      to={href}
      className={cn(
        'block rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow',
        bg
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <span className="text-xs font-mono text-indigo-600 font-semibold">#{project.po_number}</span>
          <h3 className="text-sm font-semibold text-gray-900 mt-0.5 line-clamp-2">
            {project.project_name}
          </h3>
        </div>
        {showStatus && <Badge status={project.current_status} />}
      </div>

      {project.image_url && (
        <img
          src={project.image_url}
          alt={project.project_name}
          className="w-full h-32 object-cover rounded-lg mb-3"
          loading="lazy"
        />
      )}

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <Calendar size={12} className="text-gray-400" />
          {formatDate(project.receiving_date)}
        </div>
        <div className="flex items-center gap-1">
          <Package size={12} className="text-gray-400" />
          Qty: {project.quantity}
        </div>
        <div className="flex items-center gap-1 col-span-2">
          <IndianRupee size={12} className="text-gray-400" />
          {formatCurrency(project.rates)}
        </div>
      </div>

      {/* Routing Progress Bar */}
      {routingProgress !== undefined && routingProgress > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Project Progress</span>
            <span>{routingProgress}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${routingProgress}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  )
}
