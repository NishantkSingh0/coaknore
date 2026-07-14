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

const getGreeting = () => {
  const hour = new Date().getHours()

  if (hour >= 5 && hour < 12) return "Good Morning"
  if (hour >= 12 && hour < 17) return "Good Afternoon"
  if (hour >= 17 && hour < 21) return "Good Evening"
  return "Good Night"
}

const motivationalQuotes = [
  "Precision today becomes perfection tomorrow.",
  "Every masterpiece begins with disciplined craftsmanship.",
  "Quality is remembered long after speed is forgotten.",
  "Luxury is built through consistency, not shortcuts.",
  "Every component reflects our commitment to excellence.",
  "Great products are created by great teams.",
  "Craft every detail with pride.",
  "Excellence is a habit, not an achievement.",
  "Small improvements create extraordinary products.",
  "The finest furniture begins with the finest effort.",
  "Build with precision. Deliver with pride.",
  "Your craftsmanship defines our reputation.",
  "Attention to detail creates timeless products.",
  "Every project is an opportunity to exceed expectations.",
  "Discipline transforms materials into masterpieces.",
  "Success is measured in quality, not quantity.",
  "Today's effort becomes tomorrow's legacy.",
  "Innovation begins on the workshop floor.",
  "Work with purpose. Build with passion.",
  "Perfection is achieved through continuous improvement.",
  "Strong teams create exceptional products.",
  "A single detail can define the entire experience.",
  "Commitment is visible in every finished piece.",
  "Manufacturing excellence starts with personal excellence.",
  "Every challenge is an opportunity to improve.",
  "Take ownership of every task you complete.",
  "Reliable work builds lasting trust.",
  "Precision is the language of luxury.",
  "Every finished product carries your signature.",
  "Success comes from doing ordinary work extraordinarily well.",
  "Your dedication shapes the company's future.",
  "Progress is built one quality task at a time.",
  "Excellence leaves no room for compromise.",
  "Consistency creates confidence.",
  "A better process creates a better product.",
  "Every cut, every finish, every detail matters.",
  "Luxury is engineered through discipline.",
  "The strongest foundation is built with teamwork.",
  "Today's craftsmanship becomes tomorrow's customer satisfaction.",
  "Every improvement strengthens the organization.",
  "Think beyond completion, think perfection.",
  "True professionals never stop learning.",
  "Lead through action and quality.",
  "Focus on solutions, not obstacles.",
  "Great manufacturing begins with great responsibility.",
  "The best products are built with patience.",
  "Quality is everyone's responsibility.",
  "Together we transform ideas into reality.",
  "Be proud of what you build today.",
  "Excellence starts with you.",
  "Every joint you fit is a promise you keep.",
  "Fine grain deserves a finer hand.",
  "The polish shows, but the prep is what lasts.",
  "Measure with care, cut with confidence.",
  "A well-sanded edge speaks before the customer touches it.",
  "Your patience today is someone's heirloom tomorrow.",
  "The workshop rewards those who slow down to speed up.",
  "No shortcut ever built a legacy piece.",
  "Craft it as if your name goes on the tag.",
  "The client sees the finish; we know the effort beneath it.",
  "Every sample board is a small promise of quality.",
  "Real luxury is invisible flaws, not visible shortcuts.",
  "A steady hand today saves a costly fix tomorrow.",
  "Great furniture starts with a great attitude.",
  "Treat every plank like it's going into a showroom.",
  "The finish is only as good as the honesty behind it.",
  "Small hands, big impact, every worker shapes the brand.",
  "We don't build furniture, we build trust in wood and metal.",
  "Craftsmanship is quiet, but its results speak loudly.",
  "Every measurement matters more than it seems.",
  "One flawless piece builds ten new customers.",
  "The team that checks twice, ships once.",
  "Pride in process becomes pride in product.",
  "Excellence isn't inspected in, it's built in.",
  "A clean workstation reflects a clear mind.",
  "The best joinery is the one no one notices.",
  "Every varnish stroke tells the story of your care.",
  "Details whisper luxury; shortcuts shout mediocrity.",
  "We finish what we start, and we finish it right.",
  "Consistency is the quiet hero of quality.",
  "A masterpiece is just discipline, repeated daily.",
  "Your effort today becomes someone's favorite chair.",
  "The grain remembers every pass of the sander.",
  "Precision isn't extra, it's the standard.",
  "Every screw tightened is a promise kept.",
  "We don't rush perfection; we build toward it.",
  "The finest wood deserves the finest attention.",
  "Every checklist completed is trust earned.",
  "Great craftsmanship starts with great focus.",
  "A team that takes pride finishes with pride.",
  "The smallest flaw can undo the biggest effort, stay sharp.",
  "Luxury lives in the details others skip.",
  "Every piece we build carries our promise forward.",
  "Show up for the process, not just the paycheck.",
  "The best finish is the one built on patience.",
  "A steady process is the backbone of premium quality.",
  "We measure twice because customers only see it once.",
  "Every day on the floor is a chance to raise the bar.",
  "Good enough never built a luxury brand.",
  "The mark of mastery is consistency under pressure.",
  "Care in craftsmanship is care for the customer.",
  "Every polished surface reflects the hands that shaped it.",
  "We build furniture, but we deliver confidence.",
  "Excellence is a decision made at every workstation.",
  "The wood doesn't lie, neither should our effort.",
  "A well-built frame holds more than weight; it holds our name.",
  "Quality control starts with quality intention.",
  "Every finished order is a chapter in our reputation.",
  "The best teams sweat the details no one asks about.",
  "Craftsmanship is the signature we leave without writing our name.",
  "Precision in the workshop becomes prestige in the showroom.",
  "Every day you improve, the brand improves with you.",
  "We don't cut corners, we craft them.",
  "The strength of a joint reflects the strength of our standards.",
  "A calm, focused hand builds the finest furniture.",
  "Every task done right is a brick in our legacy.",
  "Luxury isn't a material, it's a mindset.",
  "The best finish starts with the best intention.",
  "We build slow enough to build it right.",
  "Every inspection passed is a promise delivered.",
  "Great work doesn't need to be loud to be noticed.",
  "The details you perfect are the details customers remember.",
  "A craftsman's pride is measured in precision, not speed.",
  "Every plank has potential, it's our job to reveal it.",
  "We don't just assemble furniture, we assemble trust.",
  "The workshop is where reputations are built, one piece at a time.",
  "Excellence is the standard, not the exception.",
  "Every hand on the line shapes the brand's future.",
  "A single scratch can undo a hundred perfect cuts, stay careful.",
  "The finest craftsmanship comes from the calmest hands.",
  "We polish wood, but we build character.",
  "Every order fulfilled with care is a customer kept for life.",
  "Discipline on the floor becomes elegance in the showroom.",
  "The best products come from teams who refuse to settle.",
  "Every seam we hide is a flaw we didn't allow.",
  "Craft with intention, finish with pride.",
  "The mark of true luxury is what you don't see going wrong.",
  "We don't chase perfection, we practice it daily.",
  "Every worker's care becomes every customer's comfort.",
  "The strongest brands are built on the smallest details.",
  "Quality isn't checked at the end, it's built from the start.",
  "Every stitch, weld, and polish tells our story.",
  "We build furniture that outlives trends because we outwork shortcuts.",
  "The finest finish begins with the finest focus.",
  "Every day is a new chance to raise our own bar.",
  "Craftsmanship is patience, practiced under pressure.",
  "The best teams don't need reminders to care, they just do.",
  "Every piece leaving this floor represents all of us.",
  "We don't build fast, we build to last.",
  "The wood trusts our hands; let's honor that trust.",
  "Every improvement, however small, moves the whole team forward.",
  "Precision is our promise, quality is our proof.",
  "The finest details separate good furniture from great furniture.",
  "We measure success in flawless finishes, not fast ones.",
  "Every worker who takes pride adds value to the brand.",
  "Craft with care, someone's home depends on it.",
  "The best legacy is a product that never needs an apology.",
  "Every task matters, because every customer matters.",
  "We don't settle for close enough, we finish it right.",
  "The finest furniture is built by the finest attitudes.",
  "Every day of discipline builds a lifetime of trust.",
  "Craftsmanship isn't a skill, it's a standard we live by.",
]

