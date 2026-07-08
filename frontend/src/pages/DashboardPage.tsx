import { Link } from 'react-router-dom'
import {
  FolderIcon, ClipboardDocumentListIcon, ExclamationCircleIcon,
  ArrowPathIcon, CubeIcon, UserGroupIcon, BuildingOfficeIcon,
  CheckCircleIcon, ClockIcon, ExclamationTriangleIcon,
  ChartBarIcon, QueueListIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { searchApi, taskApi, reportApi, issueApi, reworkApi, materialApi } from '../services/api'
import { fmtDate, fmtRelative, taskStatusColor, taskStatusLabel, issueStatusColor } from '../utils/helpers'
import { ProjectBadge, IssueBadge, ReworkBadge } from '../components/ui/StatusBadge'
import clsx from 'clsx'

function StatCard({
  label, value, icon: Icon, color, to, subtitle
}: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>
  color: string; to: string; subtitle?: string
}) {
  return (
    <Link to={to} className="card p-5 hover:shadow-md transition-all hover:-translate-y-0.5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
    </Link>
  )
}

// ── Admin / Layer1 Dashboard ─────────────────────────────────────────────────

function AdminDashboard() {
  const { data: stats } = useAsync(() => searchApi.getDashboardStats(), [])
  const { data: recentIssues } = useAsync(() => issueApi.list({ page_size: 5 }), [])
  const { data: recentReports } = useAsync(() => reportApi.list({ page_size: 5 }), [])

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Projects"   value={stats.total_projects}     icon={FolderIcon}                  color="bg-blue-50 text-blue-600"   to="/projects" />
          <StatCard label="Active"           value={stats.active_projects}    icon={ClipboardDocumentListIcon}   color="bg-green-50 text-green-600" to="/projects?status=in_progress" />
          <StatCard label="Delayed"          value={stats.delayed_projects}   icon={ExclamationTriangleIcon}     color="bg-orange-50 text-orange-600" to="/projects" subtitle="Past due date" />
          <StatCard label="Completed"        value={stats.completed_projects} icon={CheckCircleIcon}             color="bg-emerald-50 text-emerald-600" to="/projects?status=completed" />
          <StatCard label="Open Issues"      value={stats.open_issues}        icon={ExclamationCircleIcon}       color="bg-red-50 text-red-600"     to="/issues" />
          <StatCard label="Pending Reworks"  value={stats.pending_reworks}    icon={ArrowPathIcon}               color="bg-purple-50 text-purple-600" to="/reworks?status=pending" />
          <StatCard label="Mat. Requests"    value={stats.pending_materials}  icon={CubeIcon}                    color="bg-yellow-50 text-yellow-600" to="/materials?status=pending" />
          <StatCard label="Employees"        value={stats.total_employees}    icon={UserGroupIcon}               color="bg-indigo-50 text-indigo-600" to="/employees" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Issues</h2>
            <Link to="/issues" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentIssues?.data?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400">No issues</p>
            ) : recentIssues?.data?.map((issue) => (
              <Link key={issue.id} to={`/issues/${issue.id}`}
                className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{issue.title}</p>
                  <p className="text-xs text-gray-500">{issue.department_name} · {fmtRelative(issue.created_at)}</p>
                </div>
                <IssueBadge status={issue.status} />
              </Link>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Reports</h2>
            <Link to="/reports" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentReports?.data?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400">No reports</p>
            ) : recentReports?.data?.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-2 px-6 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.project_name}</p>
                  <p className="text-xs text-gray-500 truncate">{r.dept_name} · {r.submitted_by_name}</p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{fmtDate(r.report_date)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Layer 2 Dashboard ────────────────────────────────────────────────────────

function Layer2Dashboard() {
  const { data: pendingIssues } = useAsync(() => issueApi.list({ page_size: 8, status: 'open' }), [])
  const { data: pendingReworks } = useAsync(() => reworkApi.list({ page_size: 8, status: 'pending' }), [])
  const { data: pendingMaterials } = useAsync(() => materialApi.list({ page_size: 8, status: 'pending' }), [])
  const { data: recentReports } = useAsync(() => reportApi.list({ page_size: 6 }), [])

  const approvalCount =
    (pendingIssues?.data?.length || 0) +
    (pendingReworks?.data?.length || 0) +
    (pendingMaterials?.data?.length || 0)

  return (
    <div className="space-y-6">
      {/* Approval queue summary */}
      {approvalCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <QueueListIcon className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {approvalCount} item{approvalCount !== 1 ? 's' : ''} awaiting your review
            </p>
            <p className="text-xs text-amber-700">
              {pendingIssues?.data?.length || 0} issues ·{' '}
              {pendingReworks?.data?.length || 0} reworks ·{' '}
              {pendingMaterials?.data?.length || 0} material requests
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Issues awaiting approval */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Issues to Review</h2>
            <Link to="/issues?status=open" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingIssues?.data?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400">No issues pending review</p>
            ) : pendingIssues?.data?.map((issue) => (
              <Link key={issue.id} to={`/issues/${issue.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{issue.title}</p>
                  <p className="text-xs text-gray-500">{issue.department_name} · {fmtRelative(issue.created_at)}</p>
                </div>
                <IssueBadge status={issue.status} />
              </Link>
            ))}
          </div>
        </div>

        {/* Reworks awaiting approval */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Reworks to Approve</h2>
            <Link to="/reworks?status=pending" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingReworks?.data?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400">No pending reworks</p>
            ) : pendingReworks?.data?.map((rework) => (
              <div key={rework.id} className="flex items-start gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{rework.reason}</p>
                  <p className="text-xs text-gray-500">
                    {rework.requesting_dept_name} → {rework.target_dept_name}
                  </p>
                  <p className="text-xs text-gray-400">{fmtRelative(rework.created_at)}</p>
                </div>
                <ReworkBadge status={rework.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Material requests */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Material Requests</h2>
            <Link to="/materials?status=pending" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingMaterials?.data?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400">No pending requests</p>
            ) : pendingMaterials?.data?.map((m) => (
              <div key={m.id} className="flex items-start gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.title}</p>
                  <p className="text-xs text-gray-500">{m.dept_name} · {fmtRelative(m.created_at)}</p>
                </div>
                <span className="badge-yellow">pending</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Production Feed */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Latest Reports</h2>
            <Link to="/reports" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentReports?.data?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400">No reports yet</p>
            ) : recentReports?.data?.map((r) => (
              <div key={r.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium truncate">{r.project_name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{fmtDate(r.report_date)}</span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{r.description}</p>
                <p className="text-xs text-gray-400 mt-1">{r.dept_name} · {r.submitted_by_name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Layer 3 Dashboard ────────────────────────────────────────────────────────

function Layer3Dashboard() {
  const { data: myTasksData } = useAsync(
    () => taskApi.getMyTasks({ page_size: 8 }), []
  )
  const { data: issuesData } = useAsync(
    () => issueApi.list({ page_size: 5 }), []
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My active tasks */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">My Tasks</h2>
            <Link to="/tasks" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {myTasksData?.data?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400">No tasks assigned</p>
            ) : myTasksData?.data?.map((task) => {
              const completedSubs = task.subtasks?.filter((s) => s.status === 'completed').length || 0
              const totalSubs = task.subtasks?.length || 0
              return (
                <Link key={task.id} to={`/tasks/${task.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title || task.department_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                        taskStatusColor[task.status])}>
                        {taskStatusLabel[task.status]}
                      </span>
                      {task.due_date && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <ClockIcon className="w-3 h-3" />
                          {fmtDate(task.due_date)}
                        </span>
                      )}
                    </div>
                    {totalSubs > 0 && (
                      <div className="mt-1.5 w-full bg-gray-100 rounded-full h-1">
                        <div className="bg-brand-500 rounded-full h-1 transition-all"
                          style={{ width: `${(completedSubs / totalSubs) * 100}%` }} />
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* My department issues */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">My Issues</h2>
            <Link to="/issues" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {issuesData?.data?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400">No issues raised</p>
            ) : issuesData?.data?.map((issue) => (
              <Link key={issue.id} to={`/issues/${issue.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{issue.title}</p>
                  <p className="text-xs text-gray-500">{fmtRelative(issue.created_at)}</p>
                </div>
                <IssueBadge status={issue.status} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Root Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isAdmin, isLayerTwo, isLayerThree } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good day, {user?.first_name} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {user?.department_name
            ? `${user.department_name} · `
            : ''}
          {user?.layer === 'super_admin' ? 'Super Admin'
            : user?.layer === 'layer1' ? 'Admin'
            : user?.layer === 'layer2' ? 'Production Management'
            : 'Execution'}
        </p>
      </div>

      {isAdmin        && <AdminDashboard />}
      {isLayerTwo     && <Layer2Dashboard />}
      {isLayerThree   && <Layer3Dashboard />}
    </div>
  )
}
