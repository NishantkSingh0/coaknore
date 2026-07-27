import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import clsx from 'clsx'
import {
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  UserCircleIcon,
  FolderIcon,
  FolderOpenIcon,
  ClipboardDocumentListIcon,
  ClipboardDocumentCheckIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  DocumentMagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  Cog6ToothIcon,
  SparklesIcon,
  UserGroupIcon,
  UserPlusIcon,
  BuildingOfficeIcon,
  BuildingStorefrontIcon,
  CalendarIcon,
  CalendarDaysIcon,
  QuestionMarkCircleIcon,
  ChevronDownIcon,
  ArrowPathIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  SunIcon,
  CameraIcon,
  KeyIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  ArrowUpTrayIcon,
  EyeIcon,
  PencilSquareIcon,
  PlusCircleIcon,
  ListBulletIcon,
  InformationCircleIcon,
  LockClosedIcon,
  ClockIcon,
  BoltIcon,
  TableCellsIcon,
  MapIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline'
import {
  ShieldCheckIcon as ShieldCheckSolid,
  CheckCircleIcon as CheckCircleSolid,
  ExclamationCircleIcon as ExclamationCircleSolid,
  InformationCircleIcon as InformationCircleSolid,
  ExclamationTriangleIcon as ExclamationTriangleSolid,
} from '@heroicons/react/24/solid'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface FAQItem { q: string; a: string }
interface Section {
  id: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  content: React.ReactNode
}

// ─────────────────────────────────────────────────────────────
// Micro-components  (white / gray / black / blue palette only)
// ─────────────────────────────────────────────────────────────

function SectionIcon({ icon: Icon, shade }: { icon: React.ComponentType<{ className?: string }>; shade: 'blue' | 'gray' | 'dark' }) {
  const map = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300',
    dark: 'bg-gray-900 text-white dark:bg-white dark:text-gray-900',
  }
  return (
    <span className={clsx('inline-flex w-8 h-8 rounded-lg items-center justify-center flex-shrink-0', map[shade])}>
      <Icon className="w-4 h-4" />
    </span>
  )
}

function InfoBox({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'warn' | 'tip' | 'danger' }) {
  const cfg = {
    info:   { bar: 'bg-blue-500',  bg: 'bg-blue-50 dark:bg-blue-950/30',   border: 'border-blue-200 dark:border-blue-800',   text: 'text-blue-900 dark:text-blue-200',   Icon: InformationCircleSolid  },
    warn:   { bar: 'bg-gray-600',  bg: 'bg-gray-50 dark:bg-gray-800/50',   border: 'border-gray-300 dark:border-gray-600',   text: 'text-gray-800 dark:text-gray-200',   Icon: ExclamationTriangleSolid },
    tip:    { bar: 'bg-blue-400',  bg: 'bg-blue-50 dark:bg-blue-950/20',   border: 'border-blue-200 dark:border-blue-800',   text: 'text-blue-800 dark:text-blue-200',   Icon: CheckCircleSolid        },
    danger: { bar: 'bg-gray-900',  bg: 'bg-gray-100 dark:bg-gray-800',     border: 'border-gray-300 dark:border-gray-600',   text: 'text-gray-900 dark:text-gray-100',   Icon: ExclamationCircleSolid  },
  }
  const { bar, bg, border, text, Icon } = cfg[type]
  return (
    <div className={clsx('flex gap-3 rounded-xl border pl-4 pr-4 py-3 text-sm leading-relaxed', bg, border)}>
      <span className={clsx('w-1 rounded-full flex-shrink-0 self-stretch', bar)} />
      <Icon className={clsx('w-4 h-4 flex-shrink-0 mt-0.5', text)} />
      <div className={text}>{children}</div>
    </div>
  )
}

