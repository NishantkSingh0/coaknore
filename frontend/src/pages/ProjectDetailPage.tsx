import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ConfirmationModal from '../components/ui/ConfirmationModal'
import { PencilIcon, ChevronRightIcon, LockClosedIcon, PlusIcon } from '@heroicons/react/24/outline'
import { projectApi, routingApi } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../context/AuthContext'
import { fmtDate, fmtDateTime } from '../utils/helpers'
import { ProjectBadge } from '../components/ui/StatusBadge'
import RoutingBuilder from '../components/routing/RoutingBuilder'
import TaskBoard from '../components/tasks/TaskBoard'
import ProjectTimeline from '../components/project/ProjectTimeline'
import ProjectRevisionList from '../components/project/ProjectRevisionList'
import { usePreviewModal } from '../hooks/usePreviewModal'
import { clsx } from 'clsx'


type Tab = 'overview' | 'routing' | 'tasks' | 'timeline' | 'revisions'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isAdmin, isLayerTwo, isLayerThree } = useAuth()
  const storageKey = `project-tab-${id}`

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = sessionStorage.getItem(storageKey) as Tab | null
    return saved ?? 'overview'
  })
  const navigate = useNavigate()
  const [editConfirm, setEditConfirm] = useState(false)

  const { data: project, loading, refetch } = useAsync(() => projectApi.get(id!), [id])
  const { data: routings } = useAsync(() => routingApi.listForProject(id!), [id])
  const { data: restrictedProject } = useAsync(
    () => (isLayerThree && id ? projectApi.getRestricted(id) : Promise.resolve(null)),
    [id, isLayerThree]
  )
  console.log('restrictedProject', restrictedProject)
  console.log('routings', routings)
  console.log('project', project)
  const { openPreview } = usePreviewModal()


  useEffect(() => {
    sessionStorage.setItem(storageKey, activeTab)
  }, [storageKey, activeTab])
  
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!project) return <div className="text-center py-16 text-gray-400">Project not found</div>

  // Layer 3 only sees tasks tab (their own dept tasks via TaskBoard which restricts internally)
  const tabs: { key: Tab; label: string; adminOnly?: boolean; hideLayer3?: boolean }[] = [
    { key: 'overview', label: 'Overview', hideLayer3: true },
    { key: 'routing', label: 'Routing', hideLayer3: true },
    { key: 'tasks', label: 'Tasks' },
    { key: 'timeline', label: 'Timeline', hideLayer3: true },
    { key: 'revisions', label: `Revisions (${project.current_revision})`, hideLayer3: true },
  ]

  const visibleTabs = tabs.filter((t) => !(isLayerThree && t.hideLayer3))
  const specificationSections = [
    {
      title: 'Specifications',
      content: project?.specifications,
    },
    {
      title: 'Materials',
      content: project?.material_details,
    },
    {
      title: 'Upholstery',
      content: project?.upholstery_details,
    },
  ].filter((section) => section.content)
  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
              {project.po_number}
            </span>
            <ProjectBadge status={project.status} />
            {!isLayerThree && <span className="badge-gray">Rev {project.current_revision}</span>}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 truncate">{project.project_name}</h1>
          {!isLayerThree && (
            <p className="text-sm text-gray-500 mt-1">
              {project.client_name}
              {project.delivery_date && ` · Delivery: ${fmtDate(project.delivery_date)}`}
            </p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={() => setEditConfirm(true)}
            className="btn-secondary flex-shrink-0"
          >
            <PencilIcon className="w-4 h-4" />
            Edit
          </button>
        )}
      </div>

      {/* ── Drawing preview — always visible at top ───────────────────────── */}
      {project.drawing_file?.s3_url && (
        <div 
          className="relative group rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50 cursor-pointer"
          onClick={() => openPreview(project.drawing_file!.s3_url, project.drawing_file!.original_name)}
        >
          <img
            src={project.drawing_file.s3_url}
            alt="Project drawing"
            className="w-full max-h-72 object-contain transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
            <PlusIcon className="w-10 h-10 text-white" />
          </div>
          {project.drawing_file.original_name && (
            <p className="relative z-10 px-4 py-2 text-xs text-gray-500 border-t border-gray-100 bg-white">
              {project.drawing_file.original_name}
            </p>
          )}
        </div>
      )}

      {/* ── Layer 3 minimal view ──────────────────────────────────────────── */}
      {isLayerThree && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card p-4">
            <p className="text-xs text-gray-500 mb-0.5">PO Number</p>
            <p className="font-semibold text-gray-900">{project.po_number}</p>
          </div>
          {project.render_files_url && (
            <button
              type="button"
              onClick={() => openPreview(project.render_files_url!, 'Render Files')}
              className="card p-4 hover:bg-brand-50 transition-colors text-left cursor-pointer"
            >
              <p className="text-xs text-gray-500 mb-0.5">Render Files</p>
              <p className="text-sm font-medium text-brand-600 flex items-center gap-1">
                View Renders <ChevronRightIcon className="w-4 h-4" />
              </p>
            </button>
          )}

          {(restrictedProject as Record<string, any>)?.routed_to_dept_at && (
            <div className="card p-4">
              <p className="text-xs text-gray-500 mb-0.5">Routed to Department</p>
              <p className="font-semibold text-gray-900">{fmtDate((restrictedProject as Record<string, any>).routed_to_dept_at)}</p>
            </div>
          )}
          {(restrictedProject as Record<string, any>)?.expected_completion_date && (
            <div className="card p-4">
              <p className="text-xs text-gray-500 mb-0.5">Expected Completion Date</p>
              <p className="font-semibold text-gray-900">{(restrictedProject as Record<string, any>).expected_completion_date}</p>
              {(restrictedProject as Record<string, any>).completion_date_locked && (
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <LockClosedIcon className="w-3 h-3" /> Locked
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key) }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-black text-black font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Overview tab ──────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {project.cover_image_url && (
              <div 
                className="relative group overflow-hidden rounded-xl border border-gray-200 bg-gray-50 cursor-pointer"
                onClick={() => openPreview(project.cover_image_url!, 'Cover Image')}
              >
                <img src={project.cover_image_url} alt="cover"
                  className="w-full max-h-48 object-cover transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                  <PlusIcon className="w-10 h-10 text-white" />
                </div>
              </div>
            )}


            <div className="card">
              <div className="card-header"><h3 className="font-semibold">Project Details</h3></div>
              <div className="card-body grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Quantity', project.quantity],
                  ['Client', project.client_name],
                  ['Client Email', project.client_email || '—'],
                  ['Client Phone', project.client_phone || '—'],
                  ['Delivery Date', fmtDate(project.delivery_date)],
                  ['Created By', project.created_by_name],
                  ['Created', fmtDateTime(project.created_at)],
                  ['Last Updated', fmtDateTime(project.updated_at)],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="font-medium text-gray-900">{value as string}</p>
                  </div>
                ))}
              </div>
            </div>

            {specificationSections.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 className="font-semibold">Specifications</h3>
                </div>

                <div className="card-body">
                  <div
                    className={clsx(
                      "grid gap-8",
                      specificationSections.length === 1 && "grid-cols-1",
                      specificationSections.length === 2 && "grid-cols-1 md:grid-cols-2",
                      specificationSections.length >= 3 && "grid-cols-1 md:grid-cols-3"
                    )}
                  >
                    {specificationSections.map(({ title, content }) => (
                      <div key={title}>
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">
                          {title}
                        </h4>

                        <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                          {content!
                            .split("-")
                            .map((item) => item.trim())
                            .filter(Boolean)
                            .map((item, index) => (
                              <li key={index}>{item}</li>
                            ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            <div className="card">
              <div className="card-header"><h3 className="font-semibold">Documents</h3></div>
              <div className="card-body space-y-2">
                {[
                  ['CAD Files', project.cad_files_url],
                  ['Job Cards', project.job_cards_url],
                  ['Render Files', project.render_files_url],
                ].map(([label, url]) => url ? (
                  <button
                    key={label as string}
                    type="button"
                    onClick={() => openPreview(url as string, label as string)}
                    className="flex items-center justify-between text-sm text-brand-700 hover:underline py-1 w-full text-left cursor-pointer"
                  >
                    <span>{label as string}</span>
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                ) : (
                  <div key={label as string} className="flex items-center justify-between text-sm text-gray-400 py-1">
                    <span>{label as string}</span><span>—</span>
                  </div>
                ))}

              </div>
            </div>

            <div className="card">
              <div className="card-header flex items-center justify-between">
                <h3 className="font-semibold">Routing</h3>
                {(isAdmin || isLayerTwo) && (
                  <button onClick={() => setActiveTab('routing')} className="text-xs text-brand-600 hover:underline">
                    View all
                  </button>
                )}
              </div>
              <div className="card-body">
                {!routings?.length ? (
                  <p className="text-sm text-gray-400">No routing created yet</p>
                ) : (
                  <div className="space-y-2">
                    {routings.slice(0, 3).map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">v{r.version} {r.name}</span>
                        <span className={`badge-${r.status === 'active' ? 'green' : 'gray'}`}>{r.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'routing' && <RoutingBuilder projectId={id!} project={project} onPublish={refetch} />}
      {activeTab === 'tasks' && <TaskBoard projectId={id!} />}
      {activeTab === 'timeline' && <ProjectTimeline projectId={id!} />}
      {activeTab === 'revisions' && <ProjectRevisionList projectId={id!} />}
      <ConfirmationModal
        open={editConfirm}
        onClose={() => setEditConfirm(false)}
        onConfirm={() => {
          setEditConfirm(false)
          navigate(`/projects/${project.id}/edit`)
        }}
        title="Edit Project"
        message={`Are you sure you want to edit this project? Editing project details may affect ongoing workflows and routing!`}
        confirmText="Continue Editing"
        type="warning"
      />
    </div>
  )
}
