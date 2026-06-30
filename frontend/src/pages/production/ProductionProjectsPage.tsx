import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getProjects } from '../../api/projects'
import { ProjectCard } from '../../components/project/ProjectCard'
import { Spinner } from '../../components/common/Spinner'
import { EmptyState } from '../../components/common/EmptyState'
import { Search, Route } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/common/Button'

export const ProductionProjectsPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['projects', { search, status }],
    queryFn: () => getProjects({ search, status, limit: 50 }),
  })
  console.log("Data",data)

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">Projects</h2>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or PO…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="routing_set">Routing Set</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : !data?.projects?.length ? (
        <EmptyState title="No projects" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.projects.map(p => (
            <div key={p.id} className={`${status!="Pending"?"Hidden":"relative"}`}>
              <ProjectCard project={p} href={`/admin/projects/${p.id}`} />
              {/* Routing shortcut */}
              <Link
                to={`/production/projects/${p.id}/routing`}
                className="absolute bottom-3 right-3"
              >
                <Button variant="ghost" size="sm" icon={<Route size={14} />}>
                  Routing
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
