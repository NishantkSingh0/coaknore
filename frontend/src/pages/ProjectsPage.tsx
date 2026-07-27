import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PlusIcon, MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline'
import { projectApi } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../utils/helpers'
import { ProjectBadge } from '../components/ui/StatusBadge'
import type { ProjectStatus } from '../types'
import { usePreviewModal } from '../hooks/usePreviewModal'


const STATUS_OPTIONS: { label: string; value: ProjectStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Created', value: 'created' },
  { label: 'Routing', value: 'routing' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Archived', value: 'archived' },
  { label: 'On Hold', value: 'on_hold' },
]

export default function ProjectsPage() {
  const { isAdmin, isLayerTwo } = useAuth()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const { openPreview } = usePreviewModal()
  const navigate = useNavigate()
  const [status, setStatus] = useState<ProjectStatus | ''>(

    (searchParams.get('status') as ProjectStatus) || ''
  )
  const [page, setPage] = useState(1)

  const { data, loading, refetch } = useAsync(
    () => projectApi.list({ page, page_size: 20, search, status: status || undefined }),
    [page, search, status]
  )

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Projects</h1>
        {isAdmin && (
          <Link to="/projects/new" className="btn-primary">
            <PlusIcon className="w-4 h-4" /> New Project
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name, PO, client..."
            className="input pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatus(opt.value); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                status === opt.value
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>PO Number</th>
                <th>Client</th>
                <th>Status</th>
                <th>Delivery</th>
                <th>Revision</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.length === 0 && (
                <tr><td colSpan={isAdmin || isLayerTwo ? 10 : 8} className="text-center py-12 text-gray-400">No projects found</td></tr>
              )}
              {data?.data?.map((project) => (
                <tr
                  key={project.id}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <td className="font-medium text-brand-700">
                    {project.project_name}

                    {project.cover_image_url && (
                      <div
                        className="relative group w-8 h-8 rounded overflow-hidden mt-1 cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation() // Prevent row navigation
                          openPreview(project.cover_image_url!, 'Cover Image')
                        }}
                      >
                        <img
                          src={project.cover_image_url}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                          <PlusIcon className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="font-mono text-xs" title={project.po_number}>{project.po_number.length > 25 ? `${project.po_number.slice(0, 20)}...` : project.po_number}</td>
                  <td>{project.client_name}</td>
                  <td>
                    {project.active_task_status ? (
                      <ProjectBadge status={project.active_task_status as ProjectStatus} />
                    ) : (
                      <ProjectBadge status={project.status} />
                    )}
                  </td>
                  <td>{fmtDate(project.delivery_date)}</td>
                  <td>
                    <span className="badge-gray">v{project.current_revision}</span>
                    {project.active_department_name && (
                      <span className="badge-blue ml-2">{project.active_department_name}</span>
                    )}
                  </td>
                  <td className="text-gray-500">{fmtDate(project.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {data.total} projects total
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary btn-sm"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {page} of {data.total_pages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.total_pages}
              className="btn-secondary btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
