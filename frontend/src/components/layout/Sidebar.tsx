import { NavLink } from 'react-router-dom'
import {
  HomeIcon, FolderIcon, ClipboardDocumentListIcon,
  ExclamationCircleIcon, ArrowPathIcon, DocumentTextIcon,
  CubeIcon, BellIcon, UserGroupIcon, BuildingOfficeIcon,
  ChatBubbleLeftRightIcon, Cog6ToothIcon, WrenchScrewdriverIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '../../context/AuthContext'
import clsx from 'clsx'

interface Props {
  onOpenQueries: () => void
}

const navItem = (to: string, label: string, Icon: React.ComponentType<{ className?: string }>) => ({
  to, label, Icon,
})

export default function Sidebar({ onOpenQueries }: Props) {
  const { user, isAdmin, isLayerTwo } = useAuth()

  const commonNav = [
    navItem('/dashboard', 'Dashboard', HomeIcon),
    navItem('/projects', 'Projects', FolderIcon),
    navItem('/notifications', 'Notifications', BellIcon),
  ]

  const layer3Nav = [
    navItem('/tasks', 'My Tasks', ClipboardDocumentListIcon),
    navItem('/issues', 'Issues', ExclamationCircleIcon),
    navItem('/reworks', 'Reworks', ArrowPathIcon),
    navItem('/reports', 'Daily Reports', DocumentTextIcon),
    navItem('/materials', 'Materials', CubeIcon),
  ]

  const layer2Nav = [
    navItem('/issues', 'Issues', ExclamationCircleIcon),
    navItem('/reworks', 'Reworks', ArrowPathIcon),
    navItem('/reports', 'Reports', DocumentTextIcon),
    navItem('/materials', 'Materials', CubeIcon),
  ]

  const adminNav = [
    navItem('/employees', 'Employees', UserGroupIcon),
    navItem('/departments', 'Departments', BuildingOfficeIcon),
    navItem('/issues', 'Issues', ExclamationCircleIcon),
    navItem('/reworks', 'Reworks', ArrowPathIcon),
    navItem('/reports', 'Reports', DocumentTextIcon),
    navItem('/materials', 'Materials', CubeIcon),
  ]

  const roleNav = isAdmin ? adminNav : isLayerTwo ? layer2Nav : layer3Nav

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full flex-shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <WrenchScrewdriverIcon className="w-8 h-8 text-brand-600" />
          <div>
            <p className="text-sm font-bold text-gray-900 leading-none">PMS</p>
            <p className="text-xs text-gray-400 leading-none">Production System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {[...commonNav, ...roleNav].map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(isActive ? 'sidebar-item-active' : 'sidebar-item-inactive')
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}

        {/* Query Button */}
        <button
          onClick={onOpenQueries}
          className="w-full sidebar-item-inactive"
        >
          <ChatBubbleLeftRightIcon className="w-5 h-5 flex-shrink-0" />
          <span>Queries</span>
        </button>

        {/* Settings */}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx(isActive ? 'sidebar-item-active' : 'sidebar-item-inactive')
          }
        >
          <Cog6ToothIcon className="w-5 h-5 flex-shrink-0" />
          <span>Settings</span>
        </NavLink>
      </nav>

      {/* User info at bottom */}
      <div className="px-4 py-3 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
            <span className="text-brand-700 text-xs font-semibold">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-gray-400 truncate capitalize">
              {user?.layer?.replace('_', ' ')}
              {user?.department_name ? ` · ${user.department_name}` : ''}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