function Step({ n, icon: Icon, title, children }: { n: number; icon?: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <div className="w-7 h-7 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {n}
        </div>
        <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700 min-h-[20px]" />
      </div>
      <div className="flex-1 pb-5">
        <div className="flex items-center gap-2 mb-1">
          {Icon && <Icon className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />}
          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{title}</p>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

function Tag({ label, color }: { label: string; color: 'blue' | 'gray' | 'dark' | 'white' }) {
  const map = {
    blue:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    gray:  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    dark:  'bg-gray-900 text-white dark:bg-white dark:text-gray-900',
    white: 'bg-white text-gray-700 border border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
  }
  return <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', map[color])}>{label}</span>
}

function CapRow({ icon: Icon, label, desc }: { icon: React.ComponentType<{ className?: string }>; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
      <span className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
      </span>
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {items.map((item, i) => (
        <div key={i}>
          <button
            className="w-full flex items-center justify-between px-1 py-3.5 text-left text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="flex items-center gap-2">
              <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {item.q}
            </span>
            <ChevronDownIcon className={clsx('w-4 h-4 flex-shrink-0 text-gray-400 transition-transform ml-4', open === i && 'rotate-180')} />
          </button>
          {open === i && (
            <div className="px-6 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-gray-800/30 rounded-xl mb-1">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function SectionCard({ section }: { section: Section }) {
  const Icon = section.icon
  return (
    <div id={section.id} className="card scroll-mt-8">
      <div className="card-header flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-white dark:text-gray-900" />
        </span>
        <h2 className="font-bold text-base text-gray-900 dark:text-gray-100">{section.title}</h2>
      </div>
      <div className="card-body space-y-5">{section.content}</div>
    </div>
  )
}

function SubSection({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
        <Icon className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ADMIN SECTIONS
// ═══════════════════════════════════════════════════════════════
const adminSections: Section[] = [
  // ── 1. Overview ───────────────────────────────────────────────
  {
    id: 'admin-overview',
    icon: ShieldCheckIcon,
    title: 'Admin, Your Role at a Glance',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          You are <strong>Layer 1 (Admin)</strong>, the highest access level on the platform. You set up the entire operation:
          create projects, build production workflows, manage staff and departments, and monitor everything
          from the dashboard. Think of yourself as the control tower.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <CapRow icon={FolderOpenIcon}      label="Create & Edit Projects"     desc="Only you can create new projects, upload drawings, and edit existing ones." />
          <CapRow icon={UserGroupIcon}        label="Manage All Staff"            desc="Add, edit, transfer, deactivate, and reset passwords for every employee." />
          <CapRow icon={BuildingOfficeIcon}   label="Manage Departments"          desc="Create production departments and assign them to the correct layer." />
          <CapRow icon={MapIcon}              label="Build Production Routings"   desc="Design step-by-step workflows that assign tasks to departments in order." />
          <CapRow icon={CheckCircleIcon}      label="Approve / Reject Everything" desc="Review all issues, reworks, and material requests raised by any team." />
          <CapRow icon={SparklesIcon}         label="AI Assistant (Exclusive)"    desc="Ask plain-language questions and get real-time production insights." />
          <CapRow icon={TableCellsIcon}       label="Full Dashboard Stats"        desc="Live count of all projects, issues, reworks, materials, and staff." />
          <CapRow icon={BellIcon}             label="All Notifications"           desc="Receive system alerts for overdue tasks, issues, reworks, and reports." />
        </div>
        <InfoBox type="info">
          You also share all standard features with every user, Queries, Notifications, Search, and Settings.
        </InfoBox>
      </div>
    ),
  },

  // ── 2. Dashboard ──────────────────────────────────────────────
  {
    id: 'admin-dashboard',
    icon: TableCellsIcon,
    title: 'Dashboard, Reading the Control Panel',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Your dashboard at <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">/dashboard</code> is the first thing you should check every morning.
          Every stat card is <strong>clickable</strong>, it takes you directly to the filtered list.
        </p>
        <SubSection icon={TableCellsIcon} title="Stat Cards">
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Total Projects',     'Every project ever created in the system.'],
              ['Active',             'Projects currently in production (In Progress status).'],
              ['Delayed',            'Projects whose delivery date has already passed.'],
              ['Completed',          'Successfully delivered projects.'],
              ['Open Issues',        'Issues waiting for your review or a resolution.'],
              ['Pending Reworks',    'Rework requests not yet approved or rejected.'],
              ['Material Requests',  'Material requisitions waiting for approval.'],
              ['Staffs',             'Count of all active employees in the system.'],
            ].map(([s, d]) => (
              <div key={s as string} className="border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2.5">
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{s as string}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{d as string}</p>
              </div>
            ))}
          </div>
        </SubSection>
        <SubSection icon={ClipboardDocumentListIcon} title="Live Feeds">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Below the stats you'll see <strong>Recent Issues</strong> (last 5 open issues) and <strong>Recent Reports</strong> (last 5 daily reports submitted). These are your two most important live feeds, review them daily.
          </p>
        </SubSection>
        <InfoBox type="tip">
          If the <strong>Delayed</strong> count is going up, open that list, look at which tasks are blocking each project, and check if there are unresolved issues holding them.
        </InfoBox>
      </div>
    ),
  },

  // ── 3. Projects ───────────────────────────────────────────────
  {
    id: 'admin-projects',
    icon: FolderIcon,
    title: 'Projects, Creating & Managing Orders',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Every customer order lives as a <strong>Project</strong>. Only you can create, edit, or change a project's status.
          A project is the starting point for everything, no routing, no tasks, no production until a project exists.
        </p>

        <SubSection icon={PlusCircleIcon} title="Creating a New Project">
          <div className="space-y-0">
            <Step n={1} icon={FolderOpenIcon} title="Click Projects in the sidebar → + New Project">
              <p>The project form opens. Fill in all required fields.</p>
            </Step>
            <Step n={2} icon={PencilSquareIcon} title="Fill in the core details">
              <p>PO Number (unique order reference), Project Name, Client Name, Email, Phone, Delivery Address, Quantity, Delivery Date, and Specifications. Material details and upholstery details are optional but helpful.</p>
            </Step>
            <Step n={3} icon={ArrowUpTrayIcon} title="Upload files (optional but recommended)">
              <p>You can upload CAD files, Job Cards, Render files, and a Drawing. These are accessible to all departments from the project overview.</p>
            </Step>
            <Step n={4} icon={CheckCircleIcon} title="Save, project is now live">
              <p>Status becomes <strong>Created</strong>. Nothing is assigned to departments yet. Next step: build the routing.</p>
            </Step>
          </div>
        </SubSection>

        <SubSection icon={ArrowRightIcon} title="Project Status Flow">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {['Created','Routing','In Progress','On Hold','Completed','Archived'].map((s, i, arr) => (
              <span key={s} className="flex items-center gap-1.5">
                <Tag label={s} color={s === 'In Progress' ? 'blue' : s === 'Completed' ? 'dark' : 'gray'} />
                {i < arr.length - 1 && <ArrowRightIcon className="w-3 h-3 text-gray-400" />}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Statuses update automatically when routing is published and tasks are completed. You can manually set <strong>On Hold</strong> or <strong>Archived</strong> at any time.
          </p>
        </SubSection>

        <SubSection icon={EyeIcon} title="Project Tabs Explained">
          <div className="space-y-2">
            {[
              [FolderOpenIcon,              'Overview',   'Client details, specs, all uploaded files (CAD, Job Cards, Renders, Drawing). Your first stop when opening any project.'],
              [MapIcon,                     'Routing',    'The production workflow for this project. Create, edit, publish, and version-control the routing here.'],
              [ClipboardDocumentListIcon,   'Tasks',      'All department tasks generated from the routing. See status, assigned employees, and subtask completion.'],
              [CalendarDaysIcon,            'Timeline',   'A chronological log of every event, task started, completed, issue raised, routing changed, project edited.'],
              [DocumentMagnifyingGlassIcon, 'Revisions',  'Every edit you\'ve made to this project, with a before/after comparison and the reason for change.'],
            ].map(([Icon, tab, desc]) => (
              <div key={tab as string} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {/* @ts-ignore */}
                  <Icon className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                </span>
                <div>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{tab as string}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">, {desc as string}</span>
                </div>
              </div>
            ))}
          </div>
        </SubSection>

        <InfoBox type="warn">
          Editing a live project creates a Revision record and notifies all departments working on it. Always add a clear reason for the edit, it appears in the Revisions tab and the audit trail.
        </InfoBox>
      </div>
    ),
  },

  // ── 4. Routing ────────────────────────────────────────────────
  {
    id: 'admin-routing',
    icon: MapIcon,
    title: 'Routing, Designing the Production Workflow',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Routing is the production blueprint, it defines <em>which departments</em> work on a project, <em>in what order</em>,
          and how they depend on each other. Publishing a routing automatically creates tasks for each assigned department.
          Until a routing is published, no department gets any task.
        </p>

        <SubSection icon={PlusCircleIcon} title="Building a Routing (Step by Step)">
          <div className="space-y-0">
            <Step n={1} icon={FolderOpenIcon} title="Open the project → Routing tab → + Create Routing">
              <p>Give the routing a name (e.g. "Standard Sofa Production") and an optional description.</p>
            </Step>
            <Step n={2} icon={ListBulletIcon} title="Add Steps in order">
              <p>Each step is one stage of production. Name it clearly (e.g. "Step 1, Frame Cutting", "Step 2, Upholstery"). Steps execute top to bottom, a step only unlocks when its previous step is finished.</p>
            </Step>
            <Step n={3} icon={BuildingOfficeIcon} title="Add Departments to each step">
              <p>Assign one or more departments per step. If you add multiple departments to one step, set the dependency policy:</p>
              <div className="flex gap-2 mt-1">
                <Tag label="Require All, every dept must finish" color="blue" />
                <Tag label="Require Any, first to finish unlocks next" color="gray" />
              </div>
            </Step>
            <Step n={4} icon={EyeIcon} title="Save as Draft, review carefully">
              <p>Draft routing does not start any work. Double-check the step order, department assignments, and dependency policies.</p>
            </Step>
            <Step n={5} icon={BoltIcon} title="Publish, this kicks off production">
              <p>Publishing creates tasks for each department in Step 1 immediately. Subsequent steps unlock as their predecessors complete. Departments receive a notification the moment their task is created.</p>
            </Step>
          </div>
        </SubSection>

        <SubSection icon={ArrowPathIcon} title="Updating Routing Mid-Project (New Version)">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            If production requirements change after a routing is live, click <strong>New Version</strong> on the active routing.
            You must provide a change reason. The system archives the old routing, creates a new draft, and you edit and re-publish.
            Affected departments are notified automatically.
          </p>
          <InfoBox type="warn">
            Creating a new version mid-project reopens affected tasks. Use this only when genuinely needed, it interrupts active work and sends notifications to all involved teams.
          </InfoBox>
        </SubSection>

        <SubSection icon={ClipboardDocumentCheckIcon} title="Routing Templates">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Access <strong>Routing Templates</strong> to save common production flows and reuse them on future projects. This saves setup time for standard products your team builds repeatedly.
          </p>
        </SubSection>

        <SubSection icon={ArrowRightIcon} title="Routing Status Flow">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {['Draft','Active','Superseded','Archived'].map((s, i, arr) => (
              <span key={s} className="flex items-center gap-1.5">
                <Tag label={s} color={s === 'Active' ? 'blue' : s === 'Draft' ? 'white' : 'gray'} />
                {i < arr.length - 1 && <ArrowRightIcon className="w-3 h-3 text-gray-400" />}
              </span>
            ))}
          </div>
        </SubSection>
      </div>
    ),
  },

  // ── 5. Staff ──────────────────────────────────────────────────
  {
    id: 'admin-staff',
    icon: UserGroupIcon,
    title: 'Staff Management, Adding & Managing Employees',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Only you can create, edit, transfer, deactivate, and reset passwords for employees. Getting the <strong>Layer</strong> right is critical, it controls exactly what each person can see and do.
        </p>

        <SubSection icon={UserPlusIcon} title="Adding a New Employee">
          <div className="space-y-0">
            <Step n={1} icon={UserGroupIcon} title="Staffs → + New Staff">
              <p>Fill in First Name, Last Name, Email, Phone (optional), Department, and Layer.</p>
            </Step>
            <Step n={2} icon={ShieldCheckIcon} title="Choose the correct Layer">
              <div className="space-y-1 mt-1">
                {[
                  ['Layer 1 (Admin)',    'Full access. Can do everything you can. Use sparingly.'],
                  ['Layer 2 (Manager)', 'Approval authority. Reviews issues, reworks, materials. Can build routings.'],
                  ['Layer 3 (Staff)',   'Production floor access. Tasks, reports, issues, materials, queries only.'],
                ].map(([l, d]) => (
                  <div key={l as string} className="flex gap-2 text-sm">
                    <span className="font-semibold text-gray-800 dark:text-gray-200 w-36 flex-shrink-0">{l as string}</span>
                    <span className="text-gray-500 dark:text-gray-400">{d as string}</span>
                  </div>
                ))}
              </div>
            </Step>
            <Step n={3} icon={KeyIcon} title="Share credentials with the employee">
              <p>A default password is set. The employee should change it from Settings on first login. If they forget, you can reset it any time from their profile.</p>
            </Step>
          </div>
        </SubSection>

        <SubSection icon={ArrowPathIcon} title="Transfers & Deactivation">
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p><strong className="text-gray-800 dark:text-gray-200">Transfer:</strong> If an employee moves departments, open their profile and click Transfer. Their new department becomes active immediately. Past tasks and reports remain on record.</p>
            <p><strong className="text-gray-800 dark:text-gray-200">Toggle Active:</strong> Deactivating an employee blocks their login immediately. All their past work stays in the system. Reactivate whenever needed.</p>
            <p><strong className="text-gray-800 dark:text-gray-200">Reset Password:</strong> Go to the employee's profile → Reset Password. No email verification required. Give them the new temporary password in person.</p>
          </div>
        </SubSection>

        <InfoBox type="danger">
          Employees cannot be deleted, only deactivated. This preserves the full audit trail of all their past work, reports, and task completions.
        </InfoBox>
      </div>
    ),
  },

  // ── 6. Departments ────────────────────────────────────────────
  {
    id: 'admin-depts',
    icon: BuildingOfficeIcon,
    title: 'Departments, Setting Up Your Workshop Units',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Departments represent your production units, Carpentry, Upholstery, Finishing, Quality Control, etc.
          Only Admins can create and manage departments.
        </p>
        <div className="space-y-0">
          <Step n={1} icon={BuildingOfficeIcon} title="Departments sidebar → + New Department">
            <p>Enter a name and description.</p>
          </Step>
          <Step n={2} icon={ShieldCheckIcon} title="Select the Department Layer">
            <div className="space-y-1 mt-1 text-sm">
              <p><Tag label="Layer 2" color="blue" />, Management / approval departments. These appear as approvers in workflows.</p>
              <p><Tag label="Layer 3" color="gray" />, Production departments. These receive tasks in routing steps.</p>
            </div>
          </Step>
          <Step n={3} icon={CheckCircleIcon} title="Toggle Active / Inactive as needed">
            <p>Inactive departments don't appear in the routing builder. You can reactivate at any time, staff in that department get notified.</p>
          </Step>
        </div>
        <InfoBox type="info">
          Most routing steps use Layer 3 departments. Layer 2 departments are management teams that do approvals, not production tasks.
        </InfoBox>
      </div>
    ),
  },

  // ── 7. Issues & IQC ──────────────────────────────────────────
  {
    id: 'admin-issues',
    icon: ExclamationCircleIcon,
    title: 'Issues, The IQC & Problem Resolution Workflow',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          <strong>Issues</strong> are the platform's formal quality control and problem-reporting system. Any department can raise an issue
          against a project. As Admin, you see every issue across all projects and can review any of them.
          This is how <strong>IQC (In-process Quality Control)</strong> is managed, a quality problem is raised as a
          "Quality Issue", reviewed by you or a Manager, and tracked until resolved.
        </p>

        <SubSection icon={ListBulletIcon} title="Issue Types">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              [ExclamationTriangleIcon, 'Material Missing',       'A required raw material is not available. Department must wait.'],
              [PencilSquareIcon,        'Design Change',          'A design update is needed, client request or internal correction.'],
              [MapIcon,                 'Routing Required',       'An additional production step not in the original routing is needed.'],
              [EyeIcon,                 'Full Scale Requirement', 'A full-scale mock-up or template check is needed before production.'],
              [ClipboardDocumentCheckIcon,'Quality Issue (IQC)',  'Work done doesn\'t meet quality standards. Triggers IQC review process.'],
              [ArrowPathIcon,           'Rework Required',        'Work from a previous department needs to be redone.'],
              [DocumentTextIcon,        'Custom',                 'Any issue type not covered by the above categories.'],
            ].map(([Icon, type, desc]) => (
              <div key={type as string} className="flex items-start gap-2 text-sm">
                {/* @ts-ignore */}
                <Icon className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{type as string}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{desc as string}</p>
                </div>
              </div>
            ))}
          </div>
        </SubSection>

        <SubSection icon={ArrowRightIcon} title="Issue Lifecycle, How IQC Works">
          <div className="space-y-0">
            <Step n={1} icon={PlusCircleIcon} title="Department raises the issue">
              <p>Staff member opens an Issue, selects the type, fills in details, uploads photos if needed, and submits. Issue status becomes <Tag label="Open" color="gray" />.</p>
            </Step>
            <Step n={2} icon={BellIcon} title="Admin & Manager receive notification">
              <p>You and all Managers get an instant notification. The task linked to this issue moves to <Tag label="Issue Hold" color="gray" />, production pauses automatically.</p>
            </Step>
            <Step n={3} icon={EyeIcon} title="Review the issue">
              <p>Open the issue → read the description, view attached files. Then either:</p>
              <div className="flex gap-2 mt-1">
                <Tag label="✓ Approve, work can proceed" color="blue" />
                <Tag label="✗ Reject, not valid, continue as-is" color="gray" />
              </div>
            </Step>
            <Step n={4} icon={CheckCircleIcon} title="Department resolves it when fixed">
              <p>After approval, the department actually fixes the problem and clicks <strong>Resolve</strong> with a resolution note. Status becomes <Tag label="Resolved" color="dark" />. Task resumes.</p>
            </Step>
          </div>
          <InfoBox type="info">
            For <strong>Quality Issues (IQC)</strong>: the department raising the issue is essentially flagging a quality failure. You review the evidence (photos, description) and decide if a rework is needed or if it passes. Your review note becomes the official QC record.
          </InfoBox>
        </SubSection>

        <SubSection icon={ArrowRightIcon} title="Issue Status Flow">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {['Open','Pending Approval','Approved','Resolved'].map((s, i, arr) => (
              <span key={s} className="flex items-center gap-1.5">
                <Tag label={s} color={s === 'Approved' ? 'blue' : s === 'Resolved' ? 'dark' : 'gray'} />
                {i < arr.length - 1 && <ArrowRightIcon className="w-3 h-3 text-gray-400" />}
              </span>
            ))}
            <span className="text-gray-400 text-xs ml-1">or <Tag label="Rejected" color="gray" /></span>
          </div>
        </SubSection>
      </div>
    ),
  },

  // ── 8. Tasks ──────────────────────────────────────────────────
  {
    id: 'admin-tasks',
    icon: ClipboardDocumentListIcon,
    title: 'Tasks, Monitoring Department Progress',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Tasks are automatically created when you publish a routing. You don't create tasks manually.
          As Admin, you can view all tasks across all projects, assign employees to tasks, and update task dates.
        </p>
        <SubSection icon={EyeIcon} title="Where to See Tasks">
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p><strong className="text-gray-800 dark:text-gray-200">Project → Tasks tab:</strong> All tasks for a specific project, grouped by department. Click any task to open it.</p>
            <p><strong className="text-gray-800 dark:text-gray-200">Task Detail:</strong> Description, assigned employees, subtasks (with proof uploads), start date, due date, and expected completion date.</p>
          </div>
        </SubSection>
        <SubSection icon={UserPlusIcon} title="Assigning Employees to a Task">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Open any task → click <strong>Assign Employees</strong>. Pick one or more employees from that department.
            Assigned employees receive a notification. You can reassign at any time.
          </p>
        </SubSection>
        <SubSection icon={CalendarIcon} title="Task Status Flow">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {['Pending','In Progress','Hold','Issue Hold','Completed'].map((s, i, arr) => (
              <span key={s} className="flex items-center gap-1.5">
                <Tag label={s} color={s === 'In Progress' ? 'blue' : s === 'Completed' ? 'dark' : 'gray'} />
                {i < arr.length - 1 && <ArrowRightIcon className="w-3 h-3 text-gray-400" />}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            <strong>Issue Hold</strong> is set automatically when a Quality Issue or blocking issue is raised against that task. It clears when the issue is resolved.
          </p>
        </SubSection>
        <InfoBox type="tip">
          The system sends you an automatic notification every hour for any task that is overdue (past due date and not completed). Use the Delayed project count on the dashboard to stay on top of these.
        </InfoBox>
      </div>
    ),
  },

  // ── 9. AI Assistant ───────────────────────────────────────────
  {
    id: 'admin-ai',
    icon: SparklesIcon,
    title: 'AI Assistant, Your Production Intelligence Tool',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          The AI Assistant is exclusive to Admin. Click the <SparklesIcon className="w-4 h-4 inline text-blue-500" /> sparkle icon in the sidebar.
          A panel slides in, type any question in plain language about your production data.
        </p>
        <SubSection icon={ChatBubbleLeftRightIcon} title="What You Can Ask">
          <div className="space-y-1.5">
            {[
              'How many projects are currently delayed?',
              'Which department has the most open issues this month?',
              'Show me all tasks that are overdue right now.',
              'What is the current production status of Project [Name]?',
              'Which employees have not submitted any reports this week?',
              'How many rework requests were approved last month?',
            ].map((q) => (
              <div key={q} className="flex items-start gap-2 text-sm bg-blue-50 dark:bg-blue-950/20 rounded-lg px-3 py-2 border border-blue-100 dark:border-blue-900/30">
                <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 dark:text-gray-300 italic">"{q}"</span>
              </div>
            ))}
          </div>
        </SubSection>
        <InfoBox type="danger">
          The AI has <strong>read-only</strong> database access. It can tell you what's happening but cannot make any changes, approve issues, or update records. It is purely an information tool.
        </InfoBox>
        <InfoBox type="warn">
          This feature is not visible to Managers or Department Staff. Only Layer 1 accounts see the sparkle icon in the sidebar.
        </InfoBox>
      </div>
    ),
  },
]

const adminFAQ: FAQItem[] = [
  { q: 'An employee forgot their password. How do I reset it?', a: 'Go to Staffs → open the employee profile → click Reset Password. The system generates a new temporary password. Share it with them in person. They should change it from Settings on first login.' },
  { q: 'Can I delete a project?', a: 'No. Projects cannot be deleted to protect the audit trail. Archive the project to remove it from active lists. You can unarchive it later if needed.' },
  { q: 'How do I update the routing after production has started?', a: 'Go to the project → Routing tab → click New Version on the active routing. Add a clear change reason. The old version archives automatically. Edit and re-publish the new version. Affected departments are notified.' },
  { q: 'A project shows "Delayed", what should I check?', a: 'Open the project → Tasks tab. Find tasks that are still Pending or In Progress past their due date. Check if there are open issues causing Issue Hold. Check the routing to see if a step is blocked waiting for the previous department.' },
  { q: 'Can I assign a task to a specific employee?', a: 'Yes. Open the task from the project Tasks tab → click Assign Employees. Select from employees in that department. You can assign multiple people and change assignments any time.' },
  { q: 'The AI Assistant is not showing in my sidebar. Why?', a: 'The AI icon only appears for Layer 1 (Admin / Super Admin) accounts. Verify your account layer in Settings. If it still doesn\'t appear, contact the system administrator.' },
  { q: 'What is the difference between a Rework and a Quality Issue?', a: 'A Quality Issue (IQC) is raised when the quality of work doesn\'t meet standards, it is reviewed by you or a Manager and pauses the task. A Rework Request is a specific ask for another department to redo their work, it also needs approval and may create a new routing step.' },
]

// ═══════════════════════════════════════════════════════════════
// LAYER 2 (MANAGER) SECTIONS
// ═══════════════════════════════════════════════════════════════
const layer2Sections: Section[] = [
  {
    id: 'l2-overview',
    icon: WrenchScrewdriverIcon,
    title: 'Manager, Your Role at a Glance',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          You are <strong>Layer 2 (Manager)</strong>, the quality and workflow authority on the platform.
          Your primary job is to keep the approval queue clear, review problems raised by departments, and maintain
          production flow. You also have full project visibility and can build routings when needed.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <CapRow icon={CheckCircleIcon}        label="Approve / Reject Issues"      desc="Review every issue raised by any department. Your decision unblocks or closes them." />
          <CapRow icon={ArrowPathIcon}           label="Approve / Reject Reworks"     desc="Decide if a department's rework request is valid and should proceed." />
          <CapRow icon={CubeIcon}               label="Approve Material Requests"    desc="Review and approve or reject material requisitions from production teams." />
          <CapRow icon={FolderOpenIcon}         label="View All Projects"             desc="Full read access to every project, including all tabs and files." />
          <CapRow icon={MapIcon}                label="Build & Publish Routings"     desc="Create, edit, and publish production workflows for any project." />
          <CapRow icon={DocumentTextIcon}       label="Read All Daily Reports"       desc="Every report submitted by every department is visible to you." />
          <CapRow icon={CalendarIcon}           label="Manage Task Dates"            desc="Set start dates, due dates, and expected completion dates on tasks." />
          <CapRow icon={UserPlusIcon}           label="Assign Task Employees"        desc="Assign specific people from a department to any task." />
        </div>
        <InfoBox type="warn">
          You cannot create or edit projects, manage staff accounts, or access the AI Assistant. These are Admin-only functions. Reach out to Admin for those needs.
        </InfoBox>
      </div>
    ),
  },

  {
    id: 'l2-dashboard',
    icon: TableCellsIcon,
    title: 'Dashboard, Your Daily Approval Queue',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Your dashboard is built around one core idea: clearing your approval queue. The amber banner at the top
          shows you exactly how many items are waiting. <strong>Deal with this first every single morning</strong>,
          pending approvals physically block departments from continuing their work.
        </p>
        <SubSection icon={ClipboardDocumentListIcon} title="Four Sections on Your Dashboard">
          <div className="space-y-2">
            {[
              [ExclamationCircleIcon, 'Issues to Review',    'Issues raised by any department awaiting your Approve or Reject decision. These may be blocking active tasks.'],
              [ArrowPathIcon,         'Reworks to Approve',  'One department is asking another to redo work. You decide if this is valid.'],
              [CubeIcon,             'Material Requests',   'A department has formally requested materials. Approval allows them to source or use those materials.'],
              [DocumentTextIcon,     'Latest Reports',      'The most recent daily reports across all departments. Your production journal.'],
            ].map(([Icon, title, desc]) => (
              <div key={title as string} className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                {/* @ts-ignore */}
                <Icon className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title as string}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc as string}</p>
                </div>
              </div>
            ))}
          </div>
        </SubSection>
      </div>
    ),
  },

  {
    id: 'l2-review',
    icon: ClipboardDocumentCheckIcon,
    title: 'How to Review Issues, IQC, Reworks & Material Requests',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          All three request types, Issues, Reworks, and Material Requests, follow the same review process.
          Your decision is final and triggers automatic notifications to the department.
        </p>
        <SubSection icon={ListBulletIcon} title="Step-by-Step Review Process">
          <div className="space-y-0">
            <Step n={1} icon={EyeIcon} title="Open the item from Dashboard or Issues page">
              <p>Click the title to open the full detail page. Read the complete description. Look at all attached files and photos carefully.</p>
            </Step>
            <Step n={2} icon={ClipboardDocumentCheckIcon} title="For Quality Issues (IQC): check the evidence">
              <p>The department has flagged a quality failure. Look at the photos. Check if the issue description matches the work standard required. Compare against the project specs (available in the project Overview tab).</p>
            </Step>
            <Step n={3} icon={CheckCircleIcon} title="Approve or Reject, always add notes">
              <p>
                <Tag label="Approve" color="blue" />, The issue is valid. The department will be notified and can proceed with the fix. The linked task remains on Issue Hold until the department resolves it.
              </p>
              <p className="mt-1">
                <Tag label="Reject" color="gray" />, The issue is not valid or not blocking. The task resumes. <strong>Always write rejection notes</strong>, tell the department why it was rejected so they understand.
              </p>
            </Step>
            <Step n={4} icon={BellIcon} title="Department gets notified automatically">
              <p>The moment you approve or reject, the raising department receives a notification with your notes.</p>
            </Step>
          </div>
        </SubSection>
        <SubSection icon={ArrowPathIcon} title="Rework Requests, What They Mean">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            A Rework Request is Department A saying: "The work sent by Department B is wrong and needs to be fixed before we can continue."
            If you approve, a new routing task may be created for Department B. If you reject, Department A continues with the work as-is.
            Always verify the evidence before approving, reworks disrupt the entire production sequence.
          </p>
        </SubSection>
        <InfoBox type="warn">
          Never reject an issue with no review notes. The department doesn't know what to fix or why their concern was dismissed. Notes protect everyone.
        </InfoBox>
      </div>
    ),
  },

  {
    id: 'l2-department-files',
    icon: ArrowUpTrayIcon,
    title: 'Department Files, Uploading Important Information for Production Teams',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          As a Manager or Admin, you can upload <strong>Department Files</strong> to specific tasks. These files contain important drawings, specifications, or guidance that production departments need to see before proceeding with their work.
        </p>
        <SubSection icon={InformationCircleIcon} title="Purpose of Department Files">
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p><strong className="text-gray-800 dark:text-gray-200">Enable Specific Departments:</strong> Upload files directly to a department's task so they see exactly what they need for their specific work.</p>
            <p><strong className="text-gray-800 dark:text-gray-200">Provide Guidance:</strong> Share important drawings, updated specifications, or special instructions that aren't in the original project files.</p>
            <p><strong className="text-gray-800 dark:text-gray-200">Ensure Compliance:</strong> Make sure production teams have the correct reference materials before they start work.</p>
          </div>
        </SubSection>
        <SubSection icon={PlusCircleIcon} title="How to Upload Department Files">
          <div className="space-y-0">
            <Step n={1} icon={FolderOpenIcon} title="Navigate to the task">
              <p>Go to Project → Tasks tab, then click on the specific department task you want to add files to.</p>
            </Step>
            <Step n={2} icon={EyeIcon} title="Open the Task Detail Page">
              <p>You'll see the task description, subtasks, and other details. Look for the Subtasks section header.</p>
            </Step>
            <Step n={3} icon={ArrowUpTrayIcon} title="Click 'Upload Department File'">
              <p>In the Subtasks section header, you'll see an "Upload Department File" button. Click it to open the file picker.</p>
            </Step>
            <Step n={4} icon={DocumentTextIcon} title="Select and upload the file">
              <p>Choose the drawing, specification, or document you want to share. The file uploads to AWS S3 and is linked to this task.</p>
            </Step>
            <Step n={5} icon={CheckCircleIcon} title="File is now visible to the department">
              <p>The file appears in the "Important Additional Information" section for all users, especially the production department assigned to this task.</p>
            </Step>
          </div>
        </SubSection>
        <InfoBox type="tip">
          Department files are task-specific. Upload different files for different departments if they need different guidance. This keeps information targeted and relevant.
        </InfoBox>
      </div>
    ),
  },

  {
    id: 'l2-routing',
    icon: MapIcon,
    title: 'Building & Publishing Routings',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Managers can also build, edit, and publish routings, useful when Admin delegates production planning to you.
          The process is identical to the Admin routing flow.
        </p>
        <div className="space-y-0">
          <Step n={1} icon={FolderOpenIcon}   title="Open a project → Routing tab"><p>Click <strong>+ Create Routing</strong>. Name it clearly.</p></Step>
          <Step n={2} icon={ListBulletIcon}   title="Add steps in production order"><p>Each step = one production stage. Assign departments. Set dependency policy if multiple departments share a step.</p></Step>
          <Step n={3} icon={EyeIcon}          title="Review the draft carefully"><p>Check that every step has the right department, the order is correct, and dependency policies make sense. A wrong routing wastes production time.</p></Step>
          <Step n={4} icon={BoltIcon}         title="Publish, starts all tasks in Step 1"><p>All departments in Step 1 receive their tasks and get notified. Subsequent steps unlock automatically as steps complete.</p></Step>
        </div>
        <InfoBox type="info">
          Only Layer 2 and Admin can publish routings. Department Staff (Layer 3) have no access to routing at all, they only see the tasks generated by it.
        </InfoBox>
      </div>
    ),
  },

  {
    id: 'l2-reports',
    icon: DocumentTextIcon,
    title: 'Reading & Using Daily Reports',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Department Staff submit daily reports to document their progress. As a Manager, every report from every
          department is visible to you. Use them as your production journal and early-warning system.
        </p>
        <div className="space-y-0">
          <Step n={1} icon={DocumentTextIcon} title="Reports in the sidebar → browse all reports">
            <p>Sorted newest first. Each row shows: project name, department, submitted by, and date.</p>
          </Step>
          <Step n={2} icon={EyeIcon} title="Click any report to read it fully">
            <p>See the full work description, which task it relates to, and any attached files or photos.</p>
          </Step>
        </div>
        <InfoBox type="tip">
          If a department is not submitting reports for an active project, something is likely wrong, they may be stuck, waiting for a missing material, or dealing with a quality problem they haven't raised formally yet. Check in with them.
        </InfoBox>
      </div>
    ),
  },
]

