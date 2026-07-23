import { useState, type DragEvent } from 'react'
import {
  PlusIcon, TrashIcon, CheckIcon, PlayIcon,
  PencilIcon, ClockIcon, ExclamationTriangleIcon,
  Bars3Icon, ChevronUpIcon, ChevronDownIcon,
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
  requireAll: boolean
  departmentIds: string[]
}

const newStep = (order: number): StepDraft => ({
  id: crypto.randomUUID(),
  stepOrder: order,
  requireAll: true,
  departmentIds: [],
})

export default function RoutingBuilder({
  projectId, project, onPublish,
}: {
  projectId: string; project: Project; onPublish?: () => void
}) {
  const { isLayerTwo, isAdmin } = useAuth()
  const [viewRouting, setViewRouting] = useState<Routing | null>(null)
  const canEdit = isLayerTwo || isAdmin

  const { data: routings, refetch: refetchRoutings } = useAsync(
    () => routingApi.listForProject(projectId), [projectId]
  )
  const { data: allDepts } = useAsync(() => orgApi.listDepartments('layer3'), [])

  const [steps, setSteps] = useState<StepDraft[]>([newStep(1)])
  const [routingName, setRoutingName] = useState('')

  // Drag-and-drop step reordering
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null)
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null)

  // Modes: 'idle' | 'create' | 'edit'
  const [mode, setMode] = useState<'idle' | 'create' | 'edit'>('idle')
  const [editingRoutingId, setEditingRoutingId] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)

  // Timeline
  const [timelineRoutingId, setTimelineRoutingId] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<RoutingEditTimeline[]>([])
  const [timelineOpen, setTimelineOpen] = useState(false)

  // Edit confirmation modal
  const [editWarningOpen, setEditWarningOpen] = useState(false)
  const [pendingEditReason, setPendingEditReason] = useState('')
  const [pendingEditRoutingId, setPendingEditRoutingId] = useState<string | null>(null)

  // Create/save confirmation modal
  const [saveWarningOpen, setSaveWarningOpen] = useState(false)

  const addStep = () => setSteps((s) => [...s, newStep(s.length + 1)])
  const removeStep = (id: string) =>
    setSteps((s) => s.filter((x) => x.id !== id).map((x, i) => ({ ...x, stepOrder: i + 1 })))

  const toggleDept = (stepId: string, deptId: string) => {
    setSteps((s) =>
      s.map((step) => {
        if (step.id !== stepId) return step
        const has = step.departmentIds.includes(deptId)
        const departmentIds = has ? step.departmentIds.filter((d) => d !== deptId) : [...step.departmentIds, deptId]
        // Dependency policy only matters once 2+ departments are in the same step;
        // default back to "require all" whenever it drops below that.
        return {
          ...step,
          departmentIds,
          requireAll: departmentIds.length >= 2 ? step.requireAll : true,
        }
      })
    )
  }

  const toggleRequireAll = (id: string) => {
    setSteps((s) => s.map((step) => (step.id === id ? { ...step, requireAll: !step.requireAll } : step)))
  }

  // Reassigns stepOrder to match each step's position in the array (1-based)
  const renumberSteps = (list: StepDraft[]) => list.map((s, i) => ({ ...s, stepOrder: i + 1 }))

  // Moves the step with `fromId` to sit where `toId` currently is
  const reorderSteps = (fromId: string, toId: string) => {
    if (fromId === toId) return
    setSteps((prev) => {
      const fromIdx = prev.findIndex((s) => s.id === fromId)
      const toIdx = prev.findIndex((s) => s.id === toId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const updated = [...prev]
      const [moved] = updated.splice(fromIdx, 1)
      updated.splice(toIdx, 0, moved)
      return renumberSteps(updated)
    })
  }

  // Nudges a step one position up/down — a keyboard/touch-friendly fallback to dragging
  const moveStep = (id: string, direction: -1 | 1) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id)
      const targetIdx = idx + direction
      if (idx === -1 || targetIdx < 0 || targetIdx >= prev.length) return prev
      const updated = [...prev]
      ;[updated[idx], updated[targetIdx]] = [updated[targetIdx], updated[idx]]
      return renumberSteps(updated)
    })
  }

  const handleStepDragStart = (e: DragEvent<HTMLSpanElement>, id: string) => {
    setDraggedStepId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleStepDragOver = (e: DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverStepId !== id) setDragOverStepId(id)
  }

  const handleStepDrop = (e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault()
    if (draggedStepId) reorderSteps(draggedStepId, targetId)
    setDraggedStepId(null)
    setDragOverStepId(null)
  }

  const handleStepDragEnd = () => {
    setDraggedStepId(null)
    setDragOverStepId(null)
  }

  const getDeptName = (id: string) => allDepts?.find((d) => d.id === id)?.name || id

  // Builds a cumulative "Assembly → Carpentry → Design → Inventory + Polishing" style label
  // for all steps up to and including the given index.
  const getCumulativeLabel = (uptoIdx: number) => {
    return steps
      .slice(0, uptoIdx + 1)
      .map((s) => s.departmentIds.map((id) => getDeptName(id)).join(' + '))
      .filter(Boolean)
      .join(' → ')
  }

  const loadStepsFromRouting = (routing: Routing) => {
    setRoutingName(routing.name || '')
    setSteps(
      (routing.steps || []).map((s) => ({
        id: crypto.randomUUID(),
        stepOrder: s.step_order,
        requireAll: s.dependency_policy === 'require_all',
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
          dependency_policy: s.requireAll ? 'require_all' : 'require_any',
          department_ids: s.departmentIds,
        })),
      })
      toast.success('Routing saved as draft, Ensure to Publish it over all Departments!')
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
          dependency_policy: s.requireAll ? 'require_all' : 'require_any',
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
      toast.success('Routing published, tasks generated')
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

  // Trigger warning modal before actually saving a brand new routing
  const requestSaveNew = () => {
    for (const step of steps) {
      if (step.departmentIds.length === 0) {
        toast.error(`Step ${step.stepOrder} must have at least one department`)
        return
      }
    }
    setSaveWarningOpen(true)
  }

  const confirmSaveNew = async () => {
    setSaveWarningOpen(false)
    await saveNewRouting()
  }

  const isBuilding = mode === 'create' || mode === 'edit'

  // ── Step builder UI (shared between create and edit) — compact, click-and-continue ──
  const StepBuilder = (
    <div className="card-body space-y-3">
      <input
        value={routingName}
        onChange={(e) => setRoutingName(e.target.value)}
        className="input max-w-sm text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
        placeholder="Routing name (optional)"
      />

      <div className="space-y-2">
        {steps.map((step, idx) => {
          const isDragging = draggedStepId === step.id
          const isDropTarget = !!draggedStepId && draggedStepId !== step.id && dragOverStepId === step.id
          return (
            <div
              key={step.id}
              onDragOver={(e) => handleStepDragOver(e, step.id)}
              onDrop={(e) => handleStepDrop(e, step.id)}
              className={clsx(
                'border rounded-lg overflow-hidden transition-colors',
                isDragging && 'opacity-50',
                isDropTarget
                  ? 'border-black dark:border-white ring-2 ring-black/10 dark:ring-white/10'
                  : 'border-gray-200 dark:border-gray-700'
              )}
            >
              <div className="bg-gray-50 dark:bg-gray-800 px-3 py-2.5 flex items-center gap-2.5">
                {/* Drag handle + up/down reorder controls */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <span
                    draggable
                    onDragStart={(e) => handleStepDragStart(e, step.id)}
                    onDragEnd={handleStepDragEnd}
                    className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 select-none"
                    title="Drag to reorder"
                  >
                    <Bars3Icon className="w-4 h-4" />
                  </span>
                  <div className="flex flex-col -space-y-1">
                    <button
                      type="button"
                      onClick={() => moveStep(step.id, -1)}
                      disabled={idx === 0}
                      className="text-gray-400 hover:text-black dark:hover:text-white disabled:opacity-25 disabled:hover:text-gray-400 dark:disabled:hover:text-gray-500"
                      title="Move step up"
                    >
                      <ChevronUpIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStep(step.id, 1)}
                      disabled={idx === steps.length - 1}
                      className="text-gray-400 hover:text-black dark:hover:text-white disabled:opacity-25 disabled:hover:text-gray-400 dark:disabled:hover:text-gray-500"
                      title="Move step down"
                    >
                      <ChevronDownIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="w-7 h-7 rounded-full bg-black dark:bg-white dark:text-black text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                  {step.stepOrder}
                </div>

                {/* Require All / Any toggle — only relevant (and shown) once 2+ departments are picked */}
                <div
                  className={clsx(
                    'flex items-center gap-1.5 flex-shrink-0 overflow-hidden transition-all duration-300 ease-out',
                    step.departmentIds.length >= 2
                      ? 'max-w-[8rem] opacity-100 scale-100'
                      : 'max-w-0 opacity-0 scale-95 pointer-events-none'
                  )}
                >
                  <span className={clsx('text-xs font-semibold whitespace-nowrap', step.requireAll ? 'text-black dark:text-white' : 'text-gray-400 dark:text-gray-500')}>
                    ALL
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleRequireAll(step.id)}
                    className={clsx(
                      'relative inline-flex items-center h-5 w-9 rounded-full transition-colors flex-shrink-0',
                      step.requireAll ? 'bg-black dark:bg-gray-500' : 'bg-gray-300 dark:bg-gray-600'
                    )}
                    title={step.requireAll ? 'Require ALL departments — click to switch to ANY' : 'Require ANY department — click to switch to ALL'}
                    aria-pressed={!step.requireAll}
                  >
                    <span
                      className={clsx(
                        'inline-block h-4 w-4 rounded-full bg-white dark:bg-gray-100 shadow transform transition-transform',
                        step.requireAll ? 'translate-x-0.5' : 'translate-x-[1.125rem]'
                      )}
                    />
                  </button>
                  <span className={clsx('text-xs font-semibold whitespace-nowrap', !step.requireAll ? 'text-black dark:text-white' : 'text-gray-400 dark:text-gray-500')}>
                    ANY
                  </span>
                </div>

                <div className="flex-1 flex flex-wrap gap-1.5">
                  {(allDepts || []).filter((d) => d.is_active).map((dept) => {
                    const selected = step.departmentIds.includes(dept.id)
                    return (
                      <button key={dept.id} onClick={() => toggleDept(step.id, dept.id)}
                        className={clsx(
                            'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors border',
                            selected
                              ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                              : 'bg-white dark:bg-gray-900 dark:text-gray-200 dark:border-gray-600 text-gray-700 border-gray-200 hover:border-black dark:hover:border-gray-300'
                          )}>
                        {selected && <CheckIcon className="w-3.5 h-3.5" />}
                        {dept.name}
                      </button>
                    )
                  })}
                </div>

                {steps.length > 1 && (
                  <button onClick={() => removeStep(step.id)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-md flex-shrink-0">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Cumulative routing summary so far */}
              {getCumulativeLabel(idx) && (
                <div className="px-3 py-2 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {getCumulativeLabel(idx)}
                  </p>
                </div>
              )}

              {/* {idx < steps.length - 1 && <div className="text-center py-1 text-gray-400 dark:text-gray-500 text-sm">↓</div>} */}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={addStep} className="btn-secondary btn-sm">
          <PlusIcon className="w-4 h-4" /> Add Step
        </button>
        <button
          onClick={mode === 'edit' ? saveEditedRouting : requestSaveNew}
          disabled={saving}
          className="btn-primary btn-sm"
        >
          {saving ? 'Saving...' : mode === 'edit' ? 'Update' : 'Save'}
        </button>
        <button onClick={cancel} className="btn-ghost btn-sm">Cancel</button>
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
                viewing={viewRouting?.id === r.id}
                onView={() => {
                  if (viewRouting?.id === r.id) {
                    setViewRouting(null)
                  } else {
                    setViewRouting(r)

                    setTimeout(() => {
                      document
                        .getElementById("active-production-flow")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        })
                    }, 0)
                  }
                }}
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

      {/* Active flow */}
      {viewRouting && (
        <ActiveRoutingFlow routing={viewRouting} />
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
          <div className="flex gap-3 p-4 bg-orange-50 dark:bg-orange-900 border border-orange-200 rounded-xl">
            <ExclamationTriangleIcon className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">Routing modifications affect downstream departments</p>
              <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
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

      {/* Save (create) confirmation modal */}
      <Modal
        open={saveWarningOpen}
        onClose={() => setSaveWarningOpen(false)}
        title="Sure about this Routing?"
        footer={
          <>
            <button onClick={() => setSaveWarningOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={confirmSaveNew} disabled={saving} className="btn-danger">
              {saving ? 'Saving...' : 'Yes, Save Routing'}
            </button>
          </>
        }
      >
        <div className="flex gap-3 p-4 bg-orange-50 dark:bg-orange-900 border border-orange-200 rounded-xl">
          <ExclamationTriangleIcon className="w-6 h-6 text-orange-500 dark:text-orange-200 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">Changing this later can cause problems</p>
            <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
              Once tasks are generated from this routing, editing it can disrupt work already in progress. Try to Raise Re-Routing Minimal.
            </p>
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
  routing,
  viewing,
  onView,
  onPublish,
  onEdit,
  onTimeline,
  publishing,
  canEdit,
}: {
  routing: Routing
  viewing: boolean
  onView: () => void
  onPublish: () => void
  onEdit: () => void
  onTimeline: () => void
  publishing: boolean
  canEdit: boolean
}) {
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
          <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">
            By {routing.created_by_name} · {fmtDateTime(routing.created_at)}
            {routing.published_at && ` · Published ${fmtDateTime(routing.published_at)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <button
            onClick={onView}
            className={clsx(
              "btn-sm",
              viewing ? "btn-primary" : "btn-secondary"
            )}
          >
            {viewing ? "Hide Routing" : "View Routing"}
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
    </div>
  )
}

function ActiveRoutingFlow({ routing }: { routing: Routing }) {
  return (
    <div id="active-production-flow" className="card">
      <div className="card-header">
        <h3 className="font-semibold text-green-700 dark:text-green-500">Active Production Flow  (v{routing.version})</h3>
      </div>
      <div className="card-body overflow-x-auto">
        <div className="flex items-start gap-4 min-w-max">
          {routing.steps?.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-black text-white text-sm font-bold flex items-center justify-center mb-2">
                  {step.step_order}
                </div>
                <div className="bg-white dark:bg-gray-800/10 border border-brand-200 dark:border-brand-600 rounded-xl p-3 min-w-32 text-center shadow-sm">
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