import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { issueApi } from '../services/api'
import { useAsync, useAsyncAction } from '../hooks/useAsync'
import { useAuth } from '../context/AuthContext'
import { fmtDateTime, issueTypeLabel } from '../utils/helpers'
import { IssueBadge } from '../components/ui/StatusBadge'
import Modal from '../components/ui/Modal'
import toast from 'react-hot-toast'

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isLayerTwo, isAdmin, isLayerThree } = useAuth()
  const { data: issue, loading, refetch } = useAsync(() => issueApi.get(id!), [id])
  const { execute, loading: actLoading } = useAsyncAction()

  const [reviewOpen, setReviewOpen] = useState(false)
  const [resolveOpen, setResolveOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [approve, setApprove] = useState(true)

  const handleReview = async () => {
    const ok = await execute(() => issueApi.review(id!, approve, notes))
    if (ok !== null) {
      toast.success(approve ? 'Issue approved' : 'Issue rejected')
      setReviewOpen(false)
      setNotes('')
      refetch()
    }
  }

  const handleResolve = async () => {
    const ok = await execute(() => issueApi.resolve(id!, notes))
    if (ok !== null) {
      toast.success('Issue resolved')
      setResolveOpen(false)
      setNotes('')
      refetch()
    }
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
  if (!issue) return <div className="text-center py-16 text-gray-400">Issue not found</div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link to="/issues" className="text-sm text-brand-600 hover:underline">← Issues</Link>
            <IssueBadge status={issue.status} />
            <span className="badge-gray text-xs">{issueTypeLabel[issue.type]}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{issue.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {issue.department_name} · Raised by {issue.raised_by_name} · {fmtDateTime(issue.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {(isLayerTwo || isAdmin) && (issue.status === 'open' || issue.status === 'pending_approval') && (
            <button onClick={() => setReviewOpen(true)} className="btn-primary btn-sm">
              Review
            </button>
          )}
          {isLayerThree && issue.status === 'approved' && (
            <button onClick={() => setResolveOpen(true)} className="btn-primary btn-sm">
              Mark Resolved
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Description</h3></div>
        <div className="card-body">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{issue.description}</p>
        </div>
      </div>

      {/* Review info */}
      {issue.reviewed_by && (
        <div className="card border-l-4 border-l-blue-500">
          <div className="card-body">
            <p className="text-xs font-semibold text-gray-500 mb-1">
              {issue.status === 'approved' ? '✅ Approved' : '❌ Rejected'} by {issue.reviewed_by_name}
            </p>
            {issue.review_notes && <p className="text-sm text-gray-700">{issue.review_notes}</p>}
            <p className="text-xs text-gray-400 mt-1">{fmtDateTime(issue.reviewed_at)}</p>
          </div>
        </div>
      )}

      {/* Resolution info */}
      {issue.resolved_by && (
        <div className="card border-l-4 border-l-green-500">
          <div className="card-body">
            <p className="text-xs font-semibold text-gray-500 mb-1">✅ Resolved by {issue.resolved_by_name}</p>
            {issue.resolution_notes && <p className="text-sm text-gray-700">{issue.resolution_notes}</p>}
            <p className="text-xs text-gray-400 mt-1">{fmtDateTime(issue.resolved_at)}</p>
          </div>
        </div>
      )}

      {/* Files */}
      {issue.files && issue.files.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Attachments</h3></div>
          <div className="card-body flex flex-wrap gap-2">
            {issue.files.map((f) => (
              <a key={f.id} href={f.s3_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-brand-300">
                📎 {f.original_name}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Review Modal */}
      <Modal open={reviewOpen} onClose={() => setReviewOpen(false)} title="Review Issue"
        footer={
          <>
            <button onClick={() => setReviewOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleReview} disabled={actLoading}
              className={approve ? 'btn-primary' : 'btn-danger'}>
              {actLoading ? 'Saving...' : approve ? 'Approve' : 'Reject'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            {[true, false].map((val) => (
              <button key={String(val)} onClick={() => setApprove(val)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  approve === val
                    ? val ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}>
                {val ? 'Approve' : 'Reject'}
              </button>
            ))}
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={3} className="input resize-none" placeholder="Optional notes..." />
          </div>
        </div>
      </Modal>

      {/* Resolve Modal */}
      <Modal open={resolveOpen} onClose={() => setResolveOpen(false)} title="Resolve Issue"
        footer={
          <>
            <button onClick={() => setResolveOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleResolve} disabled={actLoading} className="btn-primary">
              {actLoading ? 'Resolving...' : 'Mark Resolved'}
            </button>
          </>
        }
      >
        <div>
          <label className="label">Resolution Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={4} className="input resize-none" placeholder="Describe how the issue was resolved..." />
        </div>
      </Modal>
    </div>
  )
}