const layer2FAQ: FAQItem[] = [
  { q: 'I approved an issue but it was a mistake. Can I reverse it?', a: 'Approvals cannot be directly undone. Use the Queries feature to communicate the correction to the department. If significant action is needed (like cancelling a rework), contact Admin.' },
  { q: 'How do I know when something needs my approval?', a: 'You receive an instant notification (bell icon in the top bar) whenever an issue, rework, or material request is raised. Your dashboard also shows a live count of pending approvals. Process them daily, departments are waiting on you.' },
  { q: 'Can I see tasks from all departments, not just one?', a: 'Yes. Open any project → Tasks tab. You can see all tasks across all departments for that project. You can also set dates and assign employees from here.' },
  { q: 'What is the difference between an Issue and a Rework Request?', a: 'An Issue is any problem blocking work, missing material, quality failure, design change, etc. A Rework Request is specifically one department formally asking another department to redo their output. Both need your approval before anything changes.' },
  { q: 'Can I view a project\'s routing to understand the production flow?', a: 'Yes. Open any project → Routing tab. You can see the full step-by-step routing, which departments are assigned to each step, and the current status of each task.' },
]

// ═══════════════════════════════════════════════════════════════
// LAYER 3 (DEPARTMENT STAFF) SECTIONS
// ═══════════════════════════════════════════════════════════════
const layer3Sections: Section[] = [
  {
    id: 'l3-overview',
    icon: UserCircleIcon,
    title: 'Department Staff, Your Role at a Glance',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          You are <strong>Layer 3 (Department Staff)</strong>. This platform is your daily work tool.
          You use it to receive production tasks from Admin, track your progress, report work done, raise
          problems formally, and communicate with colleagues through Queries. Everything you do here creates
          a clear, auditable record of your department's work.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <CapRow icon={ClipboardDocumentListIcon} label="My Tasks"            desc="See tasks currently assigned to your department from active projects." />
          <CapRow icon={CalendarDaysIcon}           label="Upcoming Tasks"     desc="Preview tasks queued for your department before they become active." />
          <CapRow icon={DocumentTextIcon}           label="Submit Daily Reports" desc="Document what your team worked on every day." />
          <CapRow icon={ExclamationCircleIcon}      label="Raise Issues"       desc="Formally flag problems that are blocking your work." />
          <CapRow icon={ArrowPathIcon}              label="Request Reworks"    desc="Ask another department to fix their work before you can continue." />
          <CapRow icon={CubeIcon}                  label="Material Requests"  desc="Submit formal requests for materials needed to complete tasks." />
          <CapRow icon={ArrowUpTrayIcon}            label="Upload Proof"       desc="Upload photos and files as proof of completed subtask work." />
          <CapRow icon={ChatBubbleLeftRightIcon}    label="Queries"            desc="Direct project-linked conversations with any colleague or manager." />
        </div>
        <InfoBox type="info">
          You only see tasks and issues for <strong>your own department</strong>. You cannot see other departments' work, client pricing, or the full routing. This keeps your dashboard focused on what's relevant to you.
        </InfoBox>
      </div>
    ),
  },

  {
    id: 'l3-how-you-get-work',
    icon: BoltIcon,
    title: 'How You Receive a Project Task, The Full Flow',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          You don't receive projects directly, you receive <strong>Tasks</strong> that belong to projects.
          Here is exactly how a task lands in your My Tasks list:
        </p>
        <div className="space-y-0">
          <Step n={1} icon={FolderOpenIcon} title="Admin creates a project">
            <p>A new customer order is entered as a project with all the details, PO number, specifications, files, delivery date.</p>
          </Step>
          <Step n={2} icon={MapIcon} title="Admin or Manager builds a Routing">
            <p>They design the production workflow, Step 1: your department, Step 2: next department, etc. They add your department to a specific step.</p>
          </Step>
          <Step n={3} icon={BoltIcon} title="Routing is Published → your task is created">
            <p>The moment they click Publish, the system automatically creates a task for your department. If you are in Step 1, your task becomes <Tag label="Pending" color="gray" /> immediately. If you are in Step 2 or later, it goes to Upcoming Tasks first.</p>
          </Step>
          <Step n={4} icon={BellIcon} title="You receive a notification">
            <p>The bell icon in the top bar shows a new notification, "New task assigned to [Your Department] for Project [Name]." Open My Tasks to find it.</p>
          </Step>
          <Step n={5} icon={ClipboardDocumentListIcon} title="Start working on the task">
            <p>Open the task from My Tasks. Read the description, check the project files, assign team members, set the status to In Progress, and start completing subtasks.</p>
          </Step>
        </div>
        <InfoBox type="tip">
          Use <strong>Upcoming Tasks</strong> to see what's coming to your department before it becomes active. This gives you time to prepare materials, tools, and your team in advance.
        </InfoBox>
      </div>
    ),
  },

  {
    id: 'l3-tasks',
    icon: ClipboardDocumentListIcon,
    title: 'Working Through Your Tasks',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          <strong>My Tasks</strong> shows all tasks currently assigned to your department from live projects.
          This is your main work list, check it every morning.
        </p>
        <SubSection icon={ListBulletIcon} title="Reading a Task Card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Each task card on My Tasks shows: Project Name, Task Title, Status badge, Due Date, and a subtask progress bar (e.g. "2 / 5 done"). Click the card to open the full task.</p>
        </SubSection>
        <SubSection icon={ClipboardDocumentCheckIcon} title="Inside the Task Detail Page">
          <div className="space-y-0">
            <Step n={1} icon={EyeIcon} title="Read the task description and check project files">
              <p>The task description tells you what your department needs to do. The parent project has CAD files, Job Cards, and Renders attached, use them as your reference.</p>
            </Step>
            <Step n={2} icon={InformationCircleIcon} title="Check Important Additional Information">
              <p>Look for the "Important Additional Information" section. This contains guided drawings and special instructions from upper departments that you must acknowledge before proceeding with your work.</p>
            </Step>
            <Step n={3} icon={PencilSquareIcon} title="Set status to In Progress">
              <p>Change the status from <Tag label="Pending" color="gray" /> to <Tag label="In Progress" color="blue" /> as soon as your team starts. This tells Admin and Managers that work has begun.</p>
            </Step>
            <Step n={4} icon={UserPlusIcon} title="Assign team members if needed">
              <p>If specific people in your department are responsible for this task, use Assign Employees to tag them. They receive a notification.</p>
            </Step>
            <Step n={5} icon={CheckCircleIcon} title="Complete subtasks one by one">
              <p>Tick off each subtask as you finish it. For subtasks that require photographic proof, click the upload button, uploading a file auto-completes that subtask.</p>
            </Step>
            <Step n={6} icon={CheckCircleIcon} title="Mark the full task as Completed when done">
              <p>When all subtasks are done and work is complete, set the status to <Tag label="Completed" color="dark" />. This automatically unlocks the next department's task in the routing.</p>
            </Step>
          </div>
        </SubSection>
        <SubSection icon={LockClosedIcon} title="Task Status Reference">
          <div className="space-y-1.5">
            {[
              ['Pending',     'Task is assigned but work hasn\'t started yet.'],
              ['In Progress', 'Your team is actively working on this task.'],
              ['Hold',        'Work is paused. You\'ve manually put it on hold.'],
              ['Issue Hold',  'Blocked by an open issue. Cannot complete until the issue is resolved.'],
              ['Completed',   'Work is done. The next department in routing is unlocked.'],
            ].map(([s, d]) => (
              <div key={s as string} className="flex items-start gap-2 text-sm">
                <Tag label={s as string} color={(s === 'In Progress') ? 'blue' : (s === 'Completed') ? 'dark' : 'gray'} />
                <span className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{d as string}</span>
              </div>
            ))}
          </div>
        </SubSection>
        <InfoBox type="warn">
          <strong>Issue Hold</strong> means an open issue is blocking this task. You cannot mark it as Completed until the issue is resolved and your Manager approves it. Raise the issue clearly so your Manager can process it quickly.
        </InfoBox>
      </div>
    ),
  },

  {
    id: 'l3-reports',
    icon: DocumentTextIcon,
    title: 'Daily Reports, Documenting Your Work',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          A Daily Report is a brief written record of what your team did on a project that day.
          It is visible to your Manager and Admin. Think of it as a two-minute daily check-in that
          creates a permanent paper trail protecting your team.
        </p>
        <SubSection icon={PlusCircleIcon} title="Submitting a Daily Report">
          <div className="space-y-0">
            <Step n={1} icon={DocumentTextIcon} title="Daily Reports in the sidebar → + New Report">
              <p>Select the project this report is about.</p>
            </Step>
            <Step n={2} icon={PencilSquareIcon} title="Link to a task (optional but recommended)">
              <p>If this report is about a specific task, select it. This makes it easier to trace work history.</p>
            </Step>
            <Step n={3} icon={PencilSquareIcon} title="Write a clear description">
              <p>What did your team do today? What was completed, what is in progress, any issues noticed? Even 2–3 sentences is fine. Be honest and specific.</p>
            </Step>
            <Step n={4} icon={ArrowUpTrayIcon} title="Attach photos or files if relevant">
              <p>After saving the report, upload images of work done. This is especially valuable for quality records, a photo proves the condition of the work at that point.</p>
            </Step>
          </div>
        </SubSection>
        <InfoBox type="warn">
          Reports cannot be edited after submission. If you made an error, submit a new report with the correct information and mention the correction. You can also use a Query to inform your Manager.
        </InfoBox>
        <InfoBox type="tip">
          One report per active project per day is the standard. It takes 2 minutes and protects your team if any quality dispute arises later, you have dated, documented evidence of what was done.
        </InfoBox>
      </div>
    ),
  },

  {
    id: 'l3-issues',
    icon: ExclamationCircleIcon,
    title: 'Raising an Issue, When Something Blocks Your Work',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          If something is stopping your team from completing a task, missing material, a quality problem with the
          previous department's work, a design discrepancy, or anything else, raise an Issue formally.
          <strong> Don't stay stuck silently.</strong> The system is built to handle this.
        </p>
        <SubSection icon={ListBulletIcon} title="Which Issue Type to Choose">
          <div className="space-y-1.5">
            {[
              ['Material Missing',       'You need a raw material that isn\'t available. Fill in material name, quantity, and unit.'],
              ['Design Change',          'Something in the design needs to change, client request or internal correction.'],
              ['Quality Issue (IQC)',     'The quality of work done doesn\'t meet standard. This triggers the IQC review process.'],
              ['Rework Required',         'Previous department\'s work needs to be redone before you can proceed.'],
              ['Routing Required',        'A production step not in the current routing is needed.'],
              ['Full Scale Requirement',  'A full-scale mock-up or template check is needed.'],
              ['Custom',                  'Any other problem not covered above. Describe it clearly.'],
            ].map(([t, d]) => (
              <div key={t as string} className="flex gap-2 text-sm py-1 border-b border-gray-100 dark:border-gray-700/40 last:border-0">
                <span className="font-semibold text-gray-800 dark:text-gray-200 w-44 flex-shrink-0">{t as string}</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs">{d as string}</span>
              </div>
            ))}
          </div>
        </SubSection>
        <SubSection icon={ArrowRightIcon} title="Raising an Issue Step by Step">
          <div className="space-y-0">
            <Step n={1} icon={PlusCircleIcon} title="Issues in sidebar → + New Issue">
              <p>Or raise it directly from inside the task detail page, there is a Raise Issue button there.</p>
            </Step>
            <Step n={2} icon={ListBulletIcon} title="Select the correct issue type">
              <p>Pick the type that best matches your problem. For quality issues, use Quality Issue, this triggers IQC review.</p>
            </Step>
            <Step n={3} icon={PencilSquareIcon} title="Write a clear title and description">
              <p>Be specific. "Fabric colour doesn't match render" is better than "fabric problem". Include dimensions, quantities, or specific defects where relevant.</p>
            </Step>
            <Step n={4} icon={ArrowUpTrayIcon} title="Attach photos or files">
              <p>After submitting, upload photos of the problem. A visual makes it much easier for your Manager to understand and approve quickly.</p>
            </Step>
            <Step n={5} icon={BellIcon} title="Your Manager receives a notification">
              <p>The issue is now <Tag label="Open" color="gray" />. Your Manager will Approve or Reject it. Wait for their decision, once approved, work on the fix.</p>
            </Step>
            <Step n={6} icon={CheckCircleIcon} title="Resolve the issue when the problem is fixed">
              <p>Open the issue → click <strong>Resolve</strong> → write a brief resolution note (what was done to fix it). The task then resumes from Issue Hold.</p>
            </Step>
          </div>
        </SubSection>
      </div>
    ),
  },

  {
    id: 'l3-rework-material',
    icon: ArrowPathIcon,
    title: 'Rework Requests & Material Requisitions',
    content: (
      <div className="space-y-5">
        <SubSection icon={ArrowPathIcon} title="Requesting a Rework">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            A Rework Request is specifically for when work handed to you by a previous department is incorrect
            and must be redone before you can proceed. For example, Upholstery finding the frame from
            Carpentry is uneven.
          </p>
          <div className="space-y-0">
            <Step n={1} icon={PlusCircleIcon}  title="Raise from the project page"><p>Specify which department needs to redo the work. Clearly describe what is wrong and what needs to be corrected.</p></Step>
            <Step n={2} icon={EyeIcon}         title="Manager reviews and approves"><p>Your Manager evaluates the rework request. If approved, the target department gets a new task. If rejected, you continue as-is.</p></Step>
            <Step n={3} icon={BellIcon}        title="You're notified when rework is done"><p>Once the other department completes the rework and marks it done, you receive a notification and can continue your task.</p></Step>
          </div>
          <InfoBox type="warn">
            Be specific about what needs to be fixed. The other department has to stop their own work to address this. A clear description means faster resolution.
          </InfoBox>
        </SubSection>

        <SubSection icon={CubeIcon} title="Requesting Materials">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            If your department needs materials that are not available, fabric, wood, hardware, polish, anything,
            raise a Material Requisition. This is the formal way to request a purchase or sourcing approval.
          </p>
          <div className="space-y-0">
            <Step n={1} icon={CubeIcon}        title="Raise from Issues or from the task page"><p>Give the requisition a clear title. Add individual material items, name, quantity, unit, estimated cost.</p></Step>
            <Step n={2} icon={EyeIcon}         title="Manager approves or rejects"><p>Your Manager reviews and either approves (materials can be sourced) or rejects with a reason. You're notified either way.</p></Step>
          </div>
          <InfoBox type="tip">
            Submit material requests as early as possible in the production cycle. Materials take time to arrive. A last-minute request delays not just your team but every department that comes after you in the routing.
          </InfoBox>
        </SubSection>
      </div>
    ),
  },

  {
    id: 'l3-upcoming',
    icon: CalendarDaysIcon,
    title: 'Upcoming Tasks, Plan Before Work Starts',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          <strong>Upcoming Tasks</strong> shows tasks that are queued for your department but not yet active, because
          the previous department in the routing hasn't completed their step yet.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Use this page to plan your week. If you know Carpentry is close to finishing and Upholstery is the next
          step, you can get your fabric, tools, and team ready so there's zero delay when the task lands in My Tasks.
        </p>
        <InfoBox type="tip">
          Check Upcoming Tasks every Monday morning. Even one day's head start on material preparation or team briefing can prevent delays.
        </InfoBox>
      </div>
    ),
  },
]

