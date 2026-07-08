import { format, formatDistanceToNow, parseISO } from 'date-fns'
import type {
  ProjectStatus, TaskStatus, IssueStatus, ReworkStatus,
  MaterialRequestStatus, QueryStatus, LayerType
} from '../types'

export const fmtDate = (d?: string | null) => {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd MMM yyyy') } catch { return d }
}

export const fmtDateTime = (d?: string | null) => {
  if (!d) return '—'
  try { return format(parseISO(d), 'dd MMM yyyy, HH:mm') } catch { return d }
}

export const fmtRelative = (d?: string | null) => {
  if (!d) return '—'
  try { return formatDistanceToNow(parseISO(d), { addSuffix: true }) } catch { return d }
}

export const fmtBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ---- Status helpers ----

export const projectStatusLabel: Record<ProjectStatus, string> = {
  created: 'Created',
  routing: 'Routing',
  in_progress: 'In Progress',
  completed: 'Completed',
  archived: 'Archived',
  on_hold: 'On Hold',
}

export const projectStatusColor: Record<ProjectStatus, string> = {
  created: 'badge-gray',
  routing: 'badge-blue',
  in_progress: 'badge-green',
  completed: 'badge-purple',
  archived: 'badge-gray',
  on_hold: 'badge-yellow',
}

export const taskStatusLabel: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  hold: 'On Hold',
  issue_hold: 'Issue Hold',
  completed: 'Completed',
}

export const taskStatusColor: Record<TaskStatus, string> = {
  pending: 'badge-gray',
  in_progress: 'badge-blue',
  hold: 'badge-yellow',
  issue_hold: 'badge-red',
  completed: 'badge-green',
}

export const issueStatusColor: Record<IssueStatus, string> = {
  open: 'badge-red',
  pending_approval: 'badge-yellow',
  approved: 'badge-blue',
  rejected: 'badge-gray',
  resolved: 'badge-green',
  closed: 'badge-gray',
}

export const reworkStatusColor: Record<ReworkStatus, string> = {
  pending: 'badge-yellow',
  approved: 'badge-blue',
  rejected: 'badge-gray',
  in_progress: 'badge-green',
  completed: 'badge-purple',
}

export const matStatusColor: Record<MaterialRequestStatus, string> = {
  pending: 'badge-yellow',
  approved: 'badge-green',
  rejected: 'badge-red',
  fulfilled: 'badge-purple',
}

export const queryStatusColor: Record<QueryStatus, string> = {
  open: 'badge-green',
  sender_resolved: 'badge-yellow',
  recipient_resolved: 'badge-yellow',
  closed: 'badge-gray',
}

export const layerLabel: Record<LayerType, string> = {
  super_admin: 'Super Admin',
  layer1: 'Admin',
  layer2: 'Production Mgmt',
  layer3: 'Execution',
}

export const priorityLabel: Record<number, string> = {
  1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical',
}
export const priorityColor: Record<number, string> = {
  1: 'badge-gray', 2: 'badge-blue', 3: 'badge-yellow', 4: 'badge-red',
}

export const issueTypeLabel: Record<string, string> = {
  material_missing: 'Material Missing',
  design_change: 'Design Change',
  routing_required: 'Routing Required',
  full_scale_requirement: 'Full Scale Requirement',
  quality_issue: 'Quality Issue',
  rework_required: 'Rework Required',
  custom: 'Custom',
}
