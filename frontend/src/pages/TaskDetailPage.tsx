import React, { useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  PlusIcon, PaperClipIcon, ExclamationCircleIcon,
  CheckCircleIcon, CalendarDaysIcon, LockClosedIcon, PhotoIcon,
} from '@heroicons/react/24/outline'
import { taskApi, issueApi, projectApi } from '../services/api'
import { useAsync, useAsyncAction } from '../hooks/useAsync'
import { useAuth } from '../context/AuthContext'
import { fmtDate, priorityColor, priorityLabel, issueTypeLabel } from '../utils/helpers'
import { TaskBadge } from '../components/ui/StatusBadge'
import type { TaskStatus, IssueType } from '../types'
import toast from 'react-hot-toast'
import Modal from '../components/ui/Modal'
import ConfirmationModal from '../components/ui/ConfirmationModal'
import clsx from 'clsx'
import { usePreviewModal } from '../hooks/usePreviewModal'


export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, isLayerTwo, isLayerThree, isAdmin } = useAuth()
  const canAct = isLayerThree || isLayerTwo || isAdmin
  const { data: task, loading, refetch } = useAsync(() => taskApi.getTask(id!), [id])
  const { execute, loading: actionLoading } = useAsyncAction()
  const { openPreview } = usePreviewModal()

  const { data: restrictedProject } = useAsync(
    () => (isLayerThree && task?.project_id ? projectApi.getRestricted(task.project_id) : Promise.resolve(null)),
    [task?.project_id, isLayerThree]
  )
  console.log(restrictedProject)

  // modals
  const [addSubtaskOpen, setAddSubtaskOpen] = useState(false)
  const [raiseIssueOpen, setRaiseIssueOpen] = useState(false)
  // expected completion (layer 3)
  const [expectedDate, setExpectedDate] = useState('')
  const [settingDate, setSettingDate] = useState(false)
  // subtask form
  const [newSubtask, setNewSubtask] = useState({ title: '', description: '', is_required: true })
  // issue form
  const [issueForm, setIssueForm] = useState({
    type: 'custom' as IssueType, title: '', description: '',
    material_description: '', required_quantity: '', material_unit: '', material_remarks: '',
  })
  const [issueImage, setIssueImage] = useState<File | null>(null)
  const issueFileRef = useRef<HTMLInputElement>(null)
  
  const [proofConfirm, setProofConfirm] = useState<{ subtaskId: string; file: File; previewUrl: string } | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleStatusChange = async (status: TaskStatus) => {
    const ok = await execute(() => taskApi.updateStatus(id!, status))
    if (ok !== null) { toast.success('Status updated'); refetch() }
    else toast.error('Failed to update status')
  }

  const handleAddSubtask = async () => {
    if (!newSubtask.title) { toast.error('Title is required'); return }
    const ok = await execute(() => taskApi.createSubtask(id!, newSubtask))
    if (ok !== null) {
      toast.success('Subtask added'); setAddSubtaskOpen(false)
      setNewSubtask({ title: '', description: '', is_required: true }); refetch()
    }
  }

  const handleProofSelected = (subtaskId: string, file: File) => {
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
    setProofConfirm({ subtaskId, file, previewUrl })
  }

  const handleConfirmProofUpload = async () => {
    if (!proofConfirm) return
    const { subtaskId, file, previewUrl } = proofConfirm
    setUploadingProof(true)
    try {
      const ok = await execute(() => taskApi.uploadSubtaskProof(subtaskId, file))
      if (ok !== null) {
        toast.success('Proof uploaded — subtask completed automatically')
        refetch()
        setProofConfirm(null)
      } else {
        toast.error('Upload failed')
      }
    } finally {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setUploadingProof(false)
    }
  }

  const handleProofUpload = async (subtaskId: string, file: File) => {
    const ok = await execute(() => taskApi.uploadSubtaskProof(subtaskId, file))
    if (ok !== null) { toast.success('Proof uploaded — subtask completed automatically'); refetch() }
    else toast.error('Upload failed')
  }

  const handleSetExpectedCompletion = async () => {
    if (!expectedDate) { toast.error('Please select a date'); return }
    setSettingDate(true)
    try {
      await taskApi.setExpectedCompletion(id!, expectedDate)
      toast.success('Expected completion date set — task is now In Progress'); refetch()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to set date')
    } finally { setSettingDate(false) }
  }

  const handleRaiseIssue = async () => {
    if (!issueForm.title || !issueForm.description) { toast.error('Title and description required'); return }
    const payload: Parameters<typeof issueApi.raise>[1] = {
      task_id: id, type: issueForm.type, title: issueForm.title, description: issueForm.description,
    }
    if (issueForm.type === 'material_missing') {
      Object.assign(payload, {
        material_description: issueForm.material_description,
        required_quantity: parseFloat(issueForm.required_quantity) || 0,
        material_unit: issueForm.material_unit,
        material_remarks: issueForm.material_remarks,
      })
    }
    const result = await execute(() => issueApi.raise(task!.project_id, payload))
    if (result !== null) {
      const issued = result as { id: string } | null
      if (issueImage && issued?.id) {
        try { await issueApi.uploadFile(issued.id, issueImage) } catch { /* non-fatal */ }
      }
      toast.success('Issue raised'); setRaiseIssueOpen(false)
      setIssueForm({ type: 'custom', title: '', description: '', material_description: '', required_quantity: '', material_unit: '', material_remarks: '' })
      setIssueImage(null); refetch()
    }
  }

  // ── loading / error states ─────────────────────────────────────────────────
  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!task) return <div className="text-center py-16 text-gray-400">Task not found</div>

  const completedCount = task.subtasks?.filter((s) => s.status === 'completed').length ?? 0
  const totalCount = task.subtasks?.length ?? 0
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  // cast restricted project to a typed helper
  const rp = restrictedProject as Record<string, string> | null

  // ── shared modal JSX (declared before any return, so both views can use them)
  const AddSubtaskModal = (
    <Modal open={addSubtaskOpen} onClose={() => setAddSubtaskOpen(false)} title="Add Subtask"
      footer={<>
        <button onClick={() => setAddSubtaskOpen(false)} className="btn-secondary">Cancel</button>
        <button onClick={handleAddSubtask} disabled={actionLoading} className="btn-primary">
          {actionLoading ? 'Adding...' : 'Add Subtask'}
        </button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className="label">Title <span className="text-red-500">*</span></label>
          <input value={newSubtask.title} onChange={(e) => setNewSubtask((s) => ({ ...s, title: e.target.value }))}
            className="input" placeholder="Subtask title" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea value={newSubtask.description}
            onChange={(e) => setNewSubtask((s) => ({ ...s, description: e.target.value }))}
            className="input resize-none" rows={3} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={newSubtask.is_required}
            onChange={(e) => setNewSubtask((s) => ({ ...s, is_required: e.target.checked }))}
            className="w-4 h-4 text-brand-600 rounded" />
          <span className="text-sm text-gray-700">Required for task completion</span>
        </label>
      </div>
    </Modal>
  )

  const IssueModal = (
    <Modal open={raiseIssueOpen} onClose={() => setRaiseIssueOpen(false)} title="Raise Issue"
      footer={<>
        <button onClick={() => setRaiseIssueOpen(false)} className="btn-secondary">Cancel</button>
        <button onClick={handleRaiseIssue} disabled={actionLoading} className="btn-danger">
          {actionLoading ? 'Raising...' : 'Raise Issue'}
        </button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className="label">Issue Type</label>
          <select value={issueForm.type}
            onChange={(e) => setIssueForm((f) => ({ ...f, type: e.target.value as IssueType }))}
            className="input">
            {Object.entries(issueTypeLabel).map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Title <span className="text-red-500">*</span></label>
          <input value={issueForm.title}
            onChange={(e) => setIssueForm((f) => ({ ...f, title: e.target.value }))} className="input" />
        </div>
        <div>
          <label className="label">Description <span className="text-red-500">*</span></label>
          <textarea value={issueForm.description}
            onChange={(e) => setIssueForm((f) => ({ ...f, description: e.target.value }))}
            rows={3} className="input resize-none" />
        </div>
        {issueForm.type === 'material_missing' && (
          <div className="space-y-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <p className="text-sm font-semibold text-orange-800">Material Requisition Details</p>
            <div>
              <label className="label">Department</label>
              <input value={task.department_name || ''} disabled className="input bg-gray-100 cursor-not-allowed" />
            </div>
            <div>
              <label className="label">Material Description <span className="text-red-500">*</span></label>
              <textarea value={issueForm.material_description}
                onChange={(e) => setIssueForm((f) => ({ ...f, material_description: e.target.value }))}
                rows={2} className="input resize-none" placeholder="Describe the required material..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Required Quantity</label>
                <input type="number" step="0.01" min="0" value={issueForm.required_quantity}
                  onChange={(e) => setIssueForm((f) => ({ ...f, required_quantity: e.target.value }))}
                  className="input" placeholder="e.g. 10" />
              </div>
              <div>
                <label className="label">Unit</label>
                <input value={issueForm.material_unit}
                  onChange={(e) => setIssueForm((f) => ({ ...f, material_unit: e.target.value }))}
                  className="input" placeholder="pcs, kg, m..." />
              </div>
            </div>
            <div>
              <label className="label">Remarks <span className="text-gray-400">(optional)</span></label>
              <input value={issueForm.material_remarks}
                onChange={(e) => setIssueForm((f) => ({ ...f, material_remarks: e.target.value }))}
                className="input" placeholder="Any additional notes..." />
            </div>
          </div>
        )}
        <div>
          <label className="label">Image Evidence <span className="text-gray-400">(optional)</span></label>
          {issueImage ? (
            <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
              <img src={URL.createObjectURL(issueImage)} alt="preview" className="w-12 h-12 object-cover rounded" />
              <span className="text-sm text-gray-700 flex-1 truncate">{issueImage.name}</span>
              <button onClick={() => setIssueImage(null)} className="text-red-500 text-xs">Remove</button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors">
              <PhotoIcon className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">Click to attach image</span>
              <input ref={issueFileRef} type="file" accept="image/*,.pdf" className="hidden"
                onChange={(e) => e.target.files?.[0] && setIssueImage(e.target.files[0])} />
            </label>
          )}
        </div>
      </div>
    </Modal>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* ── Drawing Preview (Level 3) ───────────────────────────────────────────── */}
      {isLayerThree && rp?.drawing_url && task && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">{task.project_name}</h3>
            </div>
          </div>
          <div 
            className="relative group bg-gray-50 rounded-lg overflow-hidden cursor-pointer"
            onClick={() => openPreview(rp.drawing_url!, rp.drawing_name || 'Project Drawing')}
          >
            <img
              src={rp.drawing_url}
              alt={rp.drawing_name || 'Project Drawing'}
              className="w-full h-auto max-h-96 object-contain transition-transform duration-300 group-hover:scale-[1.02]"
              onError={(e) => {
                e.currentTarget.parentElement?.style.setProperty('display', 'none')
              }}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
              <PlusIcon className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>
      )}


      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isLayerThree ? (
              <span className="text-sm text-gray-500">{task.project_name}</span>
            ) : (
              <Link to={`/projects/${task.project_id}`} className="text-sm text-gray-500 hover:text-gray-700">
                {task.project_name}
              </Link>
            )}
            <span className="text-gray-400">/</span>
            <h1 className="text-xl font-bold text-gray-900">{task.title || 'Task'}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>{task.department_name}</span>
            <TaskBadge status={task.status} />
          </div>
        </div>
        {canAct && (
          <div className="flex gap-2">
            <button onClick={() => setAddSubtaskOpen(true)} className="btn-secondary flex items-center gap-1">
              <PlusIcon className="w-4 h-4" /> Add Subtask
            </button>
            <button onClick={() => setRaiseIssueOpen(true)} className="btn-danger flex items-center gap-1">
              <ExclamationCircleIcon className="w-4 h-4" /> Raise Issue
            </button>
          </div>
        )}
      </div>

      {/* ── Progress ──────────────────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Subtask Progress</span>
          <span className="text-sm text-gray-500">{completedCount}/{totalCount} completed</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* ── Expected Completion Date (Layer 3) ─────────────────────────────────── */}
      {isLayerThree && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Expected Completion Date</p>
              {task.expected_completion_date && (
                <p className="text-sm text-gray-500 mt-1">{fmtDate(task.expected_completion_date)}</p>
              )}
            </div>
            {task.completion_date_locked ? (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <LockClosedIcon className="w-3 h-3" /> Locked
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="input"
                />
                <button
                  onClick={handleSetExpectedCompletion}
                  disabled={settingDate || !expectedDate}
                  className="btn-primary"
                >
                  {settingDate ? 'Setting...' : 'Set Date'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Project Info (Layer 3) ───────────────────────────────────────────────── */}
      {isLayerThree && rp && (
        <div className="card p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Project Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">PO Number</p>
              <p className="text-sm font-medium text-gray-900">{rp.po_number || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Routed Date</p>
              <p className="text-sm font-medium text-gray-900">{rp.routed_to_dept_at ? fmtDate(rp.routed_to_dept_at) : 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Expected Completion</p>
              <p className="text-sm font-medium text-gray-900">{rp.expected_completion_date ? fmtDate(rp.expected_completion_date) : 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Completion Locked</p>
              <p className="text-sm font-medium text-gray-900">
                {rp.completion_date_locked ? (
                  <span className="flex items-center gap-1">
                    <LockClosedIcon className="w-3 h-3" /> Yes
                  </span>
                ) : 'No'}
              </p>
            </div>
          </div>
          {rp.render_files_url && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => openPreview(rp.render_files_url!, 'Render Files')}
                className="text-sm text-brand-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <PaperClipIcon className="w-4 h-4" /> View Render Files
              </button>
            </div>
          )}
          {rp.drawing_url && (
            <div className="mt-2">
              <p className="text-xs text-gray-500">Drawing File</p>
              <button
                type="button"
                onClick={() => openPreview(rp.drawing_url!, rp.drawing_name || 'Drawing File')}
                className="text-sm text-brand-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <PaperClipIcon className="w-4 h-4" /> {rp.drawing_name || 'View Drawing'}
              </button>
            </div>
          )}

        </div>
      )}

      {/* ── Subtasks ──────────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Subtasks</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {task.subtasks?.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No subtasks yet</div>
          ) : (
            task.subtasks?.map((subtask) => (
              <div key={subtask.id} className="p-4 flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {subtask.status === 'completed' ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                    )}
                    <span className={`font-medium ${subtask.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {subtask.title}
                    </span>
                    {subtask.is_required && <span className="text-xs text-red-500">*</span>}
                  </div>
                  {subtask.description && (
                    <p className="text-sm text-gray-500 mt-1">{subtask.description}</p>
                  )}
                  {subtask.files && subtask.files.length > 0 && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {subtask.files.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => openPreview(file.s3_url, file.original_name)}
                          className="text-xs text-brand-600 hover:underline flex items-center gap-1 cursor-pointer text-left"
                        >
                          <PaperClipIcon className="w-3 h-3 flex-shrink-0" /> <span className="truncate max-w-[150px]">{file.original_name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                </div>
                {subtask.status !== 'completed' && canAct && (
                  <label className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-brand-50 text-brand-700 rounded-lg hover:bg-brand-100 transition-colors">
                    <PhotoIcon className="w-4 h-4" />
                    <span className="text-sm">Upload Proof</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleProofSelected(subtask.id, e.target.files[0])}
                    />
                  </label>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {AddSubtaskModal}
      {IssueModal}

      {proofConfirm && (
        <ConfirmationModal
          open={!!proofConfirm}
          onClose={() => {
            if (proofConfirm.previewUrl) URL.revokeObjectURL(proofConfirm.previewUrl)
            setProofConfirm(null)
          }}
          onConfirm={handleConfirmProofUpload}
          title="Submit Subtask Proof"
          message="Are you sure you want to submit this proof? Once submitted, the subtask will be marked as completed automatically."
          confirmText="Submit"
          type="info"
          loading={uploadingProof}
        >
          {proofConfirm.previewUrl ? (
            <div className="mt-2 border rounded-xl overflow-hidden max-h-60 flex items-center justify-center bg-gray-50 p-2">
              <img
                src={proofConfirm.previewUrl}
                alt="Proof Preview"
                className="max-h-56 object-contain rounded-lg shadow-sm"
              />
            </div>
          ) : (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg border flex items-center gap-2">
              <PaperClipIcon className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 truncate">
                {proofConfirm.file.name}
              </span>
            </div>
          )}
        </ConfirmationModal>
      )}
    </div>
  )
}
