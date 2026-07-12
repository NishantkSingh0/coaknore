import { projectApi } from '../../services/api'
import { useAsync } from '../../hooks/useAsync'
import { fmtDateTime } from '../../utils/helpers'

export default function ProjectRevisionList({ projectId }: { projectId: string }) {
  const { data: revisions, loading } = useAsync(
    () => projectApi.getRevisions(projectId), [projectId]
  )

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!revisions?.length) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
        No revisions yet
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900 dark:text-white">
        Revision History
      </h3>

      {revisions.map((rev) => (
        <div key={rev.id} className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full flex items-center justify-center text-sm font-bold">
                  {rev.revision_number}
                </span>

                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Revision {rev.revision_number}
                  </p>

                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    By {rev.revised_by_name} · {fmtDateTime(rev.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {rev.routing_changed && (
                  <span className="badge-orange">Routing Changed</span>
                )}

                {rev.departments_reopened?.length > 0 && (
                  <span className="badge-yellow">
                    {rev.departments_reopened.length} depts reopened
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="card-body space-y-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Reason
              </p>

              <p className="text-gray-800 dark:text-gray-200">
                {rev.reason}
              </p>
            </div>

            {rev.client_request && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Client Request
                </p>

                <p className="text-gray-700 dark:text-gray-300">
                  {rev.client_request}
                </p>
              </div>
            )}

            {rev.updated_values && Object.keys(rev.updated_values).length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Changes
                </p>

                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                  <pre className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {JSON.stringify(rev.updated_values, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}