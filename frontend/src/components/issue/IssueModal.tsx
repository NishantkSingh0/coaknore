import React, { useState } from 'react'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import { Select, Input, Textarea } from '../common/Input'
import { ISSUE_TYPES } from '../../constants'
import { createIssue, createMaterialRequisition, createReworkRequest } from '../../api/issues'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { MaterialReqForm } from './MaterialReqForm'
import { ReworkForm } from './ReworkForm'

interface IssueModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  taskId?: string
}

export const IssueModal: React.FC<IssueModalProps> = ({ open, onClose, projectId, taskId }) => {
  const qc = useQueryClient()
  const [step, setStep] = useState<'type' | 'details'>('type')
  const [issueType, setIssueType] = useState('')
  const [description, setDescription] = useState('')
  const [createdIssueId, setCreatedIssueId] = useState<string | null>(null)

  const reset = () => {
    setStep('type'); setIssueType(''); setDescription(''); setCreatedIssueId(null)
    onClose()
  }

  const createMutation = useMutation({
    mutationFn: () => createIssue({ project_id: projectId, task_id: taskId, issue_type: issueType, description }),
    onSuccess: (data) => {
      setCreatedIssueId(data.id)
      if (issueType === 'item_missing' || issueType === 'rework_required') {
        setStep('details')
      } else {
        qc.invalidateQueries({ queryKey: ['issues'] })
        toast.success('Issue raised successfully')
        reset()
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message ?? 'Failed to raise issue'),
  })

  const handleNext = () => {
    if (!issueType) { toast.error('Select an issue type'); return }
    createMutation.mutate()
  }

  const handleSecondarySubmit = () => {
    qc.invalidateQueries({ queryKey: ['issues'] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
    toast.success('Issue raised successfully')
    reset()
  }

  return (
    <Modal open={open} onClose={reset} title="Raise Issue" size="lg">
      {step === 'type' && (
        <div className="space-y-5">
          <Select
            label="Issue Type"
            options={ISSUE_TYPES.map(t => ({ value: t.value, label: t.label }))}
            value={issueType}
            onChange={e => setIssueType(e.target.value)}
          />
          <Textarea
            label="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the issue…"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={reset}>Cancel</Button>
            <Button onClick={handleNext} loading={createMutation.isPending}>
              {issueType === 'item_missing' || issueType === 'rework_required' ? 'Next →' : 'Submit Issue'}
            </Button>
          </div>
        </div>
      )}

      {step === 'details' && createdIssueId && issueType === 'item_missing' && (
        <MaterialReqForm issueId={createdIssueId} onSuccess={handleSecondarySubmit} onCancel={reset} />
      )}

      {step === 'details' && createdIssueId && issueType === 'rework_required' && (
        <ReworkForm issueId={createdIssueId} onSuccess={handleSecondarySubmit} onCancel={reset} />
      )}
    </Modal>
  )
}
