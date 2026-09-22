# React Query Migration Guide

## Before (Custom Cache System)

```typescript
// Old way with manual cache management
import { orgApi } from '../services/api'

function DepartmentList() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        setLoading(true)
        const data = await orgApi.listDepartments()
        setDepartments(data)
      } catch (err) {
        setError('Failed to load departments')
      } finally {
        setLoading(false)
      }
    }
    loadDepartments()
  }, [])

  const handleCreate = async (data) => {
    try {
      await orgApi.createDepartment(data)
      // Manual cache invalidation needed
      await loadDepartments() // Refetch manually
    } catch (err) {
      setError('Failed to create department')
    }
  }

  if (loading) return <Spinner />
  if (error) return <Error message={error} />

  return (
    <div>
      {departments.map(dept => <DepartmentCard key={dept.id} dept={dept} />)}
      <CreateDepartmentForm onSubmit={handleCreate} />
    </div>
  )
}
```

## After (React Query)

```typescript
// New way with React Query hooks
import { useDepartments, useCreateDepartment } from '../hooks/useQueries'

function DepartmentList() {
  const { data: departments, isLoading, error } = useDepartments()
  const createDepartment = useCreateDepartment()

  const handleCreate = async (data) => {
    try {
      await createDepartment.mutateAsync(data)
      // Cache invalidation happens automatically!
      // UI updates automatically with fresh data
    } catch (err) {
      // Error handling built-in
    }
  }

  if (isLoading) return <Spinner />
  if (error) return <Error message={error.message} />

  return (
    <div>
      {departments?.map(dept => <DepartmentCard key={dept.id} dept={dept} />)}
      <CreateDepartmentForm onSubmit={handleCreate} />
    </div>
  )
}
```

## Key Benefits

### 1. **Automatic Cache Invalidation**
```typescript
// Old: Manual invalidation
cacheService.invalidate('/departments')

// New: Automatic invalidation
useMutation({
  mutationFn: orgApi.createDepartment,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['departments'] })
  },
})
```

### 2. **Stale-While-Revalidate**
```typescript
// Shows cached data immediately, refreshes in background
useQuery({
  queryKey: ['projects'],
  queryFn: projectApi.list,
  staleTime: 2 * 60 * 1000, // 2 minutes
})
```

### 3. **Smart Refetching**
```typescript
// Refetches automatically on:
// - Window focus (user returns to tab)
// - Network reconnection
// - Component remount (if stale)
// - Manual trigger (refetch())
```

### 4. **Built-in Loading/Error States**
```typescript
const { data, isLoading, error, isFetching } = useQuery({
  queryKey: ['projects'],
  queryFn: projectApi.list,
})

// isLoading: First load only
// isFetching: Any background refetch
// error: Automatic error handling
```

### 5. **Optimistic Updates**
```typescript
const updateProject = useMutation({
  mutationFn: projectApi.update,
  onMutate: async (newProject) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['projects'] })
    
    // Snapshot previous value
    const previousProjects = queryClient.getQueryData(['projects'])
    
    // Optimistically update
    queryClient.setQueryData(['projects'], newProject)
    
    return { previousProjects }
  },
  onError: (err, newProject, context) => {
    // Rollback on error
    queryClient.setQueryData(['projects'], context.previousProjects)
  },
})
```

## Migration Steps

### Step 1: Replace API calls with hooks
```typescript
// Before
const data = await orgApi.listDepartments()

// After
const { data } = useDepartments()
```

### Step 2: Replace mutations
```typescript
// Before
const handleCreate = async (data) => {
  await orgApi.createDepartment(data)
  // Manual refetch
  loadDepartments()
}

// After
const createDepartment = useCreateDepartment()
const handleCreate = async (data) => {
  await createDepartment.mutateAsync(data)
  // Automatic refetch
}
```

### Step 3: Remove manual state management
```typescript
// Before
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)
const [data, setData] = useState(null)

// After
const { data, isLoading, error } = useDepartments()
```

### Step 4: Remove useEffect for data fetching
```typescript
// Before
useEffect(() => {
  loadData()
}, [deps])

// After
// Removed - React Query handles dependencies automatically
```

## Performance Benefits

### For Your 10-User Setup:
- **60-80% fewer API calls** (similar to your current cache)
- **Better UX** - instant data display with background refresh
- **Automatic optimization** - no manual cache management
- **DevTools monitoring** - track cache hit rates

### Cache Configuration for Your Use Case:
```typescript
// Static data (departments, org)
staleTime: 10 * 60 * 1000  // 10 minutes

// Dynamic data (projects, tasks)
staleTime: 1 * 60 * 1000   // 1 minute

// Real-time data (notifications)
staleTime: 30 * 1000       // 30 seconds
refetchInterval: 60 * 1000 // Auto-refresh every minute
```

## DevTools

Install React Query DevTools to monitor:
- Cache hit rates
- Query status
- Mutation states
- Cache contents

Open with: `Alt + T` (or click the floating button)

## Cleanup

After migration, you can remove:
- `frontend/src/services/cache.ts`
- `frontend/src/hooks/useCacheClear.ts`
- Manual cache invalidation code
- Most useEffect data fetching
- Manual loading/error state management
