import { useState, useEffect } from 'react'
import { PlusIcon, PaperClipIcon } from '@heroicons/react/24/outline'
import { reportApi, projectApi } from '../services/api'
import { useAsync, useAsyncAction } from '../hooks/useAsync'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../utils/helpers'
import Modal from '../components/ui/Modal'
import toast from 'react-hot-toast'
import type { Project } from '../types'

export default function ReportsPage() {
  const { isLayerThree } = useAuth()
  const [page, setPage] = useState(1)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [form, setForm] = useState({ project_id: '', description: '', report_date: '' })
  const [projectSearch, setProjectSearch] = useState('')
  const [projectResults, setProjectResults] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const { execute, loading: actLoading } = useAsyncAction()

  const { data, loading, refetch } = useAsync(
    () => reportApi.list({ page, page_size: 20 }),
    [page]
  )

  // Project search for the modal
  useEffect(() => {
    if (projectSearch.length < 2) { setProjectResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await projectApi.list({ search: projectSearch, page_size: 5 })
        setProjectResults(res.data || [])
      } catch { setProjectResults([]) }
    }, 300)
    return () => clearTimeout(timer)
  }, [projectSearch])

  const handleSubmit = async () => {
    if (!selectedProject || !form.description) {
      toast.error('Project and description are required'); return
    }
    const ok = await execute(() =>
      reportApi.create({ ...form, project_id: selectedProject.id })
    )
    if (ok !== null) {
      toast.success('Report submitted')
      setSubmitOpen(false)
      setForm({ project_id: '', description: '', report_date: '' })
      setSelectedProject(null)
      setProjectSearch('')
      refetch()
    }
  }

  const openModal = () => {
    setForm({ project_id: '', description: '', report_date: new Date().toISOString().split('T')[0] })
    setSelectedProject(null)
    setProjectSearch('')
    setSubmitOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Daily Reports</h1>
        {isLayerThree && (
          <button onClick={openModal} className="btn-primary">
            <PlusIcon className="w-4 h-4" /> Submit Report
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {data?.data?.length === 0 && (
            <div className="card p-8 text-center text-gray-400 text-sm">No reports yet</div>
          )}
          {data?.data?.map((report) => (
            <div key={report.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{report.project_name}</span>
                    <span className="badge-blue">{report.dept_name}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{report.description}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    By {report.submitted_by_name} · {fmtDate(report.report_date)}
                  </p>
                </div>
                {report.files && report.files.length > 0 && (
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {report.files.map((f) => (
                      <a key={f.id} href={f.s3_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
                        <PaperClipIcon className="w-3 h-3" /> {f.original_name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary btn-sm">Previous</button>
          <span className="text-sm text-gray-500">Page {page} of {data.total_pages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.total_pages} className="btn-secondary btn-sm">Next</button>
        </div>
      )}

      <Modal open={submitOpen} onClose={() => setSubmitOpen(false)} title="Submit Daily Report" size="lg"
        footer={
          <>
            <button onClick={() => setSubmitOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSubmit} disabled={actLoading} className="btn-primary">
              {actLoading ? 'Submitting...' : 'Submit Report'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Project selector */}
          <div>
            <label className="label">Project <span className="text-red-500">*</span></label>
            {selectedProject ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-200 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedProject.project_name}</p>
                  <p className="text-xs text-gray-500">PO: {selectedProject.po_number}</p>
                </div>
                <button onClick={() => { setSelectedProject(null); setProjectSearch('') }}
                  className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Search project by name or PO..."
                  className="input"
                />
                {projectResults.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {projectResults.map((p) => (
                      <button key={p.id}
                        onClick={() => { setSelectedProject(p); setProjectSearch(''); setProjectResults([]) }}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex flex-col">
                        <span className="text-sm font-medium">{p.project_name}</span>
                        <span className="text-xs text-gray-500">PO: {p.po_number} · {p.client_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="label">Report Date</label>
            <input type="date" value={form.report_date}
              onChange={(e) => setForm((f) => ({ ...f, report_date: e.target.value }))}
              className="input" />
          </div>

          <div>
            <label className="label">Work Done Today <span className="text-red-500">*</span></label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={5} className="input resize-none"
              placeholder="Describe what work was completed today, any progress made, materials used, etc."
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