const layer3FAQ: FAQItem[] = [
  { q: 'I cannot see a project I am supposed to be working on.', a: 'You only see tasks assigned to your department. Ask your Manager or Admin to verify: (1) your department has been added to a routing step for that project, and (2) the routing has been published. If it\'s in Upcoming Tasks, the previous department hasn\'t finished yet.' },
  { q: 'My task is on Issue Hold and I cannot complete it.', a: 'An open issue is linked to this task. Go to Issues in the sidebar, find the open issue for this project, and check its status. If it\'s waiting for Manager approval, follow up with your Manager. Once the issue is resolved, your task will automatically unblock.' },
  { q: 'How do I upload proof for a subtask?', a: 'Open the task → find the subtask in the list → click the upload (arrow up) icon next to it. Select a photo or file. Once uploaded successfully, the subtask automatically marks itself as completed.' },
  { q: 'I submitted a report with wrong information. Can I edit it?', a: 'Reports cannot be edited after submission. Submit a new report with the correct information and note the correction in the description. You can also use a Query to inform your Manager directly.' },
  { q: 'How do I know what quality standard is expected for my task?', a: 'Open the task and read the description carefully. Then open the parent project from the task page, it has CAD files, Job Cards, and Render files attached under the Overview tab. These are your official work references.' },
  { q: 'I see my task is overdue but I am still working on it. What do I do?', a: 'Set the task to In Progress if it isn\'t already, this shows active work is happening. If you are blocked, raise an Issue so your Manager knows. If you need more time, contact your Manager via a Query or in person to update the expected completion date.' },
]

