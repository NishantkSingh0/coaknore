import { useState } from 'react'
import { reworkApi } from '../services/api'
import { useAsync, useAsyncAction } from '../hooks/useAsync'
import { useAuth } from '../context/AuthContext'
import { fmtRelative } from '../utils/helpers'
import { ReworkBadge } from '../components/ui/StatusBadge'
import Modal from '../components/ui/Modal'
import toast from 'react-hot-toast'
import type { ReworkStatus } from '../types'

export default function ReworksPage() {
  const { isLayerTwo, isAdmin } = useAuth()
  const [status, setStatus] = useState<ReworkStatus | ''>('')
  const [page, setPage] = useState(1)
  const { data, loading, refetch } = useAsync(
    () => reworkApi.list({ page, page_size: 20, status: status || undefined }),
    [page, status]
  )

  const { execute, loading: actLoading } = useAsyncAction()
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [notes, setNotes] = useState('')

  const handleApprove = async () => {
    if (!reviewId) return
    const ok = await execute(() => reworkApi.approve(reviewId, { notes }))
    if (ok !== null) {
      toast.success('Rework approved — new routing created')
      setReviewId(null); setNotes('')
      refetch()
    }
  }
  const handleReject = async () => {
    if (!reviewId) return
    const ok = await execute(() => reworkApi.reject(reviewId, notes))
    if (ok !== null) {
      toast.success('Rework rejected')
      setReviewId(null); setNotes('')
      refetch()
    }
  }

  const STATUS_OPTS: { label: string; value: ReworkStatus | '' }[] = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Completed', value: 'completed' },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Rework Requests</h1>
      </div>

      <div className="card p-4 flex flex-wrap gap-2">
        {STATUS_OPTS.map((opt) => (
          <button key={opt.value}
            onClick={() => { setStatus(opt.value); setPage(1) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              status === opt.value ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {data?.data?.length === 0 && (
            <div className="card p-8 text-center text-gray-400 text-sm">No rework requests</div>
          )}
          {data?.data?.map((rework) => (
            <div key={rework.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <ReworkBadge status={rework.status} />
                    <span className="text-xs text-gray-500">
                      {rework.requesting_dept_name} → {rework.target_dept_name}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{rework.reason}</p>
                  {rework.description && (
                    <p className="text-xs text-gray-500 mt-1">{rework.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    By {rework.requested_by_name} · {fmtRelative(rework.created_at)}
                  </p>
                  {rework.review_notes && (
                    <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1">
                      Note: {rework.review_notes}
                    </p>
                  )}
                </div>
                {(isLayerTwo || isAdmin) && rework.status === 'pending' && (
                  <button
                    onClick={() => setReviewId(rework.id)}
                    className="btn-primary btn-sm flex-shrink-0"
                  >
                    Review
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!reviewId} onClose={() => setReviewId(null)} title="Review Rework Request"
        footer={
          <>
            <button onClick={() => setReviewId(null)} className="btn-secondary">Cancel</button>
            <button onClick={() => { setApproving(false); handleReject() }}
              disabled={actLoading} className="btn-danger">Reject</button>
            <button onClick={() => { setApproving(true); handleApprove() }}
              disabled={actLoading} className="btn-primary">Approve & Create Routing</button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Approving will create a new routing version that sends work back to the target department.
          </p>
          <div>
            <label className="label">Review Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={3} className="input resize-none" placeholder="Optional notes..." />
          </div>
        </div>
      </Modal>
    </div>
  )
}
