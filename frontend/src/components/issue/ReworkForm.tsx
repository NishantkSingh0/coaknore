import React, { useState } from 'react'
import { Textarea } from '../common/Input'
import { Button } from '../common/Button'
import { createReworkRequest, createIssue } from '../../api/issues'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

interface ReworkFormProps { projectId: string; taskId?: string; issueType: string; description: string; onSuccess: () => void; onCancel: () => void }

export const ReworkForm: React.FC<ReworkFormProps> = ({ projectId, taskId, issueType, description, onSuccess, onCancel }) => {
  const qc = useQueryClient()
  const [desc, setDesc] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      if (!desc.trim()) throw new Error('Description is required')
      const issue = await createIssue({ project_id: projectId, task_id: taskId, issue_type: issueType, description })
      await createReworkRequest(issue.id, desc)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      onSuccess()
    },
    onError: (err: any) => toast.error(err.message ?? err.response?.data?.error?.message ?? 'Failed'),
  })

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-gray-700">Rework Request Details</p>
      <Textarea
        label="Rework Description"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        placeholder="Describe what needs to be reworked and why…"
        rows={5}
      />
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
          Submit Rework Request
        </Button>
      </div>
    </div>
  )
}