// ═══════════════════════════════════════════════════════════════
// SHARED SECTIONS
// ═══════════════════════════════════════════════════════════════
const sharedSections: Section[] = [
  {
    id: 'shared-queries',
    icon: ChatBubbleLeftRightIcon,
    title: 'Queries, Project-Linked Direct Messaging',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Queries is the built-in messaging system for project communication. Unlike WhatsApp or email,
          every query is linked to a specific project and creates a permanent, searchable record.
          You can send a query to anyone in the organisation.
        </p>
        <div className="space-y-0">
          <Step n={1} icon={ChatBubbleLeftRightIcon} title='Click the chat icon in the sidebar → + to start a new query'>
            <p>A panel slides in from the right side of your screen.</p>
          </Step>
          <Step n={2} icon={UserPlusIcon} title="Search for the recipient(s)">
            <p>Type a name or email. You can add multiple recipients, each gets their own separate chat thread.</p>
          </Step>
          <Step n={3} icon={FolderOpenIcon} title="Select the project and write the subject">
            <p>Pick the project this query is about. Add a clear subject. Write an initial message (optional).</p>
          </Step>
          <Step n={4} icon={ArrowUpTrayIcon} title="Chat back and forth, attach files">
            <p>Inside the chat, send messages and attach photos/documents. New messages auto-appear every 5 seconds, no need to refresh.</p>
          </Step>
          <Step n={5} icon={CheckCircleIcon} title="Mark as Resolved when the topic is closed">
            <p>Click the checkmark icon to mark your side as resolved. When both sides resolve, the query closes. Closed queries are read-only but permanently saved.</p>
          </Step>
        </div>
        <InfoBox type="tip">
          A blue dot on a query in the list means there are unread messages. Use Queries for anything that needs a documented record, it's more reliable than WhatsApp for professional follow-up.
        </InfoBox>
      </div>
    ),
  },
  {
    id: 'shared-notifications',
    icon: BellIcon,
    title: 'Notifications, Your Activity Feed',
    content: (
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          The bell icon in the top-right corner of every page shows your unread notification count.
          Notifications are sent automatically by the system whenever something relevant to you happens.
        </p>
        <div className="space-y-1">
          {[
            [BoltIcon,              'Task Assigned',              'A task has been routed to your department from a published routing.'],
            [ClockIcon,             'Task Overdue',               'A task is past its due date, sent to Admin & Manager every hour.'],
            [ExclamationCircleIcon, 'Issue Raised / Reviewed',    'Status changes on issues you raised or need to review.'],
            [ArrowPathIcon,         'Rework Decision',            'Your rework request was approved or rejected.'],
            [CubeIcon,             'Material Decision',           'Your material requisition was approved or rejected.'],
            [ChatBubbleLeftRightIcon,'Query Message',             'Someone sent you a message in a query.'],
            [DocumentTextIcon,     'Report Submitted',            '(Managers) A department submitted a daily report.'],
            [MapIcon,              'Routing Updated',             'A routing affecting your tasks was changed or versioned.'],
            [FolderOpenIcon,       'Project Revised',             'A project you\'re involved with has been edited by Admin.'],
          ].map(([Icon, type, desc]) => (
            <div key={type as string} className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-gray-700/40 last:border-0">
              {/* @ts-ignore */}
              <Icon className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{type as string}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">, {desc as string}</span>
              </div>
            </div>
          ))}
        </div>
        <InfoBox type="tip">
          Click <strong>Mark All as Read</strong> from the Notifications page to clear the badge counter. Individual notifications can also be marked as read by clicking them.
        </InfoBox>
      </div>
    ),
  },
  {
    id: 'shared-settings',
    icon: Cog6ToothIcon,
    title: 'Settings, Profile, Password & Theme',
    content: (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Click your name/avatar at the bottom of the sidebar to open Settings. Manage your personal account here.
        </p>
        <div className="space-y-2">
          <div className="flex items-start gap-3 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3">
            <CameraIcon className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Profile Avatar</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Hover over your avatar circle → click the camera icon → upload any image (max 5 MB). You can remove it any time using the Remove avatar link.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3">
            <KeyIcon className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Change Password</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Enter your current password, then your new password (minimum 8 characters). If you have forgotten your current password, contact your Admin, they can reset it for you without needing your old one.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3">
            <SunIcon className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Dark / Light Mode</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Click the sun/moon toggle in the Settings header to switch themes. Your preference is saved automatically in your browser.</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'shared-search',
    icon: MagnifyingGlassIcon,
    title: 'Search, Find Anything Instantly',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          The search bar in the top bar searches across projects, employees, and departments by name.
          Type a few letters and results appear immediately. Click any result to go directly to that page.
        </p>
        <InfoBox type="info">
          If you can't remember which section something is in, just search for it by name. You don't need to browse the sidebar menus.
        </InfoBox>
      </div>
    ),
  },
]

