import { NavLink, useNavigate } from 'react-router-dom'
import {
  HomeIcon, FolderIcon, ClipboardDocumentListIcon,
  ExclamationCircleIcon, DocumentTextIcon,
  UserGroupIcon, BuildingOfficeIcon,
  ChatBubbleLeftRightIcon,
  SparklesIcon, CalendarIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '../../context/AuthContext'
import clsx from 'clsx'
import { Avatar } from '../ui/Avatar'
import { useState } from 'react'
import HelpIcon from './HelpIcon'

interface Props {
  onOpenQueries: () => void
  onOpenAIAssistant: () => void
}

const navItem = (to: string, label: string, Icon: React.ComponentType<{ className?: string }>) => ({
  to, label, Icon,
})

export default function Sidebar({ onOpenQueries, onOpenAIAssistant }: Props) {
  const { user, isAdmin, isLayerTwo, isLayerThree } = useAuth()
  const [anim, setAnim] = useState("");
  const navigate = useNavigate()
  const commonNav = [
    navItem('/dashboard', 'Dashboard', HomeIcon),
  ]

  const layer3Nav = [
    navItem('/tasks', 'My Tasks', ClipboardDocumentListIcon),
    navItem('/upcoming-tasks', 'Upcoming Tasks', CalendarIcon),
    navItem('/issues', 'Issues', ExclamationCircleIcon),
    navItem('/reports', 'Daily Reports', DocumentTextIcon),
  ]

  const layer2Nav = [
    navItem('/projects', 'Projects', FolderIcon),
    navItem('/issues', 'Issues', ExclamationCircleIcon),
    navItem('/reports', 'Reports', DocumentTextIcon),
  ]

  const adminNav = [
    navItem('/projects', 'Projects', FolderIcon),
    navItem('/employees', 'Staffs', UserGroupIcon),
    navItem('/sdepartments', 'Departments', BuildingOfficeIcon),
    navItem('/issues', 'Issues', ExclamationCircleIcon),
    navItem('/reports', 'Reports', DocumentTextIcon),
  ]

  const roleNav = isAdmin ? adminNav : isLayerTwo ? layer2Nav : layer3Nav

  return (
    <aside className="group w-[70px] hover:w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full flex-shrink-0 transition-all duration-300 overflow-hidden">
      <div className="h-[55px] flex items-center px-2 mx-3 border-b-2 border-gray-200 dark:border-gray-800">
        <div className="group/logo flex items-center gap-2">
          <img
            src="/invertedLogo.png"
            alt="Logo"
            onMouseEnter={() => {
              setAnim("");
              requestAnimationFrame(() => setAnim("animate-logo-spin"));
            }}
            onMouseLeave={() => {
              setAnim("");
              requestAnimationFrame(() => setAnim("animate-logo-spin"));
            }}
            onAnimationEnd={() => setAnim("")}
            className={clsx("w-8 h-8", anim)}
          />
          <div className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 whitespace-nowrap">
            <p className="text-sm font-bold text-gray-900 dark:text-white pb-1 leading-none">
              Crafted Oak & Ore
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-300 leading-none text-center">
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
            <Icon className="w-5 h-5 flex-shrink-0 text-gray-600 dark:text-gray-300" />
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
          <ChatBubbleLeftRightIcon className="w-5 h-5 flex-shrink-0 text-gray-600 dark:text-gray-300" />
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
            <SparklesIcon className="w-5 h-5 flex-shrink-0 text-gray-600 dark:text-gray-300" />
            <span
              className=" whitespace-nowrap opacity-0 max-w-0 overflow-hidden group-hover:opacity-100 group-hover:max-w-40 transition-all duration-300"
            >
              AI Assistant
            </span>
          </button>
        )}
      </nav>

      {/* Bottom strip: Settings (left) + Help button (right) */}
      <div className="flex items-center border-t-2 border-gray-200 dark:border-gray-800">
        {/* Settings — takes remaining width */}
        <NavLink
          to="/settings"
          className="flex-1 min-w-0 py-3 transition-colors"
        >
          <div className="flex items-center gap-2 ml-[18px]">
            <Avatar src={user?.avatar_url} firstName={user?.first_name} lastName={user?.last_name} size="sm" />
            <div className="min-w-0 opacity-0 max-w-0 overflow-hidden group-hover:opacity-100 group-hover:max-w-40 transition-all duration-300">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-300 truncate capitalize">
                {user?.department_name || "Admin"}
              </p>
            </div>
          </div>
        </NavLink>

        {/* Help button — fixed width, right end */}
        <div
          className="flex-shrink-0 pr-4 py-3 opacity-0 max-w-0 overflow-hidden group-hover:opacity-100 group-hover:max-w-[56px] transition-all duration-300"
          onClick={() => navigate('/help')}
        >
          <HelpIcon />
        </div>
      </div>
    </aside>
  )
}
