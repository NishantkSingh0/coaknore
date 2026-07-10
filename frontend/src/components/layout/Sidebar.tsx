import { NavLink } from 'react-router-dom'
import {
  HomeIcon, FolderIcon, ClipboardDocumentListIcon,
  ExclamationCircleIcon, ArrowPathIcon, DocumentTextIcon,
  CubeIcon, BellIcon, UserGroupIcon, BuildingOfficeIcon,
  ChatBubbleLeftRightIcon, Cog6ToothIcon, WrenchScrewdriverIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '../../context/AuthContext'
import clsx from 'clsx'
import { Avatar } from '../ui/Avatar'

interface Props {
  onOpenQueries: () => void
  onOpenAIAssistant: () => void
}

const navItem = (to: string, label: string, Icon: React.ComponentType<{ className?: string }>) => ({
  to, label, Icon,
})

export default function Sidebar({ onOpenQueries, onOpenAIAssistant }: Props) {
  const { user, isAdmin, isLayerTwo, isLayerThree } = useAuth()

  const commonNav = [
    navItem('/dashboard', 'Dashboard', HomeIcon),
  ]

  const layer3Nav = [
    navItem('/tasks', 'My Tasks', ClipboardDocumentListIcon),
    navItem('/issues', 'Issues', ExclamationCircleIcon),
    navItem('/reworks', 'Reworks', ArrowPathIcon),
    navItem('/reports', 'Daily Reports', DocumentTextIcon),
    navItem('/materials', 'Materials', CubeIcon),
  ]

  const layer2Nav = [
    navItem('/projects', 'Projects', FolderIcon),
    navItem('/issues', 'Issues', ExclamationCircleIcon),
    navItem('/reworks', 'Reworks', ArrowPathIcon),
    navItem('/reports', 'Reports', DocumentTextIcon),
    navItem('/materials', 'Materials', CubeIcon),
  ]

  const adminNav = [
    navItem('/projects', 'Projects', FolderIcon),
    navItem('/employees', 'Employees', UserGroupIcon),
    navItem('/sdepartments', 'Departments', BuildingOfficeIcon),
    navItem('/issues', 'Issues', ExclamationCircleIcon),
    navItem('/reworks', 'Reworks', ArrowPathIcon),
    navItem('/reports', 'Reports', DocumentTextIcon),
    navItem('/materials', 'Materials', CubeIcon),
  ]

  const roleNav = isAdmin ? adminNav : isLayerTwo ? layer2Nav : layer3Nav

  return (
    <aside className="group w-[70px] hover:w-64 bg-white border-r border-gray-200 flex flex-col h-full flex-shrink-0 transition-all duration-300 overflow-hidden">
      <div className="h-[55px] flex items-center px-2 mx-3 border-b-2 border-gray-200">
        <div className="group/logo flex items-center gap-2">
          <img
            src="/invertedLogo.png"
            alt="Logo"
            className="w-8 h-8 transition-transform duration-[1500ms] ease-in-out group-hover/logo:rotate-[360deg]"
          />
          <div className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 whitespace-nowrap">
            <p className="text-sm font-bold text-gray-900 pb-1 leading-none">
              Crafted Oak & Ore
            </p>
            <p className="text-xs text-gray-400 leading-none text-center">
              Luxury Goods Atelier
            </p>
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
            <span
              className="whitespace-nowrap opacity-0 max-w-0 overflow-hidden group-hover:opacity-100 group-hover:max-w-40 transition-all duration-300"
            >
              {label}
            </span>
          </NavLink>
        ))}

        {/* Query Button */}
        <button
          onClick={onOpenQueries}
          className="w-full sidebar-item-inactive"
        >
          <ChatBubbleLeftRightIcon className="w-5 h-5 flex-shrink-0" />
          <span
            className=" whitespace-nowrap opacity-0 max-w-0 overflow-hidden group-hover:opacity-100 group-hover:max-w-40 transition-all duration-300"
          >
            Queries
          </span>
        </button>

        {/* AI Assistant Button - Admin Only */}
        {isAdmin && (
          <button
            onClick={onOpenAIAssistant}
            className="w-full sidebar-item-inactive"
          >
            <SparklesIcon className="w-5 h-5 flex-shrink-0" />
            <span
              className=" whitespace-nowrap opacity-0 max-w-0 overflow-hidden group-hover:opacity-100 group-hover:max-w-40 transition-all duration-300"
            >
              AI Assistant
            </span>
          </button>
        )}
      </nav>

      {/* User info at bottom */}
      <NavLink
        to="/settings"
        className="block mx-2 px-2 py-3 border-t-2 border-gray-200 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Avatar src={user?.avatar_url} firstName={user?.first_name} lastName={user?.last_name} size="sm" />

          <div className="min-w-0 opacity-0 max-w-0 overflow-hidden group-hover:opacity-100 group-hover:max-w-40 transition-all duration-300">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.first_name} {user?.last_name}
            </p>

            <p className="text-xs text-gray-400 truncate capitalize">
              {user?.department_name || "Admin"}
            </p>
          </div>
        </div>
      </NavLink>
    </aside>
  )
}
