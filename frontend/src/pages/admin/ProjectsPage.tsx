import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getProjects } from '../../api/projects'
import { ProjectCard } from '../../components/project/ProjectCard'
import { Button } from '../../components/common/Button'
import { Input, Select } from '../../components/common/Input'
import { Modal } from '../../components/common/Modal'
import { ProjectForm } from '../../components/project/ProjectForm'
import { Spinner } from '../../components/common/Spinner'
import { EmptyState } from '../../components/common/EmptyState'
import { Plus, Search } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'routing_set', label: 'Routing Set' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
]

export const ProjectsPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['projects', { search, status, page }],
    queryFn: () => getProjects({ search, status, page, limit: 20 }),
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Projects</h2>
        <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
          New Project
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by name or PO…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : !data?.projects?.length ? (
        <EmptyState
          title="No projects found"
          description="Try adjusting your filters or create a new project."
          action={<Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>New Project</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.projects.map(p => (
              <ProjectCard key={p.id} project={p} href={`/admin/projects/${p.id}`} />
            ))}
          </div>

          {/* Pagination */}
          {data.total > 20 && (
            <div className="flex items-center justify-between pt-2 text-sm">
              <span className="text-gray-500">
                Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}
                  disabled={page * 20 >= data.total}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Project" size="xl">
        <ProjectForm
          mode="create"
          onSuccess={() => setShowCreate(false)}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>
    </div>
  )
}
