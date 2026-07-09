import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Authentication
import LoginPage from './pages/LoginPage'

// Layout
import AppLayout from './components/layout/AppLayout'

// Application Pages
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ProjectFormPage from './pages/ProjectFormPage'
import EmployeesPage from './pages/EmployeesPage'
import DepartmentsPage from './pages/DepartmentsPage'
import IssuesPage from './pages/IssuesPage'
import IssueDetailPage from './pages/IssueDetailPage'
import ReworksPage from './pages/ReworksPage'
import ReportsPage from './pages/ReportsPage'
import MaterialsPage from './pages/MaterialsPage'
import NotificationsPage from './pages/NotificationsPage'
import MyTasksPage from './pages/MyTasksPage'
import TaskDetailPage from './pages/TaskDetailPage'
import SettingsPage from './pages/SettingsPage'

// Website Pages
import Home from './HomePages/Home'
import About from './HomePages/About'
import Products from './HomePages/Products'
import Services from './HomePages/Services'
import Departments from './HomePages/Departments'
import Contact from './HomePages/Contact'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* ---------------- Public Website ---------------- */}
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/products" element={<Products />} />
      <Route path="/services" element={<Services />} />
      <Route path="/departments" element={<Departments />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/login" element={<LoginPage />} />

      {/* ---------------- Protected Application ---------------- */}
      <Route element={<RequireAuth> <AppLayout /> </RequireAuth>}>
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/new" element={<ProjectFormPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/projects/:id/edit" element={<ProjectFormPage />} />

        <Route path="/tasks" element={<MyTasksPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />

        <Route path="/issues" element={<IssuesPage />} />
        <Route path="/issues/:id" element={<IssueDetailPage />} />

        <Route path="/reworks" element={<ReworksPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/materials" element={<MaterialsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />

        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/sdepartments" element={<DepartmentsPage />} />

        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* ---------------- 404 ---------------- */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}