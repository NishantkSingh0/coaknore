import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getProject, getRouting } from '../../api/projects'
import { RoutingBuilder } from '../../components/project/RoutingBuilder'
import { Badge } from '../../components/common/Badge'
import { Spinner } from '../../components/common/Spinner'
import { ArrowLeft } from 'lucide-react'

export const RoutingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

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

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-3xl space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {project && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-mono text-indigo-600">#{project.po_number}</span>
            <Badge status={project.current_status} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{project.project_name}</h2>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Set Department Routing</h3>
        <RoutingBuilder
          projectId={id!}
          existingRouting={routing}
          onSaved={() => navigate('/production/projects')}
        />
      </div>
    </div>
  )
}
