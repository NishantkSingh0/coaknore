/** Go nil slices encode as JSON null; these keys are always arrays in our API. */
const ARRAY_KEYS = new Set([
  'data',
  'projects',
  'routing',
  'tasks',
  'users',
  'departments',
  'issues',
  'reports',
  'notifications',
  'items',
  'recent_projects',
  'today_reports',
  'pending_issues',
])

function isArrayField(key: string, parent: Record<string, unknown>): boolean {
  if (ARRAY_KEYS.has(key)) return true
  // API envelope: { success: true, data: null } → empty list
  if (key === 'data' && parent.success === true && parent.error == null) return true
  return false
}

/** Recursively convert Go null slices/objects to frontend-safe empty arrays. */
export function normalizeGoResponse(
  value: unknown,
  parent?: Record<string, unknown>,
  key?: string,
): unknown {
  if (value === null || value === undefined) {
    if (key && parent && isArrayField(key, parent)) return []
    return value ?? null
  }

  if (Array.isArray(value)) {
    return value.map(v => normalizeGoResponse(v))
  }

  if (typeof value === 'object') {
    const src = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(src)) {
      out[k] = normalizeGoResponse(src[k], src, k)
    }
    return out
  }

  return value
}
