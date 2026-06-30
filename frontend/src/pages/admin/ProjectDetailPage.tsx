import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProject, getRouting, deleteProject } from '../../api/projects'
import { Badge } from '../../components/common/Badge'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { ProjectForm } from '../../components/project/ProjectForm'
import { Spinner } from '../../components/common/Spinner'
import { formatDate, formatCurrency } from '../../utils'
import { Pencil, Trash2, Route, Calendar, Package, IndianRupee, Eye, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import type { RoutingEntry } from '../../types'
import { useAuthStore } from '../../store/authStore'

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [proofPreview, setProofPreview] = useState<RoutingEntry | null>(null)

  const isAdmin = user?.role === 'admin'

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  })

  const { data: routing = [] } = useQuery({
    queryKey: ['routing', id],
    queryFn: () => getRouting(id!),
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
      navigate('/admin/projects')
    },
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!project) return <p className="text-center py-20 text-gray-500">Project not found</p>

  const routingGrouped: Record<number, typeof routing> = {}
  routing.forEach(r => {
    if (!routingGrouped[r.sequence_order]) routingGrouped[r.sequence_order] = []
    routingGrouped[r.sequence_order].push(r)
  })
  const isPdfProof = proofPreview?.completion_proof_url?.toLowerCase().includes('.pdf')
  console.log("Image URL", project.image_url)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-sm font-mono text-indigo-600 font-bold">#{project.po_number}</span>
            <Badge status={project.current_status} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{project.project_name}</h2>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" icon={<Pencil size={14} />} onClick={() => setShowEdit(true)}>
              Edit
            </Button>
            <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setShowDelete(true)}>
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Image */}
      {project.image_url && (
        <img
          src={project.image_url}
          alt={project.project_name}
          className="w-full max-h-72 object-cover rounded-xl border border-gray-200"
        />
      )}

      {/* Details grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Receiving Date', value: formatDate(project.receiving_date), icon: <Calendar size={16} /> },
          { label: 'Quantity', value: String(project.quantity), icon: <Package size={16} /> },
          { label: 'Rate', value: formatCurrency(project.rates), icon: <IndianRupee size={16} /> },
          { label: 'Dimension', value: project.dimensions ?? '—', icon: null },
        ].map(item => (
          <div key={item.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{item.label}</p>
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
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
        <div className="bg-white border border-gray-200 rounded-xl">
          {[
            { label: 'Specification', value: project.specification },
            { label: 'Upholstery / Finish', value: project.upholstery_finish },
            { label: 'Remarks', value: project.remarks },
          ]
            .filter(f => f.value)
            .map((f, index, arr) => (
              <div
                key={f.label}
                className={`p-4 ${
                  index !== arr.length - 1 ? 'border-b border-gray-200' : ''
                }`}
              >
                <p className="text-xs text-gray-500 mb-1">{f.label}</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {f.value}
                </p>
              </div>
            ))}
        </div>
      )}

      {/* Routing */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Route size={18} /> Department Routing
          </h3>
        </div>
        {routing.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No routing set yet</p>
        ) : (
          <div className="p-4 space-y-3">
            {Object.entries(routingGrouped)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([seq, rows]) => (
                <div key={seq} className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-full bg-indigo-600 text-white text-xs font-bold
                    flex items-center justify-center shrink-0">{seq}</span>
                  <div className="flex gap-2 flex-wrap">
                    {rows.map(r => (
                      <div key={r.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                        <span className="text-sm font-medium text-gray-800">{r.department_name}</span>
                        <Badge status={r.status} />
                        {r.completion_proof_url && (
                          <button
                            type="button"
                            onClick={() => setProofPreview(r)}
                            className="inline-flex items-center gap-1 text-xs text-indigo-700 hover:text-indigo-900"
                            aria-label={`Preview ${r.department_name} completion proof`}
                          >
                            <Eye size={13} /> 
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Project" size="xl">
        <ProjectForm
          mode="edit"
          project={project}
          onSuccess={() => { setShowEdit(false); qc.invalidateQueries({ queryKey: ['project', id] }) }}
          onCancel={() => setShowEdit(false)}
        />
      </Modal>

      <Modal
        open={!!proofPreview}
        onClose={() => setProofPreview(null)}
        title={`${proofPreview?.department_name ?? 'Department'} Proof`}
        size="xl"
      >
        {proofPreview?.completion_proof_url && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <a
                href={proofPreview.completion_proof_url}
                download
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900"
              >
                <Download size={14} /> Download
              </a>
            </div>
            {isPdfProof ? (
              <iframe
                src={proofPreview.completion_proof_url}
                title="Completion proof preview"
                className="h-[70vh] w-full rounded-lg border border-gray-200"
              />
            ) : (
              <img
                src={proofPreview.completion_proof_url}
                alt="Completion proof"
                className="max-h-[70vh] w-full rounded-lg object-contain"
              />
            )}
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title="Delete Project"
        message={`Delete project "${project.project_name}"? This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  )
}