const getDailyMotivationalQuote = () => {
  const today = new Date().toISOString().split("T")[0]

  const storedDate = localStorage.getItem("dashboard_quote_date")
  const storedIndex = localStorage.getItem("dashboard_quote_index")

  if (
    storedDate === today &&
    storedIndex !== null &&
    motivationalQuotes[Number(storedIndex)]
  ) {
    return motivationalQuotes[Number(storedIndex)]
  }

  const randomIndex = Math.floor(Math.random() * motivationalQuotes.length)

  localStorage.setItem("dashboard_quote_date", today)
  localStorage.setItem("dashboard_quote_index", randomIndex.toString())

  return motivationalQuotes[randomIndex]
}

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
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        <p className="text-sm text-gray-500 dark:text-gray-300">{label}</p>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
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
          <StatCard label="Total Projects"   value={stats.total_projects}     icon={FolderIcon}                  color="bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"   to="/projects" />
          <StatCard label="Active"           value={stats.active_projects}    icon={ClipboardDocumentListIcon}   color="bg-green-50 text-green-600 dark:bg-green-500/20 dark:text-green-400" to="/projects?status=in_progress" />
          <StatCard label="Delayed"          value={stats.delayed_projects}   icon={ExclamationTriangleIcon}     color="bg-orange-50 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400" to="/projects" subtitle="Past due date" />
          <StatCard label="Completed"        value={stats.completed_projects} icon={CheckCircleIcon}             color="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" to="/projects?status=completed" />
          <StatCard label="Opened Issues"      value={stats.open_issues}        icon={ExclamationCircleIcon}       color="bg-red-50 text-red-600 dark:bg-red-500/20 dark:text-red-400"     to="/issues" />
          <StatCard label="Pending Reworks"  value={stats.pending_reworks}    icon={ArrowPathIcon}               color="bg-purple-50 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400" to="/reworks?status=pending" />
          <StatCard label="Mat. Requests"    value={stats.pending_materials}  icon={CubeIcon}                    color="bg-yellow-50 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400" to="/materials?status=pending" />
          <StatCard label="Staff"        value={stats.total_employees-2}    icon={UserGroupIcon}               color="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400" to="/employees" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-gray-200">Recent Issues</h2>
            <Link to="/issues" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-600">
            {recentIssues?.data?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-300">No issues</p>
            ) : recentIssues?.data?.map((issue) => (
              <Link key={issue.id} to={`/issues/${issue.id}`}
                className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{issue.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{issue.department_name} · {fmtRelative(issue.created_at)}</p>
                </div>
                <IssueBadge status={issue.status} />
              </Link>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-gray-200">Recent Reports</h2>
            <Link to="/reports" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-600">
            {recentReports?.data?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-300">No reports</p>
            ) : recentReports?.data?.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-2 px-6 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{r.project_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.dept_name} · {r.submitted_by_name}</p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{fmtDate(r.report_date)}</span>
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
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
          <QueueListIcon className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
              {approvalCount} item{approvalCount !== 1 ? 's' : ''} awaiting your review
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400/80">
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
            <h2 className="font-semibold text-gray-900 dark:text-white">Issues to Review</h2>
            <Link to="/issues?status=open" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-600">
            {pendingIssues?.data?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-300">No issues pending review</p>
            ) : pendingIssues?.data?.map((issue) => (
              <Link key={issue.id} to={`/issues/${issue.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{issue.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{issue.department_name} · {fmtRelative(issue.created_at)}</p>
                </div>
                <IssueBadge status={issue.status} />
              </Link>
            ))}
          </div>
        </div>

        {/* Reworks awaiting approval */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Reworks to Approve</h2>
            <Link to="/reworks?status=pending" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-600">
            {pendingReworks?.data?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-300">No pending reworks</p>
            ) : pendingReworks?.data?.map((rework) => (
              <div key={rework.id} className="flex items-start gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{rework.reason}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {rework.requesting_dept_name} → {rework.target_dept_name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{fmtRelative(rework.created_at)}</p>
                </div>
                <ReworkBadge status={rework.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Material requests */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Material Requests</h2>
            <Link to="/materials?status=pending" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-600">
            {pendingMaterials?.data?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-300">No pending requests</p>
            ) : pendingMaterials?.data?.map((m) => (
              <div key={m.id} className="flex items-start gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{m.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{m.dept_name} · {fmtRelative(m.created_at)}</p>
                </div>
                <span className="badge-yellow dark:bg-yellow-500/20 dark:text-yellow-400">pending</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Production Feed */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white">Latest Reports</h2>
            <Link to="/reports" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-600">
            {recentReports?.data?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-300">No reports yet</p>
            ) : recentReports?.data?.map((r) => (
              <div key={r.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{r.project_name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{fmtDate(r.report_date)}</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{r.description}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{r.dept_name} · {r.submitted_by_name}</p>
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
            <h2 className="font-semibold text-gray-900 dark:text-white">My Tasks</h2>
            <Link to="/tasks" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-600">
            {myTasksData?.data?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-300">No tasks assigned</p>
            ) : myTasksData?.data?.map((task) => {
              const completedSubs = task.subtasks?.filter((s) => s.status === 'completed').length || 0
              const totalSubs = task.subtasks?.length || 0
              return (
                <Link key={task.id} to={`/tasks/${task.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate dark:text-white">{task.title || task.department_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                        taskStatusColor[task.status])}>
                        {taskStatusLabel[task.status]}
                      </span>
                      {task.due_date && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          <ClockIcon className="w-3 h-3" />
                          {fmtDate(task.due_date)}
                        </span>
                      )}
                    </div>
                    {totalSubs > 0 && (
                      <div className="mt-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1">
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
            <h2 className="font-semibold text-gray-900 dark:text-white">My Issues</h2>
            <Link to="/issues" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-600">
            {issuesData?.data?.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-300">No issues raised</p>
            ) : issuesData?.data?.map((issue) => (
              <Link key={issue.id} to={`/issues/${issue.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{issue.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{fmtRelative(issue.created_at)}</p>
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
  const greeting = getGreeting()
  const quote = getDailyMotivationalQuote()  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {greeting}, {user?.first_name}{' '}
          <span className="inline-block origin-[70%_70%] animate-wave">
            👋
          </span>
        </h1>        
        {/* {(isAdmin || isLayerTwo) && ( */}
          <p className="mt-2 text-base italic text-brand-600 dark:text-brand-300 font-medium">`{quote}`</p>
        {/* )} */}
      </div>

      {isAdmin        && <AdminDashboard />}
      {isLayerTwo     && <Layer2Dashboard />}
      {isLayerThree   && <Layer3Dashboard />}
    </div>
  )
}