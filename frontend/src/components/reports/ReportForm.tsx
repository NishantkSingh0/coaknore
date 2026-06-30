import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProjects } from '../../api/projects'
import { createReport } from '../../api/reports'
import { Select, Textarea } from '../common/Input'
import { Button } from '../common/Button'
import { FileUpload } from '../common/FileUpload'
import { useFileUpload } from '../../hooks/useFileUpload'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

export const ReportForm: React.FC = () => {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: projectList } = useQuery({ queryKey: ['projects'], queryFn: () => getProjects() })
  const { upload, uploading, url: imageUrl } = useFileUpload('reports')
  const [imageKey, setImageKey] = useState<string | null>(null)

  const handleUpload = async (file: File) => {
    const result = await upload(file)
    if (result) setImageKey(result.key)
  }

  const [projectId, setProjectId] = useState('')
  const [description, setDescription] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      if (!projectId) throw new Error('Select a project')
      if (!description.trim()) throw new Error('Description is required')
      return createReport({
        project_id: projectId,
        description,
        ...(imageKey ? { image_url: imageKey } : {}),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Report submitted — attendance marked automatically')
      navigate('/dept/dashboard')
    },
    onError: (err: any) => toast.error(err.message ?? err.response?.data?.error?.message ?? 'Failed'),
  })

  const projectOptions = projectList?.projects.map(p => ({
    value: p.id, label: `#${p.po_number} — ${p.project_name}`,
  })) ?? []

  return (
    <div className="max-w-xl space-y-5">
      <Select
        label="Project"
        options={projectOptions}
        value={projectId}
        onChange={e => setProjectId(e.target.value)}
      />
      <Textarea
        label="Progress Description"
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Describe today's work on this project…"
        rows={5}
      />
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Progress Photo (optional)</p>
        <FileUpload
          onFile={handleUpload}
          uploading={uploading}
          previewUrl={imageUrl}
          accept="image/*"
          label="Upload progress photo"
        />
      </div>
      <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
        Submit Report
      </Button>
    </div>
  )
}
