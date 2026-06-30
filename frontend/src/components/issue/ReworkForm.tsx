import React, { useState } from 'react'
import { Textarea } from '../common/Input'
import { Button } from '../common/Button'
import { createReworkRequest } from '../../api/issues'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'

interface ReworkFormProps { issueId: string; onSuccess: () => void; onCancel: () => void }

export const ReworkForm: React.FC<ReworkFormProps> = ({ issueId, onSuccess, onCancel }) => {
  const [desc, setDesc] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      if (!desc.trim()) throw new Error('Description is required')
      return createReworkRequest(issueId, desc)
    },
    onSuccess,
    onError: (err: any) => toast.error(err.message ?? 'Failed'),
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
