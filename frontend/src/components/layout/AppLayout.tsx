import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import QuerySidebar from '../queries/QuerySidebar'
import { useState } from 'react'

export default function AppLayout() {
  const [querySidebarOpen, setQuerySidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left Sidebar */}
      <Sidebar onOpenQueries={() => setQuerySidebarOpen(true)} />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Right Query Sidebar */}
      <QuerySidebar open={querySidebarOpen} onClose={() => setQuerySidebarOpen(false)} />
    </div>
  )
}
