import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { issueApi } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { fmtRelative, issueTypeLabel } from '../utils/helpers'
import { IssueBadge } from '../components/ui/StatusBadge'
import type { IssueStatus } from '../types'

const STATUS_OPTS: { label: string; value: IssueStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'Pending Approval', value: 'pending_approval' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
]

export default function IssuesPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<IssueStatus | ''>('')
  const [page, setPage] = useState(1)

  const { data, loading } = useAsync(
    () => issueApi.list({ page, page_size: 20, status: status || undefined }),
    [page, status]
  )

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Issues</h1>
      </div>

      <div className="card p-4 flex flex-wrap gap-2">
        {STATUS_OPTS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setStatus(opt.value); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              status === opt.value ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data?.data || data.data.length === 0 ? (
          <div className="card p-8 text-center text-gray-400 text-sm">
            No issues found
          </div>
        )  : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Type</th>
                <th>Department</th>
                <th>Raised By</th>
                <th>Status</th>
                <th>Raised</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No issues found</td></tr>
              )}
              {data?.data?.map((issue) => (
                <tr
                  key={issue.id}
                  onClick={() => navigate(`/issues/${issue.id}`)}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td>
                    <span className="font-medium text-brand-700 dark:text-brand-400">
                      {issue.title}
                    </span>
                  </td>

                  <td>
                    <span className="badge-gray text-xs">
                      {issueTypeLabel[issue.type]}
                    </span>
                  </td>

                  <td>{issue.department_name}</td>
                  <td>{issue.raised_by_name}</td>
                  <td><IssueBadge status={issue.status} /></td>
                  <td className="text-gray-500">{fmtRelative(issue.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{data.total} issues</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary btn-sm">Previous</button>
            <span className="text-sm text-gray-700">Page {page} of {data.total_pages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.total_pages} className="btn-secondary btn-sm">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
