import { useState } from 'react'
import { projectApi } from '../../services/api'
import { useAsync } from '../../hooks/useAsync'
import { fmtDateTime } from '../../utils/helpers'

export default function ProjectTimeline({ projectId }: { projectId: string }) {
  const [page, setPage] = useState(1)
  const { data, loading } = useAsync(
    () => projectApi.getTimeline(projectId, { page, page_size: 20 }),
    [projectId, page]
  )

  const actionColors: Record<string, string> = {
    created: 'bg-green-100 text-green-700',
    updated: 'bg-blue-100 text-blue-700',
    status_changed: 'bg-purple-100 text-purple-700',
    completed: 'bg-green-100 text-green-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    resolved: 'bg-teal-100 text-teal-700',
    file_uploaded: 'bg-gray-100 text-gray-700',
    routing_published: 'bg-brand-100 text-brand-700',
    revision_created: 'bg-orange-100 text-orange-700',
    assigned: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Project Timeline</h3>
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
        <div className="space-y-3">
          {data?.data?.map((log) => (
            <div key={log.id} className="relative pl-10">
              <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-white ${
                actionColors[log.action]?.includes('green') ? 'bg-green-500' :
                actionColors[log.action]?.includes('red') ? 'bg-red-500' :
                actionColors[log.action]?.includes('orange') ? 'bg-orange-500' :
                actionColors[log.action]?.includes('brand') ? 'bg-brand-500' :
                'bg-gray-400'
              }`} />
              <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${actionColors[log.action] || 'bg-gray-100 text-gray-600'}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-medium text-gray-700 truncate">
                        {log.entity_type} {log.entity_name ? `— ${log.entity_name}` : ''}
                      </span>
                    </div>
                    {log.actor_name && (
                      <p className="text-xs text-gray-500 mt-1">by {log.actor_name}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {fmtDateTime(log.created_at)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary btn-sm">
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {data.total_pages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.total_pages} className="btn-secondary btn-sm">
            Next
          </button>
        </div>
      )}

      {data?.data?.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">No timeline events yet</div>
      )}
    </div>
  )
}
