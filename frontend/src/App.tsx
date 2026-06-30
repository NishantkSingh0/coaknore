import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/auth/LoginPage'

// Home pages
import Home     from './HomePages/Home';
import About    from './HomePages/About';
import Products from './HomePages/Products';
import Services from './HomePages/Services';
import Departments  from './HomePages/Departments';
import Contact  from './HomePages/Contact';

// Admin
import { AdminDashboard }    from './pages/admin/AdminDashboard'
import { ProjectsPage }      from './pages/admin/ProjectsPage'
import { ProjectDetailPage } from './pages/admin/ProjectDetailPage'
import { EmployeesPage }     from './pages/admin/EmployeesPage'
import { DepartmentsPage }   from './pages/admin/DepartmentsPage'
import { ReportsPage }       from './pages/admin/ReportsPage'

// Production (L2)
import { ProductionDashboard }     from './pages/production/ProductionDashboard'
import { ProductionProjectsPage }  from './pages/production/ProductionProjectsPage'
import { RoutingPage }             from './pages/production/RoutingPage'
import { IssuesPage }              from './pages/production/IssuesPage'

// Dept (L3)
import { DeptDashboard }    from './pages/dept/DeptDashboard'
import { TaskDetailPage }   from './pages/dept/TaskDetailPage'
import { DeptIssuesPage }   from './pages/dept/DeptIssuesPage'
import { SubmitReportPage } from './pages/dept/SubmitReportPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/products" element={<Products />} />
        <Route path="/services" element={<Services />} />
        <Route path="/departments" element={<Departments />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Admin layout */}
        <Route element={<AppLayout title="Admin" />}>
          <Route path="/admin/dashboard"        element={<AdminDashboard />} />
          <Route path="/admin/projects"         element={<ProjectsPage />} />
          <Route path="/admin/projects/new"     element={<ProjectsPage />} />
          <Route path="/admin/projects/:id"     element={<ProjectDetailPage />} />
          <Route path="/admin/employees"        element={<EmployeesPage />} />
          <Route path="/admin/departments"      element={<DepartmentsPage />} />
          <Route path="/admin/reports"          element={<ReportsPage />} />
        </Route>

        {/* Production (L2) layout */}
        <Route element={<AppLayout title="Production" />}>
          <Route path="/production/dashboard"              element={<ProductionDashboard />} />
          <Route path="/production/projects"               element={<ProductionProjectsPage />} />
          <Route path="/production/projects/:id/routing"   element={<RoutingPage />} />
          <Route path="/production/issues"                 element={<IssuesPage />} />
          <Route path="/production/reports"                element={<ReportsPage />} />
          {/* L2-Operation and L2-Floor share the same views (read-only) */}
          <Route path="/layer2/dashboard"      element={<ProductionDashboard />} />
          <Route path="/layer2/projects"       element={<ProductionProjectsPage />} />
          <Route path="/layer2/reports"        element={<ReportsPage />} />
        </Route>

        {/* Dept (L3) layout */}
        <Route element={<AppLayout title="Department" />}>
          <Route path="/dept/dashboard"     element={<DeptDashboard />} />
          <Route path="/dept/tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="/dept/issues"        element={<DeptIssuesPage />} />
          <Route path="/dept/reports/new"   element={<SubmitReportPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/about" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
