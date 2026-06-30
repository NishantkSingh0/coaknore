import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getIssues, closeIssue } from '../../api/issues'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Spinner } from '../../components/common/Spinner'
import { EmptyState } from '../../components/common/EmptyState'
import { formatDate } from '../../utils'
import toast from 'react-hot-toast'

export const DeptIssuesPage: React.FC = () => {
  const qc = useQueryClient()
  const { data: issues = [], isLoading } = useQuery({ queryKey: ['issues'], queryFn: getIssues })

  const closeMutation = useMutation({
    mutationFn: closeIssue,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['issues'] }); toast.success('Issue closed') },
    onError: (err: any) => toast.error(err.response?.data?.error?.message ?? 'Failed'),
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">My Department Issues</h2>
      {issues.length === 0 ? (
        <EmptyState title="No issues" description="Issues you raise will appear here." />
      ) : (
        <div className="space-y-3">
          {issues.map(issue => (
            <div key={issue.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold capitalize text-gray-900">
                    {issue.issue_type.replace(/_/g, ' ')}
                  </span>
                  <Badge status={issue.status} variant="issue" />
                </div>
                {issue.description && (
                  <p className="text-sm text-gray-600 truncate">{issue.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">Raised {formatDate(issue.created_at)}</p>
              </div>
              {(issue.status === 'approved') && (
                <Button
                  size="sm" variant="outline"
                  onClick={() => closeMutation.mutate(issue.id)}
                  loading={closeMutation.isPending}
                >
                  Mark Resolved & Close
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