// (placeholder removed, using ArrowUpTrayIcon directly above)

const sharedFAQ: FAQItem[] = [
  { q: 'I was logged out suddenly. What happened?', a: 'Your session token may have expired (tokens have a limited lifespan), or your account may have been deactivated by Admin. Try logging in again. If login fails, contact your Admin.' },
  { q: 'Can I use this platform on my mobile phone?', a: 'No. This platform is designed for desktop use and is not optimized for small-screen devices such as mobile phones. Please use a tablet/desktop/laptop for the intended experience.' },
  { q: 'Something that used to be in my sidebar has disappeared.', a: 'Your sidebar menus are controlled by your account Layer (role). If something has disappeared, your account layer may have changed. Contact Admin to verify your account settings.' },
  { q: 'My notification count is very high. How do I clear it?', a: 'Read each notification carefully. After reviewing it, click the ✓ (tick) icon on the notification to mark it as read. Repeat this for all notifications until all unread notifications have been marked as read.' },
]

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT  (preserves user's edits to this section)
// ═══════════════════════════════════════════════════════════════
export default function HelpPage() {
  const { isAdmin, isLayerTwo } = useAuth()

  const roleSections = isAdmin ? adminSections : isLayerTwo ? layer2Sections : layer3Sections
  const roleFAQ      = isAdmin ? adminFAQ      : isLayerTwo ? layer2FAQ      : layer3FAQ
  const roleLabel    = isAdmin ? 'Admin'        : isLayerTwo ? 'Operator'      : 'Production Staff'

  const roleAccent   = 'bg-gray-900 dark:bg-white'

  const roleIcon = isAdmin ? ShieldCheckSolid : isLayerTwo ? WrenchScrewdriverIcon : UserCircleIcon
  const RoleIcon = roleIcon

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-900 dark:bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <QuestionMarkCircleIcon className="w-6 h-6 text-white dark:text-gray-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Help & User Guide</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Complete guide for using the Crafted Oak & Ore's (Project management System)</p>
            </div>
          </div>
          {/* Role badge */}
          <div className={clsx('hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl flex-shrink-0', roleAccent)}>
            <RoleIcon className="w-4 h-4 text-white dark:text-gray-900 flex-shrink-0" />
            <span className="text-xs font-bold text-white dark:text-gray-900 whitespace-nowrap">{roleLabel}</span>
          </div>
        </div>
      </div>

      {/* ── Role sections ──────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className={clsx('w-1.5 h-5 rounded-full', roleAccent)} />
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            {roleLabel} Guide
          </h2>
        </div>
      </div>

      <div className="space-y-4">
        {roleSections.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}
      </div>

      {/* ── Shared sections ────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-5 rounded-full bg-gray-300 dark:bg-gray-600" />
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            Features Available to Everyone
          </h2>
        </div>
      </div>

      <div className="space-y-4">
        {sharedSections.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}
      </div>

      {/* ── Role FAQ ───────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center">
            <QuestionMarkCircleIcon className="w-4 h-4 text-white dark:text-gray-900" />
          </span>
          <h2 className="font-bold text-base text-gray-900 dark:text-gray-100">
            FAQ, {roleLabel}
          </h2>
        </div>
        <div className="card-body">
          <FAQAccordion items={roleFAQ} />
        </div>
      </div>

      {/* ── Common FAQ ─────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <QuestionMarkCircleIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </span>
          <h2 className="font-bold text-base text-gray-900 dark:text-gray-100">Common Questions (All Roles)</h2>
        </div>
        <div className="card-body">
          <FAQAccordion items={sharedFAQ} />
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gray-200 dark:bg-gray-800 px-6 py-8 text-center space-y-3">
        <p className="text-xl font-bold text-gray-800 dark:text-white">Still have a question?</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          If something isn't covered here, reach out to your Admin directly or raise a Query to relevant person mentioned below.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <a
            href="mailto:bot@oaknore.in"
            className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-gray-900 px-5 py-2.5 text-sm font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-colors"
          >
            <EnvelopeIcon className="w-4 h-4" />
            bot@oaknore.in
          </a>
          <a
            href="mailto:productdesign@oaknore.in"
            className="inline-flex items-center gap-2 rounded-full border border-gray-400 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            <EnvelopeIcon className="w-4 h-4" />
            productdesign@oaknore.in
          </a>
        </div>
      </div>

    </div>
  )
}
