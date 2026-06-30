import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getLayer2Dashboard } from '../../api/dashboard'
import { Spinner } from '../../components/common/Spinner'
import { Badge } from '../../components/common/Badge'
import { DailyReportCard } from '../../components/reports/DailyReportCard'
import { EmptyState } from '../../components/common/EmptyState'
import { Link } from 'react-router-dom'
import { formatDate } from '../../utils'
import { AlertCircle, FileText } from 'lucide-react'
import type { DailyReport } from '../../types'

export const ProductionDashboard: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'layer2'],
    queryFn: getLayer2Dashboard,
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-700">
        Failed to load dashboard. Please refresh.
      </div>
    )
  }

  const todayReports: DailyReport[] = Array.isArray(data?.today_reports) ? data.today_reports : []
  const pendingIssues: any[] = Array.isArray(data?.pending_issues) ? data.pending_issues : []

  return (
    <div className="space-y-8">

      {/* Pending Issues */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle size={20} className={`${pendingIssues.length === 0 ?"hidden":"text-red-500"}`} />
          <h3 className="text-lg font-bold text-gray-900">
            Pending Issues ({pendingIssues.length})
          </h3>
        </div>

        {pendingIssues.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 flex items-center gap-2">
            <span>✓</span> No pending issues — all clear
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dept</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Raised</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingIssues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{issue.project_name}</td>
                    <td className="px-5 py-3 text-gray-600 capitalize">
                      {String(issue.issue_type ?? '').replace(/_/g, ' ')}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{issue.dept_name}</td>
                    <td className="px-5 py-3">
                      <Badge status={issue.status} variant="issue" />
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(issue.created_at)}</td>
                    <td className="px-5 py-3">
                      <Link
                        to="/production/issues"
                        className="text-xs text-indigo-600 hover:underline font-medium"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Today's Reports */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FileText size={20} className="text-indigo-500" />
          <h3 className="text-lg font-bold text-gray-900">
            Today's Reports ({todayReports.length})
          </h3>
        </div>

        {todayReports.length === 0 ? (
          <EmptyState
            title="No reports today"
            description="Reports submitted today by departments will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayReports.map((r) => (
              <DailyReportCard key={r.id} report={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
