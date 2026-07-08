import { useState, useCallback } from 'react'
import {
  PlusIcon, TrashIcon, CheckIcon, PlayIcon,
  PencilIcon, ClockIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { routingApi, orgApi } from '../../services/api'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../context/AuthContext'
import type { Routing, RoutingEditTimeline, Project } from '../../types'
import Modal from '../ui/Modal'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { fmtDateTime } from '../../utils/helpers'

interface StepDraft {
  id: string
  stepOrder: number
  name: string
  dependencyPolicy: 'require_all' | 'require_any'
  departmentIds: string[]
}

const newStep = (order: number): StepDraft => ({
  id: crypto.randomUUID(),
  stepOrder: order,
  name: '',
  dependencyPolicy: 'require_all',
  departmentIds: [],
})

export default function RoutingBuilder({
  projectId, project, onPublish,
}: {
  projectId: string; project: Project; onPublish?: () => void
}) {
  const { isLayerTwo, isAdmin } = useAuth()
  const canEdit = isLayerTwo || isAdmin

  const { data: routings, refetch: refetchRoutings } = useAsync(
    () => routingApi.listForProject(projectId), [projectId]
  )
  const { data: allDepts } = useAsync(() => orgApi.listDepartments('layer3'), [])

  const [steps, setSteps] = useState<StepDraft[]>([newStep(1)])
  const [routingName, setRoutingName] = useState('')

  // Modes: 'idle' | 'create' | 'edit'
  const [mode, setMode] = useState<'idle' | 'create' | 'edit'>('idle')
  const [editingRoutingId, setEditingRoutingId] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [deptSearch, setDeptSearch] = useState<Record<string, string>>({})

  // Timeline
  const [timelineRoutingId, setTimelineRoutingId] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<RoutingEditTimeline[]>([])
  const [timelineOpen, setTimelineOpen] = useState(false)

  // Edit confirmation modal
  const [editWarningOpen, setEditWarningOpen] = useState(false)
  const [pendingEditReason, setPendingEditReason] = useState('')
  const [pendingEditRoutingId, setPendingEditRoutingId] = useState<string | null>(null)

  const addStep = () => setSteps((s) => [...s, newStep(s.length + 1)])
  const removeStep = (id: string) =>
    setSteps((s) => s.filter((x) => x.id !== id).map((x, i) => ({ ...x, stepOrder: i + 1 })))

  const toggleDept = (stepId: string, deptId: string) => {
    setSteps((s) =>
      s.map((step) => {
        if (step.id !== stepId) return step
        const has = step.departmentIds.includes(deptId)
        return {
          ...step,
          departmentIds: has ? step.departmentIds.filter((d) => d !== deptId) : [...step.departmentIds, deptId],
        }
      })
    )
  }

  const updateStep = (id: string, field: keyof StepDraft, value: unknown) => {
    setSteps((s) => s.map((step) => (step.id === id ? { ...step, [field]: value } : step)))
  }

  const getDeptName = (id: string) => allDepts?.find((d) => d.id === id)?.name || id

  const filteredDepts = useCallback((stepId: string) => {
    const q = (deptSearch[stepId] || '').toLowerCase()
    return (allDepts || []).filter((d) => d.name.toLowerCase().includes(q) && d.is_active)
  }, [allDepts, deptSearch])

  const loadStepsFromRouting = (routing: Routing) => {
    setRoutingName(routing.name || '')
    setSteps(
      (routing.steps || []).map((s) => ({
        id: crypto.randomUUID(),
        stepOrder: s.step_order,
        name: s.name || '',
        dependencyPolicy: s.dependency_policy,
        departmentIds: s.departments?.map((d) => d.id) || [],
      }))
    )
  }

  // Create new routing
  const saveNewRouting = async () => {
    for (const step of steps) {
      if (step.departmentIds.length === 0) {
        toast.error(`Step ${step.stepOrder} must have at least one department`)
        return
      }
    }
    setSaving(true)
    try {
      await routingApi.create(projectId, {
        name: routingName,
        steps: steps.map((s) => ({
          step_order: s.stepOrder,
          name: s.name,
          dependency_policy: s.dependencyPolicy,
          department_ids: s.departmentIds,
        })),
      })
      toast.success('Routing saved as draft')
      setMode('idle')
      setSteps([newStep(1)])
      setRoutingName('')
      refetchRoutings()
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to save routing'
      )
    } finally {
      setSaving(false)
    }
  }

  // Request edit — shows warning modal first
  const requestEdit = (routing: Routing) => {
    setPendingEditRoutingId(routing.id)
    setPendingEditReason('')
    setEditWarningOpen(true)
  }

  // Confirmed edit — load steps for editing
  const confirmEdit = () => {
    if (!pendingEditReason.trim()) {
      toast.error('Please provide a reason for editing')
      return
    }
    const routing = routings?.find((r) => r.id === pendingEditRoutingId)
    if (!routing) return
    loadStepsFromRouting(routing)
    setEditingRoutingId(routing.id)
    setMode('edit')
    setEditWarningOpen(false)
  }

  // Save edited routing
  const saveEditedRouting = async () => {
    if (!editingRoutingId) return
    for (const step of steps) {
      if (step.departmentIds.length === 0) {
        toast.error(`Step ${step.stepOrder} must have at least one department`)
        return
      }
    }
    setSaving(true)
    try {
      await routingApi.update(editingRoutingId, {
        name: routingName,
        edit_reason: pendingEditReason,
        steps: steps.map((s) => ({
          step_order: s.stepOrder,
          name: s.name,
          dependency_policy: s.dependencyPolicy,
          department_ids: s.departmentIds,
        })),
      })
      toast.success('Routing updated')
      setMode('idle')
      setEditingRoutingId(null)
      setPendingEditReason('')
      setSteps([newStep(1)])
      setRoutingName('')
      refetchRoutings()
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to update routing'
      )
    } finally {
      setSaving(false)
    }
  }

  const publishRouting = async (routingId: string) => {
    setPublishing(routingId)
    try {
      await routingApi.publish(routingId)
      toast.success('Routing published — tasks generated')
      refetchRoutings()
      onPublish?.()
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to publish'
      )
    } finally {
      setPublishing(null)
    }
  }

  const viewTimeline = async (routingId: string) => {
    setTimelineRoutingId(routingId)
    try {
      const data = await routingApi.getEditTimeline(routingId)
      setTimeline(data)
      setTimelineOpen(true)
    } catch {
      toast.error('Failed to load edit timeline')
    }
  }

  const cancel = () => {
    setMode('idle')
    setEditingRoutingId(null)
    setSteps([newStep(1)])
    setRoutingName('')
  }

  const isBuilding = mode === 'create' || mode === 'edit'

  // ── Step builder UI (shared between create and edit) ─────────────────────
  const StepBuilder = (
    <div className="card-body space-y-4">
      <div>
        <label className="label">Routing Name (optional)</label>
        <input
          value={routingName}
          onChange={(e) => setRoutingName(e.target.value)}
          className="input max-w-sm"
          placeholder="e.g. Standard Manufacturing Flow"
        />
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div key={step.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                {step.stepOrder}
              </div>
              <input
                value={step.name}
                onChange={(e) => updateStep(step.id, 'name', e.target.value)}
                className="input flex-1 py-1.5 text-sm"
                placeholder={`Step ${step.stepOrder} name (optional)`}
              />
              <select
                value={step.dependencyPolicy}
                onChange={(e) => updateStep(step.id, 'dependencyPolicy', e.target.value)}
                className="input py-1.5 text-xs w-36"
              >
                <option value="require_all">Require ALL</option>
                <option value="require_any">Require ANY</option>
              </select>
              {steps.length > 1 && (
                <button onClick={() => removeStep(step.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">Departments (parallel in this step)</label>
                {step.departmentIds.length > 0 && (
                  <span className="text-xs text-brand-600">{step.departmentIds.length} selected</span>
                )}
              </div>
              <input
                value={deptSearch[step.id] || ''}
                onChange={(e) => setDeptSearch((s) => ({ ...s, [step.id]: e.target.value }))}
                className="input text-xs py-1.5 mb-2"
                placeholder="Filter departments..."
              />
              <div className="flex flex-wrap gap-2">
                {filteredDepts(step.id).map((dept) => {
                  const selected = step.departmentIds.includes(dept.id)
                  return (
                    <button key={dept.id} onClick={() => toggleDept(step.id, dept.id)}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                        selected ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-700 border-gray-200 hover:border-brand-400'
                      )}>
                      {selected && <CheckIcon className="w-3 h-3" />}
                      {dept.name}
                    </button>
                  )
                })}
                {filteredDepts(step.id).length === 0 && (
                  <p className="text-xs text-gray-400">No departments found</p>
                )}
              </div>
              {step.departmentIds.length > 0 && (
                <div className="mt-2 flex items-center gap-1 flex-wrap">
                  <span className="text-xs text-gray-500">→</span>
                  {step.departmentIds.map((did) => (
                    <span key={did} className="badge-blue text-xs">{getDeptName(did)}</span>
                  ))}
                </div>
              )}
            </div>
            {idx < steps.length - 1 && <div className="text-center pb-2 text-gray-400 text-sm">↓</div>}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={addStep} className="btn-secondary">
          <PlusIcon className="w-4 h-4" /> Add Step
        </button>
        <button
          onClick={mode === 'edit' ? saveEditedRouting : saveNewRouting}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? 'Saving...' : mode === 'edit' ? 'Update Routing' : 'Save Draft'}
        </button>
        <button onClick={cancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Existing routings list */}
      {routings && routings.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold">Routing Versions</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {routings.map((r) => (
              <RoutingVersionRow
                key={r.id}
                routing={r}
                onPublish={() => publishRouting(r.id)}
                onEdit={() => requestEdit(r)}
                onTimeline={() => viewTimeline(r.id)}
                publishing={publishing === r.id}
                canEdit={canEdit}
              />
            ))}
          </div>
        </div>
      )}

      {/* Builder area */}
      {canEdit && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold">
              {mode === 'create' ? 'New Routing' : mode === 'edit' ? 'Edit Routing' : 'Routing'}
            </h3>
            {mode === 'idle' && !routings?.some((r) => r.status === 'active' || r.status === 'draft') && (
              <button onClick={() => setMode('create')} className="btn-primary btn-sm">
                <PlusIcon className="w-4 h-4" /> Create Routing
              </button>
            )}
          </div>
          {isBuilding && StepBuilder}
          {!isBuilding && routings?.every((r) => r.status === 'superseded' || r.status === 'archived') && (
            <div className="card-body">
              <p className="text-sm text-gray-500">All routings are superseded.</p>
            </div>
          )}
        </div>
      )}

      {/* Active flow */}
      {routings?.find((r) => r.status === 'active') && (
        <ActiveRoutingFlow routing={routings.find((r) => r.status === 'active')!} />
      )}

      {/* Edit warning modal */}
      <Modal
        open={editWarningOpen}
        onClose={() => setEditWarningOpen(false)}
        title="Warning: Editing Active Routing"
        footer={
          <>
            <button onClick={() => setEditWarningOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={confirmEdit} className="btn-danger">Proceed with Edit</button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <ExclamationTriangleIcon className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Routing modifications affect downstream departments</p>
              <p className="text-sm text-orange-700 mt-1">
                Editing the routing can disrupt tasks currently in progress. Only modify when absolutely necessary. All changes are recorded in the routing edit timeline.
              </p>
            </div>
          </div>
          <div>
            <label className="label">Reason for editing <span className="text-red-500">*</span></label>
            <textarea
              value={pendingEditReason}
              onChange={(e) => setPendingEditReason(e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder="Explain why this routing change is necessary..."
            />
          </div>
        </div>
      </Modal>

      {/* Timeline modal */}
      <Modal
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        title="Routing Edit Timeline"
        footer={<button onClick={() => setTimelineOpen(false)} className="btn-secondary">Close</button>}
      >
        {timeline.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No edits recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {timeline.map((entry) => (
              <div key={entry.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <ClockIcon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{entry.editor_name}</p>
                    <p className="text-xs text-gray-500">{entry.editor_email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtDateTime(entry.created_at)}</p>
                    <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-700"><span className="font-medium">Reason: </span>{entry.edit_reason}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

function RoutingVersionRow({
  routing, onPublish, onEdit, onTimeline, publishing, canEdit,
}: {
  routing: Routing; onPublish: () => void; onEdit: () => void;
  onTimeline: () => void; publishing: boolean; canEdit: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div>
      <div className="flex items-center gap-4 px-6 py-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">
              v{routing.version}{routing.name ? ` — ${routing.name}` : ''}
            </span>
            <span className={clsx(
              'badge text-xs',
              routing.status === 'active' ? 'badge-green' :
              routing.status === 'draft' ? 'badge-blue' : 'badge-gray'
            )}>
              {routing.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            By {routing.created_by_name} · {fmtDateTime(routing.created_at)}
            {routing.published_at && ` · Published ${fmtDateTime(routing.published_at)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <button onClick={() => setExpanded((e) => !e)} className="btn-secondary btn-sm">
            {expanded ? 'Hide' : 'View'} Steps
          </button>
          <button onClick={onTimeline} className="btn-secondary btn-sm" title="Edit Timeline">
            <ClockIcon className="w-3.5 h-3.5" />
          </button>
          {canEdit && (routing.status === 'draft' || routing.status === 'active') && (
            <button onClick={onEdit} className="btn-secondary btn-sm" title="Edit routing">
              <PencilIcon className="w-3.5 h-3.5" />
            </button>
          )}
          {canEdit && routing.status === 'draft' && (
            <button onClick={onPublish} disabled={publishing} className="btn-primary btn-sm">
              <PlayIcon className="w-3.5 h-3.5" />
              {publishing ? 'Publishing...' : 'Publish'}
            </button>
          )}
        </div>
      </div>
      {expanded && routing.steps && (
        <div className="px-6 pb-4 bg-gray-50">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {routing.steps.map((step, idx) => (
              <div key={step.id} className="flex items-center gap-2 flex-shrink-0">
                <div className="bg-white border border-gray-200 rounded-xl p-3 min-w-36">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="w-5 h-5 bg-brand-600 text-white rounded-full text-xs flex items-center justify-center">
                      {step.step_order}
                    </span>
                    {step.name && <span className="text-xs font-medium text-gray-700">{step.name}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {step.departments?.map((d) => (
                      <span key={d.id} className="badge-blue text-xs">{d.name}</span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {step.dependency_policy === 'require_all' ? '⚡ All' : '⚡ Any'}
                  </p>
                </div>
                {idx < routing.steps.length - 1 && <span className="text-gray-400 text-lg">→</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ActiveRoutingFlow({ routing }: { routing: Routing }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-green-700">Active Production Flow — v{routing.version}</h3>
      </div>
      <div className="card-body overflow-x-auto">
        <div className="flex items-start gap-4 min-w-max">
          {routing.steps?.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center mb-2">
                  {step.step_order}
                </div>
                <div className="bg-white border border-brand-200 rounded-xl p-3 min-w-32 text-center shadow-sm">
                  {step.name && <p className="text-xs font-medium text-gray-700 mb-2">{step.name}</p>}
                  <div className="flex flex-wrap gap-1 justify-center">
                    {step.departments?.map((d) => (
                      <span key={d.id} className="badge-blue text-xs whitespace-nowrap">{d.name}</span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {step.dependency_policy === 'require_all' ? 'All must complete' : 'Any can proceed'}
                  </p>
                </div>
              </div>
              {idx < routing.steps.length - 1 && <span className="text-2xl text-brand-400 mt-4">→</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
