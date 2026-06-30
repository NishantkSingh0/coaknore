export const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-gray-100 text-gray-700',
  routing_set: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed:   'bg-green-100 text-green-700',
  on_hold:     'bg-red-100 text-red-700',
  // task statuses
  hold:        'bg-orange-100 text-orange-700',
  issue_hold:  'bg-purple-100 text-purple-700',
}

export const STATUS_LABELS: Record<string, string> = {
  pending:     'Pending',
  routing_set: 'Routing Set',
  in_progress: 'In Progress',
  completed:   'Completed',
  on_hold:     'On Hold',
  hold:        'Hold',
  issue_hold:  'Issue Hold',
}

export const ISSUE_TYPES = [
  { value: 'item_missing',       label: 'Item Missing' },
  { value: 'design_change',      label: 'Design Change' },
  { value: 'routing_required',   label: 'Routing Required' },
  { value: 'fullscale_required', label: 'Full Scale Required' },
  { value: 'rework_required',    label: 'Rework Required' },
] as const

export const ISSUE_STATUS_COLORS: Record<string, string> = {
  open:             'bg-red-100 text-red-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  approved:         'bg-green-100 text-green-700',
  rejected:         'bg-gray-100 text-gray-600',
  closed:           'bg-blue-100 text-blue-700',
}

export const ROUTES = {
  LOGIN:              '/login',
  ADMIN_DASHBOARD:    '/admin/dashboard',
  ADMIN_PROJECTS:     '/admin/projects',
  ADMIN_PROJECT_NEW:  '/admin/projects/new',
  ADMIN_PROJECT:      '/admin/projects/:id',
  ADMIN_EMPLOYEES:    '/admin/employees',
  ADMIN_DEPARTMENTS:  '/admin/departments',
  ADMIN_REPORTS:      '/admin/reports',
  PROD_DASHBOARD:     '/production/dashboard',
  PROD_PROJECTS:      '/production/projects',
  PROD_ROUTING:       '/production/projects/:id/routing',
  PROD_ISSUES:        '/production/issues',
  PROD_REPORTS:       '/production/reports',
  L2_DASHBOARD:       '/layer2/dashboard',
  L2_PROJECTS:        '/layer2/projects',
  L2_REPORTS:         '/layer2/reports',
  DEPT_DASHBOARD:     '/dept/dashboard',
  DEPT_TASK:          '/dept/tasks/:taskId',
  DEPT_REPORT_NEW:    '/dept/reports/new',
  DEPT_ISSUES:        '/dept/issues',
} as const
