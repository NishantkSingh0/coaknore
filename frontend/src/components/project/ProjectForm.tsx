import React, { useState } from 'react'
import { Input, Textarea, Select } from '../common/Input'
import { Button } from '../common/Button'
import { FileUpload } from '../common/FileUpload'
import { useFileUpload } from '../../hooks/useFileUpload'
import { createProject, updateProject } from '../../api/projects'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import type { Project } from '../../types'

interface ProjectFormProps {
  mode: 'create' | 'edit'
  project?: Project
  onSuccess: () => void
  onCancel: () => void
}

const emptyForm = {
  po_number: '', project_name: '', receiving_date: '', quantity: '',
  rates: '', dimensions: '', remarks: '', specification: '',
  upholstery_finish: '', cad_urls: '', pdf_urls: '', render_urls: '', jobcard_urls: '',
}

export const ProjectForm: React.FC<ProjectFormProps> = ({ mode, project, onSuccess, onCancel }) => {
  const qc = useQueryClient()
  const { upload, uploading, url: imageUrl, key: imageKey } = useFileUpload('projects/covers')

  const [form, setForm] = useState({
    po_number:        project?.po_number        ?? '',
    project_name:     project?.project_name     ?? '',
    receiving_date:   project?.receiving_date   ?? '',
    quantity:         String(project?.quantity  ?? ''),
    rates:            String(project?.rates     ?? ''),
    dimensions:       project?.dimensions       ?? '',
    remarks:          project?.remarks          ?? '',
    specification:    project?.specification    ?? '',
    upholstery_finish:project?.upholstery_finish ?? '',
    cad_urls:         project?.cad_urls         ?? '',
    pdf_urls:         project?.pdf_urls         ?? '',
    render_urls:      project?.render_urls      ?? '',
    jobcard_urls:     project?.jobcard_urls     ?? '',
  })
  const [error, setError] = useState<Record<string, string>>({})

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.po_number || form.po_number.length !== 5) errs.po_number = 'Must be exactly 5 digits'
    if (!form.project_name) errs.project_name = 'Required'
    if (!form.receiving_date) errs.receiving_date = 'Required'
    if (!form.quantity || isNaN(Number(form.quantity))) errs.quantity = 'Must be a number'
    if (!form.rates || isNaN(Number(form.rates))) errs.rates = 'Must be a number'
    setError(errs)
    return Object.keys(errs).length === 0
  }

  const handlePoBlur = () => {
    setForm(f => ({
      ...f,
      po_number: f.po_number
        ? f.po_number.padStart(5, '0')
        : '',
    }))
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        quantity: Number(form.quantity),
        rates:    Number(form.rates),
        ...(imageKey ? { image_url: imageKey } : {}),
      }
      return mode === 'create'
        ? createProject(payload)
        : updateProject(project!.id, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success(mode === 'create' ? 'Project created' : 'Project updated')
      onSuccess()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message ?? 'Something went wrong')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) mutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Primary info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="PO Number (5 digits)"
          value={form.po_number}
          onChange={set('po_number')}
          onBlur={handlePoBlur}
          maxLength={3}
          error={error.po_number}
          disabled={mode === 'edit'}
          placeholder="001"
        />
        <Input
          label="Project Name"
          value={form.project_name}
          onChange={set('project_name')}
          error={error.project_name}
          placeholder="Custom sofa set"
        />
        <Input
          label="Receiving Date"
          type="date"
          value={form.receiving_date}
          onChange={set('receiving_date')}
          error={error.receiving_date}
        />
        <Input
          label="Quantity"
          type="number"
          value={form.quantity}
          onChange={set('quantity')}
          error={error.quantity}
          min="1"
        />
        <Input
          label="Rates (₹)"
          type="number"
          value={form.rates}
          onChange={set('rates')}
          error={error.rates}
        />
        <Input
          label="Dimensions"
          value={form.dimensions}
          onChange={set('dimensions')}
          placeholder="L×W×H in mm"
        />
      </div>

      {/* Detail fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Textarea label="Specification" value={form.specification} onChange={set('specification')} />
        <Textarea label="Upholstery / Finish" value={form.upholstery_finish} onChange={set('upholstery_finish')} />
        <Textarea label="Remarks" value={form.remarks} onChange={set('remarks')} />
      </div>

      {/* URL fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="CAD URLs" value={form.cad_urls} onChange={set('cad_urls')} placeholder="Comma-separated" />
        <Input label="PDF URLs" value={form.pdf_urls} onChange={set('pdf_urls')} placeholder="Comma-separated" />
        <Input label="Render URLs" value={form.render_urls} onChange={set('render_urls')} placeholder="Comma-separated" />
        <Input label="Jobcard URLs" value={form.jobcard_urls} onChange={set('jobcard_urls')} placeholder="Comma-separated" />
      </div>

      {/* Image upload */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Project Image</p>
        <FileUpload
          onFile={file => upload(file)}
          uploading={uploading}
          previewUrl={imageUrl ?? project?.image_url}
          accept="image/*"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>
          {mode === 'create' ? 'Create Project' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
