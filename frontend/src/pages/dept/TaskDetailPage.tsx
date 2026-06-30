import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTask, updateTask } from '../../api/tasks'
import { getProject } from '../../api/projects'
import { uploadFile } from '../../api/files'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Select, Input } from '../../components/common/Input'
import { IssueModal } from '../../components/issue/IssueModal'
import { Spinner } from '../../components/common/Spinner'
import { formatDate } from '../../utils'
import { cn } from '../../utils/cn'
import { ArrowLeft, AlertCircle, Upload, FileCheck, Calendar, Package, IndianRupee } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = [
  { value: 'pending',    label: 'Pending' },
  { value: 'in_progress',label: 'In Progress' },
  { value: 'hold',       label: 'Hold' },
  { value: 'issue_hold', label: 'Issue Hold' },
  { value: 'completed',  label: 'Completed' },
]

export const TaskDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => getTask(taskId!),
    enabled: !!taskId,
  })

  const { data: project } = useQuery({
    queryKey: ['project', task?.project_id],
    queryFn: () => getProject(task!.project_id),
    enabled: !!task?.project_id,
  })

  const [status, setStatus]         = useState(task?.status ?? '')
  const [startDate, setStartDate]   = useState(task?.start_date?.split('T')[0] ?? '')
  const [dueDate, setDueDate]       = useState(task?.due_date?.split('T')[0] ?? '')
  const [showIssue, setShowIssue]   = useState(false)
  const [proofKey, setProofKey]     = useState(task?.addon ?? '')
  const [proofName, setProofName]   = useState('')
  const [uploadingProof, setUploadingProof] = useState(false)

  // Keep form in sync when data loads
  React.useEffect(() => {
    if (task) {
      setStatus(task.status)
      setStartDate(task.start_date?.split('T')[0] ?? '')
      setDueDate(task.due_date?.split('T')[0] ?? '')
      setProofKey(task.addon ?? '')
    }
  }, [task])

  const mutation = useMutation({
    mutationFn: () => updateTask(taskId!, {
      status,
      start_date: startDate || undefined,
      due_date: dueDate || undefined,
      addon: proofKey || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task', taskId] })
      toast.success('Task updated')
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message ?? 'Failed'),
  })

  if (isLoading || !task) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const cardBg = task.status === 'completed' ? 'bg-[#F0FFF4] border-green-200'
    : task.is_overdue ? 'bg-[#FFF0F0] border-red-200' : 'bg-white border-gray-200'

  const handleProofUpload = async (file: File) => {
    setUploadingProof(true)
    try {
      const uploaded = await uploadFile(file, `tasks/${task.id}/completion-proof`)
      setProofKey(uploaded.key)
      setProofName(file.name)
      toast.success('Proof uploaded')
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message ?? 'Proof upload failed')
    } finally {
      setUploadingProof(false)
    }
  }

  const handleSave = () => {
    if (status === 'completed' && !proofKey) {
      toast.error('Upload completion proof before marking completed')
      return
    }
    mutation.mutate()
  }

  return (
    <div className="max-w-2xl space-y-5">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={16} /> Back to tasks
      </button>

      {/* Task card */}
      <div className={cn('rounded-xl border p-6 space-y-4', cardBg)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-mono text-indigo-600">#{task.po_number}</span>
            <h2 className="text-xl font-bold text-gray-900 mt-0.5">{task.project_name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{task.dept_name} — Seq. {task.sequence_order}</p>
          </div>
          <Badge status={task.status} />
        </div>

        {project && (
          <div className="space-y-4 pt-4 border-t border-gray-200">
            {/* Project Image */}
            {project.image_url && (
              <img
                src={project.image_url}
                alt={project.project_name}
                className="w-full max-h-48 object-cover rounded-lg border border-gray-200"
              />
            )}

            {/* Project Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Dimension', value: project.dimensions ?? '—', icon: null },
                { label: 'Receiving Date', value: formatDate(project.receiving_date), icon: <Calendar size={14} /> },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                  <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                    {item.icon}{item.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Text Fields */}
            {[
              { label: 'Specification', value: project.specification },
              { label: 'Upholstery / Finish', value: project.upholstery_finish },
              { label: 'Remarks', value: project.remarks },
            ].some(f => f.value) && (
              <div className="bg-gray-50 rounded-lg divide-y divide-gray-200">
                {[
                  { label: 'Specification', value: project.specification },
                  { label: 'Upholstery / Finish', value: project.upholstery_finish },
                  { label: 'Remarks', value: project.remarks },
                ]
                  .filter(f => f.value)
                  .map((f) => (
                    <div key={f.label} className="p-3">
                      <p className="text-xs text-gray-500 mb-1">{f.label}</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{f.value}</p>
                    </div>
                  ))}
              </div>
            )}

            {/* URLs */}
            {(project.cad_urls || project.pdf_urls || project.render_urls || project.jobcard_urls) && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-gray-500 mb-2">Project Files</p>
                {project.cad_urls && (
                  <a href={project.cad_urls} target="_blank" rel="noreferrer" className="block text-sm text-indigo-600 hover:text-indigo-800">
                    CAD Files
                  </a>
                )}
                {project.pdf_urls && (
                  <a href={project.pdf_urls} target="_blank" rel="noreferrer" className="block text-sm text-indigo-600 hover:text-indigo-800">
                    PDF Files
                  </a>
                )}
                {project.render_urls && (
                  <a href={project.render_urls} target="_blank" rel="noreferrer" className="block text-sm text-indigo-600 hover:text-indigo-800">
                    Render Files
                  </a>
                )}
                {project.jobcard_urls && (
                  <a href={project.jobcard_urls} target="_blank" rel="noreferrer" className="block text-sm text-indigo-600 hover:text-indigo-800">
                    Job Card Files
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {task.is_overdue && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={16} /> This task is overdue
          </div>
        )}

        {/* Edit form */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            disabled={!!task.start_date}
          />

          <Input
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            min={startDate}
            disabled={!!task.due_date}
          />
          <div className="col-span-2">
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={e => setStatus(e.target.value)}
            />
          </div>
          {status === 'completed' && (
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Completion Proof
              </label>
              <label className={cn(
                'flex items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3 cursor-pointer',
                proofKey ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-white hover:border-indigo-400'
              )}>
                <span className="flex items-center gap-2 text-sm text-gray-700">
                  {proofKey ? <FileCheck size={16} className="text-green-600" /> : <Upload size={16} className="text-gray-400" />}
                  {proofKey ? (proofName || 'Proof file uploaded') : 'Upload image or PDF proof'}
                </span>
                <span className="text-xs text-gray-500">{uploadingProof ? 'Uploading...' : 'Choose file'}</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={uploadingProof}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleProofUpload(file)
                  }}
                />
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Required before this department task can be completed.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} loading={mutation.isPending || uploadingProof}>
            Save Changes
          </Button>
          <Button
            variant="outline"
            icon={<AlertCircle size={15} />}
            onClick={() => setShowIssue(true)}
          >
            Raise Issue
          </Button>
        </div>
      </div>

      {/* Issue modal */}
      <IssueModal
        open={showIssue}
        onClose={() => setShowIssue(false)}
        projectId={task.project_id}
        taskId={task.id}
      />
    </div>
  )
}
