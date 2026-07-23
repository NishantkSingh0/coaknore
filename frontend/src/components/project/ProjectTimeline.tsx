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
    created: 'bg-green-100 text-green-700 dark:bg-green-700/40 dark:text-green-300',
    updated: 'bg-blue-100 text-blue-700 dark:bg-blue-700/40 dark:text-blue-300',
    status_changed: 'bg-purple-100 text-purple-700 dark:bg-purple-700/40 dark:text-purple-300',
    completed: 'bg-green-100 text-green-700 dark:bg-green-700/40 dark:text-green-300',
    approved: 'bg-green-100 text-green-700 dark:bg-green-700/40 dark:text-green-300',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-700/40 dark:text-red-300',
    resolved: 'bg-teal-100 text-teal-700 dark:bg-teal-700/40 dark:text-teal-300',
    file_uploaded: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    routing_published: 'bg-brand-100 text-brand-700 dark:bg-brand-700/40 dark:text-brand-300',
    revision_created: 'bg-orange-100 text-orange-700 dark:bg-orange-700/40 dark:text-orange-300',
    assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-700/40 dark:text-blue-300',
    date_changed: 'bg-amber-100 text-amber-700 dark:bg-amber-700/40 dark:text-amber-300',
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Project Timeline</h3>
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-3">
          {data?.data?.map((log) => (
            <div key={log.id} className="relative pl-10">
              <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${
                actionColors[log.action]?.includes('green') ? 'bg-green-500' :
                actionColors[log.action]?.includes('red') ? 'bg-red-500' :
                actionColors[log.action]?.includes('orange') ? 'bg-orange-500' :
                actionColors[log.action]?.includes('brand') ? 'bg-brand-500' :
                actionColors[log.action]?.includes('blue') ? 'bg-blue-500' :
                actionColors[log.action]?.includes('purple') ? 'bg-purple-500' :
                actionColors[log.action]?.includes('teal') ? 'bg-teal-500' :
                'bg-gray-400'
              }`} />
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm text-gray-900 dark:text-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${actionColors[log.action] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                        {log.entity_type} {log.entity_name ? `— ${log.entity_name}` : ''}
                      </span>
                    </div>
                    {log.metadata?.change_type === 'date_change' && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Changed date from {String(log.metadata.old_date || 'Not set')} to {String(log.metadata.new_date)}
                      </p>
                    )}
                    {log.actor_name && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">by {log.actor_name}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
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
          <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {data.total_pages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.total_pages} className="btn-secondary btn-sm">
            Next
          </button>
        </div>
      )}

      {data?.data?.length === 0 && (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">No timeline events yet</div>
      )}
    </div>
  )
}