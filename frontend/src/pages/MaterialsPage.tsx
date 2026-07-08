import { useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import { materialApi } from '../services/api'
import { useAsync, useAsyncAction } from '../hooks/useAsync'
import { useAuth } from '../context/AuthContext'
import { fmtRelative } from '../utils/helpers'
import { MatBadge } from '../components/ui/StatusBadge'
import Modal from '../components/ui/Modal'
import toast from 'react-hot-toast'
import type { MaterialRequestStatus } from '../types'

interface ItemDraft { material_name: string; quantity: number; unit: string; description: string; estimated_cost: number }
const emptyItem = (): ItemDraft => ({ material_name: '', quantity: 1, unit: 'pcs', description: '', estimated_cost: 0 })

export default function MaterialsPage() {
  const { isLayerThree, isLayerTwo, isAdmin } = useAuth()
  const canCreate = isLayerThree || isLayerTwo
  const canReview = isLayerTwo || isAdmin

  const [status, setStatus] = useState<MaterialRequestStatus | ''>('')
  const [page, setPage] = useState(1)
  const { data, loading, refetch } = useAsync(
    () => materialApi.list({ page, page_size: 20, status: status || undefined }),
    [page, status]
  )

  const { execute, loading: actLoading } = useAsyncAction()

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ project_id: '', title: '', description: '' })
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()])

  // Review modal
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')

  const addItem = () => setItems((i) => [...i, emptyItem()])
  const removeItem = (idx: number) => setItems((i) => i.filter((_, j) => j !== idx))
  const updateItem = (idx: number, field: keyof ItemDraft, value: string | number) =>
    setItems((i) => i.map((item, j) => j === idx ? { ...item, [field]: value } : item))

  const handleCreate = async () => {
    if (!form.project_id || !form.title) { toast.error('Project ID and title required'); return }
    if (items.some((i) => !i.material_name)) { toast.error('All items need a name'); return }
    const ok = await execute(() => materialApi.create({ ...form, items }))
    if (ok !== null) {
      toast.success('Requisition submitted')
      setCreateOpen(false)
      setForm({ project_id: '', title: '', description: '' })
      setItems([emptyItem()])
      refetch()
    }
  }

  const handleReview = async (approve: boolean) => {
    if (!reviewId) return
    const ok = await execute(() => materialApi.review(reviewId, approve, reviewNotes))
    if (ok !== null) {
      toast.success(approve ? 'Approved' : 'Rejected')
      setReviewId(null); setReviewNotes('')
      refetch()
    }
  }

  const STATUS_OPTS: { label: string; value: MaterialRequestStatus | '' }[] = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Fulfilled', value: 'fulfilled' },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Material Requisitions</h1>
        {canCreate && (
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            <PlusIcon className="w-4 h-4" /> New Request
          </button>
        )}
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
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {data?.data?.length === 0 && (
            <div className="card p-8 text-center text-gray-400 text-sm">No requisitions</div>
          )}
          {data?.data?.map((mat) => (
            <div key={mat.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <MatBadge status={mat.status} />
                    <span className="text-sm font-semibold text-gray-900">{mat.title}</span>
                  </div>
                  {mat.description && <p className="text-xs text-gray-500 mb-1">{mat.description}</p>}
                  <p className="text-xs text-gray-400">
                    {mat.dept_name} · {mat.requested_by_name} · {fmtRelative(mat.created_at)}
                  </p>
                </div>
                {canReview && mat.status === 'pending' && (
                  <button onClick={() => setReviewId(mat.id)} className="btn-primary btn-sm flex-shrink-0">
                    Review
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Material Request" size="lg"
        footer={
          <>
            <button onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={actLoading} className="btn-primary">
              {actLoading ? 'Submitting...' : 'Submit Request'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Project ID <span className="text-red-500">*</span></label>
            <input value={form.project_id} onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
              className="input" placeholder="Paste project ID" />
          </div>
          <div>
            <label className="label">Request Title <span className="text-red-500">*</span></label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="input" placeholder="e.g. Wood materials for cabinet frames" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2} className="input resize-none" />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Materials <span className="text-red-500">*</span></label>
              <button onClick={addItem} className="btn-ghost btn-sm">+ Add Item</button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-2 items-start p-3 bg-gray-50 rounded-lg">
                  <div className="col-span-2">
                    <input value={item.material_name}
                      onChange={(e) => updateItem(idx, 'material_name', e.target.value)}
                      className="input text-xs" placeholder="Material name *" />
                  </div>
                  <div>
                    <input type="number" value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value))}
                      className="input text-xs" placeholder="Qty" min="0" step="0.01" />
                  </div>
                  <div>
                    <input value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                      className="input text-xs" placeholder="Unit (pcs, kg...)" />
                  </div>
                  <div className="flex items-center gap-1">
                    <input type="number" value={item.estimated_cost}
                      onChange={(e) => updateItem(idx, 'estimated_cost', parseFloat(e.target.value))}
                      className="input text-xs" placeholder="Cost" min="0" step="0.01" />
                    {items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600">×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Review Modal */}
      <Modal open={!!reviewId} onClose={() => setReviewId(null)} title="Review Requisition"
        footer={
          <>
            <button onClick={() => setReviewId(null)} className="btn-secondary">Cancel</button>
            <button onClick={() => handleReview(false)} disabled={actLoading} className="btn-danger">Reject</button>
            <button onClick={() => handleReview(true)} disabled={actLoading} className="btn-primary">Approve</button>
          </>
        }
      >
        <div>
          <label className="label">Review Notes</label>
          <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)}
            rows={3} className="input resize-none" placeholder="Optional notes..." />
        </div>
      </Modal>
    </div>
  )
}
