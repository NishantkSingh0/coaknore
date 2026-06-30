import { type Role } from '../types'

/** Format ISO date string to "DD MMM YYYY" */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

/** Format ISO datetime string to "DD MMM YYYY, HH:MM" */
export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Format a number as Indian Rupees */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount)
}

/** Returns the root route for a given role */
export function getRoleRoute(role: Role, deptLayer?: number): string {
  if (role === 'admin') return '/admin/dashboard'
  if (role === 'layer2') return '/production/dashboard'
  if (role === 'layer3') return '/dept/dashboard'
  return '/login'
}

/** Card background class based on task overdue/completed state */
export function taskCardBg(status: string, isOverdue: boolean): string {
  if (status === 'completed') return 'bg-[#F0FFF4]'
  if (isOverdue)              return 'bg-[#FFF0F0]'
  return 'bg-white'
}

/** Returns initials from a name */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Truncates text to maxLen with ellipsis */
export function truncate(text: string, maxLen = 80): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '…'
}
