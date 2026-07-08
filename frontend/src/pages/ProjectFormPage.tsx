import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { projectApi } from '../services/api'
import toast from 'react-hot-toast'

type FormValues = {
  po_number: string
  project_name: string
  client_name: string
  client_email: string
  client_phone: string
  client_address: string
  quantity: number
  specifications: string
  material_details: string
  upholstery_details: string
  delivery_date: string
  delivery_address: string
  cad_files_url: string
  job_cards_url: string
  render_files_url: string
  revision_reason: string
  client_request: string
}

export default function ProjectFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)

  // Drawing file upload state
  const [drawingFile, setDrawingFile] = useState<File | null>(null)
  const [drawingPreview, setDrawingPreview] = useState<string | null>(null)
  const [existingDrawingUrl, setExistingDrawingUrl] = useState<string | null>(null)
  const [uploadingDrawing, setUploadingDrawing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { quantity: 1 },
  })

  useEffect(() => {
    if (isEdit && id) {
      projectApi.get(id).then((p) => {
        reset({
          po_number: p.po_number,
          project_name: p.project_name,
          client_name: p.client_name,
          client_email: p.client_email || '',
          client_phone: p.client_phone || '',
          client_address: p.client_address || '',
          quantity: p.quantity,
          specifications: p.specifications || '',
          material_details: p.material_details || '',
          upholstery_details: p.upholstery_details || '',
          delivery_date: p.delivery_date?.split('T')[0] || '',
          delivery_address: p.delivery_address || '',
          cad_files_url: p.cad_files_url || '',
          job_cards_url: p.job_cards_url || '',
          render_files_url: p.render_files_url || '',
        })
        if (p.drawing_file?.s3_url) {
          setExistingDrawingUrl(p.drawing_file.s3_url)
        }
      })
    }
  }, [id, isEdit, reset])

  const handleDrawingFileChange = (file: File) => {
    setDrawingFile(file)
    const url = URL.createObjectURL(file)
    setDrawingPreview(url)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleDrawingFileChange(file)
  }

  const onSubmit = async (values: FormValues) => {
    setLoading(true)
    try {
      const payload = {
        po_number: values.po_number.trim(),
        project_name: values.project_name.trim(),
        client_name: values.client_name.trim(),
        client_email: values.client_email.trim(),
        client_phone: values.client_phone.trim(),
        client_address: values.client_address.trim(),
        quantity: Number(values.quantity) || 1,
        specifications: values.specifications,
        material_details: values.material_details,
        upholstery_details: values.upholstery_details,
        delivery_date: values.delivery_date || undefined,
        delivery_address: values.delivery_address,
        cad_files_url: values.cad_files_url.trim(),
        job_cards_url: values.job_cards_url.trim(),
        render_files_url: values.render_files_url.trim(),
      }

      let projectId: string

      if (isEdit && id) {
        if (!values.revision_reason.trim()) {
          toast.error('Revision reason is required when editing')
          setLoading(false)
          return
        }
        await projectApi.update(id, {
          ...payload,
          revision_reason: values.revision_reason.trim(),
          client_request: values.client_request.trim(),
        })
        projectId = id
        toast.success('Project updated')
      } else {
        const p = await projectApi.create(payload)
        projectId = p.id
        setCreatedProjectId(projectId)
        toast.success('Project created')
      }

      // Upload drawing file if selected
      if (drawingFile) {
        setUploadingDrawing(true)
        try {
          await projectApi.uploadDrawing(projectId, drawingFile)
          toast.success('Drawing uploaded')
        } catch {
          toast.error('Project saved but drawing upload failed')
        } finally {
          setUploadingDrawing(false)
        }
      }

      navigate(`/projects/${projectId}`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : 'Failed to save project')
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const Field = ({
    label, name, type = 'text', required = false, placeholder = '', span = false,
  }: {
    label: string; name: keyof FormValues; type?: string;
    required?: boolean; placeholder?: string; span?: boolean
  }) => (
    <div className={span ? 'col-span-2' : ''}>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        {...register(name, {
          required: required ? `${label} is required` : false,
          ...(type === 'number' ? { valueAsNumber: true } : {}),
        })}
        placeholder={placeholder}
        className={`input ${errors[name] ? 'input-error' : ''}`}
      />
      {errors[name] && (
        <p className="text-xs text-red-500 mt-1">{errors[name]?.message as string}</p>
      )}
    </div>
  )

  const TextArea = ({ label, name, rows = 3 }: { label: string; name: keyof FormValues; rows?: number }) => (
    <div className="col-span-2">
      <label className="label">{label}</label>
      <textarea rows={rows} {...register(name)} className="input resize-none" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="page-title">{isEdit ? 'Edit Project' : 'New Project'}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* ── Drawing Upload ─────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold">Project Drawing</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Upload the primary drawing/blueprint for this project. This will display at the top of the project detail page.
            </p>
          </div>
          <div className="card-body">
            {(drawingPreview || existingDrawingUrl) && (
              <div className="mb-4 relative inline-block">
                <img
                  src={drawingPreview || existingDrawingUrl!}
                  alt="Drawing preview"
                  className="max-h-48 rounded-xl border border-gray-200 object-contain"
                />
                {drawingPreview && (
                  <button
                    type="button"
                    onClick={() => { setDrawingFile(null); setDrawingPreview(null) }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors"
            >
              <PhotoIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {drawingFile
                  ? <span className="text-brand-600 font-medium">{drawingFile.name}</span>
                  : <><span className="text-brand-600 font-medium">Click to upload</span> or drag and drop</>
                }
              </p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG, PDF, DWG up to 50MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.dwg,.dxf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleDrawingFileChange(e.target.files[0])}
              />
            </div>
          </div>
        </div>

        {/* ── Basic Info ─────────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header"><h2 className="font-semibold">Project Information</h2></div>
          <div className="card-body grid grid-cols-2 gap-4">
            <Field label="PO Number"     name="po_number"    required placeholder="PO-2024-001" />
            <Field label="Project Name"  name="project_name" required placeholder="Living Room Set" />
            <Field label="Client Name"   name="client_name"  required />
            <Field label="Client Email"  name="client_email" type="email" />
            <Field label="Client Phone"  name="client_phone" />
            <Field label="Quantity"      name="quantity"     type="number" required />
            <Field label="Delivery Date" name="delivery_date" type="date" />
            <TextArea label="Client Address"   name="client_address"   rows={2} />
            <TextArea label="Delivery Address" name="delivery_address" rows={2} />
          </div>
        </div>

        {/* ── Specifications ─────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header"><h2 className="font-semibold">Specifications &amp; Materials</h2></div>
          <div className="card-body grid grid-cols-2 gap-4">
            <TextArea label="Specifications"   name="specifications"   />
            <TextArea label="Material Details" name="material_details" />
            <div>
              <label className="label">Upholstery Details</label>
              <input {...register('upholstery_details')} className="input" />
            </div>
          </div>
        </div>

        {/* ── Document Links ──────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header"><h2 className="font-semibold">Document Links (optional)</h2></div>
          <div className="card-body grid grid-cols-2 gap-4">
            <Field label="CAD Files URL"    name="cad_files_url"    placeholder="https://..." />
            <Field label="Job Cards URL"    name="job_cards_url"    placeholder="https://..." />
            <Field label="Render Files URL" name="render_files_url" placeholder="https://..." span />
          </div>
        </div>

        {/* ── Revision (edit only) ─────────────────────────────────────────── */}
        {isEdit && (
          <div className="card border-orange-200">
            <div className="card-header bg-orange-50">
              <h2 className="font-semibold text-orange-700">Revision Details</h2>
              <p className="text-xs text-gray-500 mt-0.5">Every edit creates a new revision. Reason is required.</p>
            </div>
            <div className="card-body grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Revision Reason <span className="text-red-500">*</span></label>
                <input {...register('revision_reason')} className="input" placeholder="What changed and why?" />
              </div>
              <div className="col-span-2">
                <label className="label">Client Request Reference</label>
                <input {...register('client_request')} className="input" placeholder="Client email / CR number" />
              </div>
            </div>
          </div>
        )}

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 justify-end pb-8">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading || uploadingDrawing} className="btn-primary">
            {uploadingDrawing ? 'Uploading drawing…' : loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  )
}
