import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAdminDashboard } from '../../api/dashboard'
import { Spinner } from '../../components/common/Spinner'
import { Badge } from '../../components/common/Badge'
import { formatDate, formatCurrency } from '../../utils'
import { Link } from 'react-router-dom'
import {
  FolderKanban, AlertCircle, Clock, Users, FileText, TrendingUp,
} from 'lucide-react'

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
    <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  </div>
)

export const AdminDashboard: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: getAdminDashboard,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-700">
        Failed to load dashboard. Please refresh.
      </div>
    )
  }

  // Safe extraction — data could be undefined or null on edge cases
  const stats = data?.stats ?? {}
  const recentProjects: any[] = Array.isArray(data?.recent_projects) ? data.recent_projects : []

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Admin Overview</h2>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Projects"
          value={stats.total_projects ?? 0}
          icon={<FolderKanban size={22} className="text-indigo-600" />}
          color="bg-indigo-50"
        />
        <StatCard
          label="Active"
          value={stats.active_projects ?? 0}
          icon={<TrendingUp size={22} className="text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          label="Open Issues"
          value={stats.open_issues ?? 0}
          icon={<AlertCircle size={22} className="text-amber-600" />}
          color="bg-amber-50"
        />
        <StatCard
          label="Overdue Tasks"
          value={stats.overdue_tasks ?? 0}
          icon={<Clock size={22} className="text-red-600" />}
          color="bg-red-50"
        />
        <StatCard
          label="Employees"
          value={stats.total_employees ?? 0}
          icon={<Users size={22} className="text-teal-600" />}
          color="bg-teal-50"
        />
        <StatCard
          label="Completed"
          value={stats.completed_projects ?? 0}
          icon={<FolderKanban size={22} className="text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          label="Today Reports"
          value={stats.today_reports ?? 0}
          icon={<FileText size={22} className="text-purple-600" />}
          color="bg-purple-50"
        />
        <StatCard
          label="Pending"
          value={stats.pending_projects ?? 0}
          icon={<Clock size={22} className="text-gray-500" />}
          color="bg-gray-100"
        />
      </div>

      {/* Recent projects table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Recent Projects</h3>
          <Link
            to="/admin/projects"
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            View all →
          </Link>
        </div>

        {recentProjects.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No projects yet —{' '}
            <Link to="/admin/projects" className="text-indigo-600 hover:underline">
              create the first one
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    PO #
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Project Name
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentProjects.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => window.location.assign(`/admin/projects/${p.id}`)}
                  >
                    <td className="px-5 py-3 font-mono text-indigo-600 text-xs font-semibold">
                      #{p.po_number}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {p.project_name}
                    </td>
                    <td className="px-5 py-3">
                      <Badge status={p.current_status} />
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {formatDate(p.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
