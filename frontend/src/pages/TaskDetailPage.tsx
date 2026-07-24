import React, { useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  PlusIcon, PaperClipIcon, ExclamationCircleIcon,
  CheckCircleIcon, CalendarDaysIcon, LockClosedIcon, PhotoIcon,
} from '@heroicons/react/24/outline'
import { taskApi, issueApi, projectApi, orgApi } from '../services/api'
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
import { matchDepartmentToSubtasks } from '../utils/predefinedSubtasks'


export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, isLayerTwo, isLayerThree, isAdmin } = useAuth()
  const canAct = isLayerThree || isLayerTwo || isAdmin
  const isUpcoming = new URLSearchParams(location.search).get('mode') === 'upcoming'
  const { data: task, loading, refetch } = useAsync(() => taskApi.getTask(id!), [id])
  const { data: departments } = useAsync(() => orgApi.listDepartments('layer3'), [])
  const { execute, loading: actionLoading } = useAsyncAction()
  const { openPreview } = usePreviewModal()

  const { data: restrictedProject } = useAsync(
    () => (isLayerThree && task?.project_id ? projectApi.getRestricted(task.project_id) : Promise.resolve(null)),
    [task?.project_id, isLayerThree]
  )
  // console.log('Task routing_is_latest:', task?.routing_is_latest)

  // modals
  const [addSubtaskOpen, setAddSubtaskOpen] = useState(false)
  const [raiseIssueOpen, setRaiseIssueOpen] = useState(false)
  // expected completion (layer 3)
  const [expectedDate, setExpectedDate] = useState('')
  const [settingDate, setSettingDate] = useState(false)
  // subtask form
  const [selectedPredefinedTasks, setSelectedPredefinedTasks] = useState<string[]>([])
  // issue form
  const [issueForm, setIssueForm] = useState({
    type: 'custom' as IssueType, title: '', description: '',
    assigned_to_dept_id: '',
    material_name: '', material_description: '', required_quantity: '', material_unit: '', material_remarks: '',
  })
  const [issueImage, setIssueImage] = useState<File | null>(null)
  const issueFileRef = useRef<HTMLInputElement>(null)
  
  const [proofConfirm, setProofConfirm] = useState<{ subtaskId: string; file: File; previewUrl: string } | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [dateChangeConfirm, setDateChangeConfirm] = useState<{ oldDate: string; newDate: string } | null>(null)

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleStatusChange = async (status: TaskStatus) => {
    const ok = await execute(() => taskApi.updateStatus(id!, status))
    if (ok !== null) { toast.success('Status updated'); refetch() }
    else toast.error('Failed to update status')
  }

  const handleAddSubtask = async () => {
    if (selectedPredefinedTasks.length === 0) { toast.error('Please select at least one subtask'); return }
    
    const predefinedTasksList = task?.department_name ? matchDepartmentToSubtasks(task.department_name) : []
    // Create tasks in the order they were selected
    const tasksToCreate = selectedPredefinedTasks.map(title => 
      predefinedTasksList.find(task => task.title === title)
    ).filter((task): task is NonNullable<typeof task> => task !== undefined)
    
    let successCount = 0
    for (const taskData of tasksToCreate) {
      const ok = await execute(() => taskApi.createSubtask(id!, {
        title: taskData.title,
        description: taskData.description,
        is_required: true
      }))
      if (ok !== null) successCount++
    }
    
    if (successCount === tasksToCreate.length) {
      toast.success(`${successCount} subtask(s) added successfully`)
      setAddSubtaskOpen(false)
      setSelectedPredefinedTasks([])
      refetch()
    } else if (successCount > 0) {
      toast.success(`${successCount} of ${tasksToCreate.length} subtask(s) added`)
      setAddSubtaskOpen(false)
      setSelectedPredefinedTasks([])
      refetch()
    } else {
      toast.error('Failed to add subtasks')
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
        toast.success('Proof uploaded, subtask completed automatically')
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
    if (ok !== null) { toast.success('Proof uploaded, subtask completed automatically'); refetch() }
    else toast.error('Upload failed')
  }

  const handleSetExpectedCompletion = async () => {
    if (!expectedDate) { toast.error('Please select a date'); return }
    
    // For Level1/Level2, show confirmation popup
    if (!isLayerThree) {
      const oldDate = task?.expected_completion_date ? fmtDate(task.expected_completion_date) : 'Not set'
      setDateChangeConfirm({ oldDate, newDate: expectedDate })
      return
    }
    
    // For Layer3, proceed directly
    await executeDateChange(expectedDate)
  }

  const executeDateChange = async (date: string) => {
    setSettingDate(true)
    try {
      await taskApi.setExpectedCompletion(id!, date)
      toast.success('Expected completion date set, task is now In Progress')
      refetch()
      setDateChangeConfirm(null)
      setExpectedDate('')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to set date')
    } finally { setSettingDate(false) }
  }

  const handleRaiseIssue = async () => {
    if (!issueForm.title || !issueForm.description) { toast.error('Title and description required'); return }
    if (issueForm.type === 'rework_required' && !issueForm.assigned_to_dept_id) {
      toast.error('Please select the department that needs rework')
      return
    }
    if (issueForm.type === 'material_missing' && (!issueForm.material_name || !issueForm.required_quantity || !issueForm.material_unit)) {
      toast.error('Material name, quantity, and unit are required')
      return
    }
    const payload: Parameters<typeof issueApi.raise>[1] = {
      task_id: id, type: issueForm.type, title: issueForm.title, description: issueForm.description,
    }
    if (issueForm.type === 'rework_required') {
      payload.assigned_to_dept_id = issueForm.assigned_to_dept_id
    }
    if (issueForm.type === 'material_missing') {
      Object.assign(payload, {
        material_name: issueForm.material_name,
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
      setIssueForm({ type: 'custom', title: '', description: '', assigned_to_dept_id: '', material_name: '', material_description: '', required_quantity: '', material_unit: '', material_remarks: '' })
      setIssueImage(null); refetch()
    }
  }

  // ── loading / error states ─────────────────────────────────────────────────
  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!task) return <div className="text-center py-16 text-gray-400 dark:text-gray-500">Task not found</div>

  const completedCount = task.subtasks?.filter((s) => s.status === 'completed').length ?? 0
  const totalCount = task.subtasks?.length ?? 0
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  // cast restricted project to a typed helper
  const rp = restrictedProject as Record<string, string> | null

  // ── shared modal JSX (declared before any return, so both views can use them)
  const predefinedTasks = task?.department_name ? matchDepartmentToSubtasks(task.department_name) || [] : []
  
  const toggleTaskSelection = (taskTitle: string) => {
    if (selectedPredefinedTasks.includes(taskTitle)) {
      setSelectedPredefinedTasks(selectedPredefinedTasks.filter(t => t !== taskTitle))
    } else {
      setSelectedPredefinedTasks([...selectedPredefinedTasks, taskTitle])
    }
  }
  
  const AddSubtaskModal = (
    <Modal open={addSubtaskOpen} onClose={() => { setAddSubtaskOpen(false); setSelectedPredefinedTasks([]); }} title="Add Subtasks"
      footer={<>
        <button onClick={() => { setAddSubtaskOpen(false); setSelectedPredefinedTasks([]); }} className="btn-secondary">Cancel</button>
        <button onClick={handleAddSubtask} disabled={actionLoading || selectedPredefinedTasks.length === 0} className="btn-primary">
          {actionLoading ? 'Adding...' : `Add ${selectedPredefinedTasks.length} Subtask${selectedPredefinedTasks.length !== 1 ? 's' : ''}`}
        </button>
      </>}>
      <div className="space-y-4">
        {predefinedTasks.length > 0 ? (
          <div>
            <label className="label dark:text-gray-300 mb-3 block">Select Steps to Add <span className="text-red-500 dark:text-red-400">*</span></label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {predefinedTasks.map((task) => (
                <label key={task.title} className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedPredefinedTasks.includes(task.title)}
                    onChange={() => toggleTaskSelection(task.title)}
                    className="w-4 h-4 text-brand-600 rounded mt-0.5 dark:bg-gray-800 dark:border-gray-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{task.title}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{task.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No predefined subtasks available for this department
          </div>
        )}
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
          <label className="label dark:text-gray-300">Issue Type</label>
          <select value={issueForm.type}
            onChange={(e) => setIssueForm((f) => ({ ...f, type: e.target.value as IssueType }))}
            className="input dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100">
            {Object.entries(issueTypeLabel).map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
          </select>
        </div>
        {issueForm.type === 'rework_required' && (
          <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Rework Details</p>
            <div>
              <label className="label dark:text-gray-300">Department to Rework <span className="text-red-500 dark:text-red-400">*</span></label>
              <select
                value={issueForm.assigned_to_dept_id}
                onChange={(e) => setIssueForm((f) => ({ ...f, assigned_to_dept_id: e.target.value }))}
                className="input dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
              >
                <option value="">Select department</option>
                {departments?.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div>
          <label className="label dark:text-gray-300">Title <span className="text-red-500 dark:text-red-400">*</span></label>
          <input value={issueForm.title}
            onChange={(e) => setIssueForm((f) => ({ ...f, title: e.target.value }))} className="input dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500" />
        </div>
        <div>
          <label className="label dark:text-gray-300">Description <span className="text-red-500 dark:text-red-400">*</span></label>
          <textarea value={issueForm.description}
            onChange={(e) => setIssueForm((f) => ({ ...f, description: e.target.value }))}
            rows={3} className="input resize-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500" />
        </div>
        {issueForm.type === 'material_missing' && (
          <div className="space-y-3 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
            <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Material Requisition Details</p>
            <div>
              <label className="label dark:text-gray-300">Department</label>
              <input value={task.department_name || ''} disabled className="input bg-gray-100 dark:bg-gray-700 dark:border-gray-700 dark:text-gray-300 cursor-not-allowed" />
            </div>
            <div>
              <label className="label dark:text-gray-300">Item Name <span className="text-red-500 dark:text-red-400">*</span></label>
              <input value={issueForm.material_name}
                onChange={(e) => setIssueForm((f) => ({ ...f, material_name: e.target.value }))}
                className="input dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Material or item name" />
            </div>
            <div>
              <label className="label dark:text-gray-300">Material Description</label>
              <textarea value={issueForm.material_description}
                onChange={(e) => setIssueForm((f) => ({ ...f, material_description: e.target.value }))}
                rows={2} className="input resize-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Describe the required material..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label dark:text-gray-300">Required Quantity <span className="text-red-500 dark:text-red-400">*</span></label>
                <input type="number" step="0.01" min="0" value={issueForm.required_quantity}
                  onChange={(e) => setIssueForm((f) => ({ ...f, required_quantity: e.target.value }))}
                  className="input dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500" placeholder="e.g. 10" />
              </div>
              <div>
                <label className="label dark:text-gray-300">Unit <span className="text-red-500 dark:text-red-400">*</span></label>
                <input value={issueForm.material_unit}
                  onChange={(e) => setIssueForm((f) => ({ ...f, material_unit: e.target.value }))}
                  className="input dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500" placeholder="pcs, kg, m..." />
              </div>
            </div>
            <div>
              <label className="label dark:text-gray-300">Remarks <span className="text-gray-400 dark:text-gray-500">(optional)</span></label>
              <input value={issueForm.material_remarks}
                onChange={(e) => setIssueForm((f) => ({ ...f, material_remarks: e.target.value }))}
                className="input dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500" placeholder="Any additional notes..." />
            </div>
          </div>
        )}
        <div>
          <label className="label dark:text-gray-300">Image Evidence <span className="text-gray-400 dark:text-gray-500">(optional)</span></label>
          {issueImage ? (
            <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <img src={URL.createObjectURL(issueImage)} alt="preview" className="w-12 h-12 object-cover rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{issueImage.name}</span>
              <button onClick={() => setIssueImage(null)} className="text-red-500 dark:text-red-400 text-xs">Remove</button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-gray-800 transition-colors">
              <PhotoIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Click to attach image</span>
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
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{task.project_name}</h3>
            </div>
          </div>
          <div 
            className="relative group bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer"
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
              <span className="text-sm text-gray-500 dark:text-gray-400">{task.project_name}</span>
            ) : (
              <Link to={`/projects/${task.project_id}`} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                {task.project_name}
              </Link>
            )}
            <span className="text-gray-400 dark:text-gray-600">/</span>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{task.title || 'Task'}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span>{task.department_name}</span>
            <TaskBadge status={task.status} />
          </div>
        </div>
        {canAct && !isUpcoming && (
          <div className="flex gap-2">
            <button 
              onClick={() => setAddSubtaskOpen(true)} 
              disabled={!task.routing_is_latest}
              className={clsx(
                "btn-secondary flex items-center gap-1",
                !task.routing_is_latest && "opacity-50 cursor-not-allowed"
              )}
              title={!task.routing_is_latest ? "Cannot add subtasks to superseded routing tasks" : "Add Subtask"}
            >
              <PlusIcon className="w-4 h-4" /> Add Subtask
            </button>
            <button 
              onClick={() => setRaiseIssueOpen(true)} 
              disabled={!task.routing_is_latest}
              className={clsx(
                "btn-danger flex items-center gap-1",
                !task.routing_is_latest && "opacity-50 cursor-not-allowed"
              )}
              title={!task.routing_is_latest ? "Cannot raise issues for superseded routing tasks" : "Raise Issue"}
            >
              <ExclamationCircleIcon className="w-4 h-4" /> Raise Issue
            </button>
          </div>
        )}
      </div>

      {/* ── Progress ──────────────────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Subtask Progress</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{completedCount}/{totalCount} completed</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* ── Expected Completion Date ───────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Expected Completion Date</p>
            {task.expected_completion_date && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{fmtDate(task.expected_completion_date)}</p>
            )}
          </div>
          {isUpcoming ? (
            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <LockClosedIcon className="w-3 h-3" /> Not available for upcoming tasks
            </span>
          ) : isLayerThree ? (
            // Layer3: Date is locked, show locked status
            task.completion_date_locked || !task.routing_is_latest ? (
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <LockClosedIcon className="w-3 h-3" /> {!task.routing_is_latest ? "Superseded routing - Read only" : "Locked"}
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="input dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:[color-scheme:dark]"
                />
                <button
                  onClick={handleSetExpectedCompletion}
                  disabled={settingDate || !expectedDate}
                  className="btn-primary whitespace-nowrap"
                >
                  {settingDate ? 'Setting...' : 'Set Date'}
                </button>
              </div>
            )
          ) : (
            // Level1/Level2: Can edit date with confirmation
            !task.routing_is_latest ? (
              <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <LockClosedIcon className="w-3 h-3" /> Superseded routing - Read only
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="input dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:[color-scheme:dark]"
                />
                <button
                  onClick={handleSetExpectedCompletion}
                  disabled={settingDate || !expectedDate}
                  className="btn-primary whitespace-nowrap"
                >
                  {settingDate ? 'Setting...' : 'Set Date'}
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Project Info (Layer 3) ───────────────────────────────────────────────── */}
      {isLayerThree && rp && (
        <div className="card p-4">
          <div className="flex items-center gap-5 mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Project Information
            </h3>
            <h3 className="inline-flex items-center px-[6px] py-[2px] rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200">
              {rp.quantity || 'N/A'} UNIT
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">PO Number</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{rp.po_number || 'N/A'}</p>
            </div>

            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Routed Date</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{rp.routed_to_dept_at ? fmtDate(rp.routed_to_dept_at) : 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Expected Completion</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{rp.expected_completion_date ? fmtDate(rp.expected_completion_date) : 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Completion Locked</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {rp.completion_date_locked ? (
                  <span className="flex items-center gap-1">
                    <LockClosedIcon className="w-3 h-3" /> Yes
                  </span>
                ) : 'No'}
              </p>
            </div>
          </div>
          {rp.render_files_url && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => openPreview(rp.render_files_url!, 'Render Files')}
                className="text-sm text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <PaperClipIcon className="w-4 h-4" /> View Render Files
              </button>
            </div>
          )}
          {rp.drawing_url && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Drawing File</p>
              <button
                type="button"
                onClick={() => openPreview(rp.drawing_url!, rp.drawing_name || 'Drawing File')}
                className="text-sm text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <PaperClipIcon className="w-4 h-4" /> {rp.drawing_name || 'View Drawing'}
              </button>
            </div>
          )}

        </div>
      )}

      {/* ── Subtasks ──────────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Subtasks</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {task.subtasks?.length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">No subtasks yet</div>
          ) : (
            task.subtasks?.map((subtask) => (
              <div key={subtask.id} className="p-4 flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {subtask.status === 'completed' ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-500 dark:text-green-400" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                    )}
                    <span className={clsx(
                      'font-medium',
                      subtask.status === 'completed' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'
                    )}>
                      {subtask.title}
                    </span>
                    {subtask.is_required && <span className="text-xs text-red-500 dark:text-red-400">*</span>}
                  </div>
                  {subtask.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtask.description}</p>
                  )}
                  {subtask.files && subtask.files.length > 0 && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {subtask.files.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => openPreview(file.s3_url, file.original_name)}
                          className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 cursor-pointer text-left"
                        >
                          <PaperClipIcon className="w-3 h-3 flex-shrink-0" /> <span className="truncate max-w-[150px]">{file.original_name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                </div>
                  {(!isLayerThree || subtask.title !== "IQC") && subtask.status !== "completed" && canAct && !isUpcoming && (
                    <label
                      title="Upload an image or PDF as completion proof. Once the proof is uploaded and approved, this subtask will be marked as completed."
                      className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors"
                    >
                      <PhotoIcon className="w-4 h-4" />
                      <span className="text-sm">Completion Proof</span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) =>
                          e.target.files?.[0] &&
                          handleProofSelected(subtask.id, e.target.files[0])
                        }
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
          title="Submit Task Completion Proof"
          message="Are you sure you want to submit this proof? Once submitted, the subtask will be marked as completed automatically."
          confirmText="Submit"
          type="info"
          loading={uploadingProof}
        >
          {proofConfirm.previewUrl ? (
            <div className="mt-2 border dark:border-gray-700 rounded-xl overflow-hidden max-h-60 flex items-center justify-center bg-gray-50 dark:bg-gray-800 p-2">
              <img
                src={proofConfirm.previewUrl}
                alt="Proof Preview"
                className="max-h-56 object-contain rounded-lg shadow-sm"
              />
            </div>
          ) : (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700 flex items-center gap-2">
              <PaperClipIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                {proofConfirm.file.name}
              </span>
            </div>
          )}
        </ConfirmationModal>
      )}

      {dateChangeConfirm && (
        <ConfirmationModal
          open={!!dateChangeConfirm}
          onClose={() => setDateChangeConfirm(null)}
          onConfirm={() => executeDateChange(dateChangeConfirm.newDate)}
          title="Confirm Date Change"
          message={`Are you sure you want to change the expected completion date for ${task.department_name} from ${dateChangeConfirm.oldDate} to ${dateChangeConfirm.newDate}? This action will be recorded in the timeline.`}
          confirmText="Confirm Change"
          type="warning"
          loading={settingDate}
        />
      )}
    </div>
  )
}
