import React, { useState } from 'react'
import { Calendar, User, Building2, ZoomIn } from 'lucide-react'
import { formatDate, truncate, getInitials } from '../../utils'
import type { DailyReport } from '../../types'

interface DailyReportCardProps { report: DailyReport }

export const DailyReportCard: React.FC<DailyReportCardProps> = ({ report }) => {
  const [lightbox, setLightbox] = useState(false)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-indigo-500 text-white text-xs font-bold
            flex items-center justify-center shrink-0">
            {getInitials(report.dept_name)}
          </div>
          <div>
            <p className="text-xs font-semibold text-indigo-700">{report.dept_name}</p>
            <p className="text-xs text-gray-500 font-mono">{report.project_name}</p>
          </div>
        </div>
        <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
          <Calendar size={11} /> {formatDate(report.report_date)}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-700 leading-relaxed mb-3">
        {truncate(report.description, 150)}
      </p>

      {/* Image thumbnail */}
      {report.image_url && (
        <div className="relative group cursor-pointer rounded-lg overflow-hidden h-32 bg-gray-100"
          onClick={() => setLightbox(true)}>
          <img
            src={report.image_url}
            alt="Report photo"
            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <ZoomIn size={24} className="text-white drop-shadow" />
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
        <User size={11} /> {report.user_name}
      </p>

      {/* Lightbox */}
      {lightbox && report.image_url && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <img
            src={report.image_url}
            alt="Full report photo"
            className="max-w-full max-h-full rounded-xl object-contain"
          />
        </div>
      )}
    </div>
  )
}
