import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getIssues, approveIssue, rejectIssue } from '../../api/issues'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Spinner } from '../../components/common/Spinner'
import { EmptyState } from '../../components/common/EmptyState'
import { formatDate } from '../../utils'
import toast from 'react-hot-toast'

export const IssuesPage: React.FC = () => {
  const qc = useQueryClient()
  const { data: issues = [], isLoading } = useQuery({ queryKey: ['issues'], queryFn: getIssues })

  const approveMutation = useMutation({
    mutationFn: approveIssue,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['issues'] }); toast.success('Issue approved') },
    onError: () => toast.error('Failed to approve'),
  })

  const rejectMutation = useMutation({
    mutationFn: rejectIssue,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['issues'] }); toast.success('Issue rejected') },
    onError: () => toast.error('Failed to reject'),
  })

  const pending = issues.filter(i => i.status === 'pending_approval' || i.status === 'open')
  const others  = issues.filter(i => i.status !== 'pending_approval' && i.status !== 'open')

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Issues</h2>

      {issues.length === 0 ? (
        <EmptyState title="No issues" description="Issues raised by departments will appear here." />
      ) : (
        <>
          {pending.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
                Awaiting Approval ({pending.length})
              </h3>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 border-b border-amber-100">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Raised</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pending.map(issue => (
                      <tr key={issue.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 capitalize text-gray-800 font-medium">
                          {issue.issue_type.replace(/_/g, ' ')}
                        </td>
                        <td className="px-5 py-3 text-gray-600 font-mono text-xs">{issue.project_id.slice(0, 8)}</td>
                        <td className="px-5 py-3"><Badge status={issue.status} variant="issue" /></td>
                        <td className="px-5 py-3 text-gray-600 max-w-xs truncate">
                          {issue.description ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-gray-500">{formatDate(issue.created_at)}</td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm" variant="primary"
                              loading={approveMutation.isPending}
                              onClick={() => approveMutation.mutate(issue.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm" variant="outline"
                              loading={rejectMutation.isPending}
                              onClick={() => rejectMutation.mutate(issue.id)}
                            >
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">History</h3>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Raised</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {others.map(issue => (
                      <tr key={issue.id} className="hover:bg-gray-50 opacity-75">
                        <td className="px-5 py-3 capitalize">{issue.issue_type.replace(/_/g, ' ')}</td>
                        <td className="px-5 py-3"><Badge status={issue.status} variant="issue" /></td>
                        <td className="px-5 py-3 text-gray-500 max-w-xs truncate">{issue.description ?? '—'}</td>
                        <td className="px-5 py-3 text-gray-400">{formatDate(issue.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
