/**
 * Example component showing React Query benefits
 * Compare this with your current implementation
 */
import { useDepartments, useCreateDepartment, useProjects, useCreateProject } from '../hooks/useQueries'
import { useState } from 'react'

export function ReactQueryExample() {
  // All data fetching with built-in caching
  const { 
    data: departments, 
    isLoading: deptsLoading, 
    error: deptsError 
  } = useDepartments()
  
  const { 
    data: projects, 
    isLoading: projectsLoading 
  } = useProjects()
  
  // Mutations with automatic cache invalidation
  const createDepartment = useCreateDepartment()
  const createProject = useCreateProject()

  const [newDeptName, setNewDeptName] = useState('')

  const handleCreateDept = async () => {
    try {
      await createDepartment.mutateAsync({
        name: newDeptName,
        layer: 'layer2',
        description: 'Created via React Query'
      })
      setNewDeptName('')
      // Cache automatically invalidated, UI updates automatically!
    } catch (error) {
      console.error('Failed to create department:', error)
    }
  }

  if (deptsLoading || projectsLoading) {
    return <div className="p-4">Loading...</div>
  }

  if (deptsError) {
    return <div className="p-4 text-red-500">Error: {deptsError.message}</div>
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">React Query Example</h2>
      
      {/* Departments Section */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Departments ({departments?.length || 0})</h3>
        
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            placeholder="New department name"
            className="border rounded px-3 py-2 flex-1"
          />
          <button
            onClick={handleCreateDept}
            disabled={createDepartment.isPending}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-blue-300"
          >
            {createDepartment.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>

        <div className="space-y-2">
          {departments?.map((dept) => (
            <div key={dept.id} className="p-3 bg-gray-50 rounded">
              <span className="font-medium">{dept.name}</span>
              <span className="ml-2 text-sm text-gray-500">({dept.layer})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Projects Section */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Projects ({projects?.items?.length || 0})</h3>
        
        <div className="space-y-2">
          {projects?.items?.map((project) => (
            <div key={project.id} className="p-3 bg-gray-50 rounded">
              <span className="font-medium">{project.project_name}</span>
              <span className="ml-2 text-sm text-gray-500">{project.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Benefits Display */}
      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <h3 className="text-lg font-semibold text-green-800 mb-2">✅ React Query Benefits</h3>
        <ul className="text-green-700 space-y-1 text-sm">
          <li>• Automatic caching - no manual cache management</li>
          <li>• Smart invalidation - cache updates automatically on mutations</li>
          <li>• Built-in loading/error states - less boilerplate code</li>
          <li>• Background refetching - data stays fresh automatically</li>
          <li>• DevTools - monitor cache performance in real-time</li>
          <li>• Optimistic updates - instant UI feedback</li>
        </ul>
      </div>
    </div>
  )
}
