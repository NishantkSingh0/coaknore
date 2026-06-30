import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDepartments } from '../../api/departments'
import { setRouting } from '../../api/projects'
import { Button } from '../common/Button'
import { Spinner } from '../common/Spinner'
import toast from 'react-hot-toast'
import type { Department, RoutingEntry } from '../../types'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { GripVertical, Plus, Trash2, ArrowRight, RefreshCw } from 'lucide-react'

interface RoutingBuilderProps {
  projectId: string
  existingRouting?: RoutingEntry[]
  onSaved: () => void
}

interface RoutingLine { departmentId: string; sequence: number; checked: boolean }

export const RoutingBuilder: React.FC<RoutingBuilderProps> = ({
  projectId, existingRouting = [], onSaved
}) => {
  const qc = useQueryClient()
  const { data: depts, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments,
  })

  const layer3Depts = depts?.filter(d => d.layer === 3) ?? []

  // Initialise lines from existing routing or empty
  const [lines, setLines] = useState<RoutingLine[]>(() =>
    layer3Depts.map(d => {
      const ex = existingRouting.find(r => r.department_id === d.id)
      return { departmentId: d.id, sequence: ex?.sequence_order ?? 1, checked: !!ex }
    })
  )

  // Sync when dept list loads
  React.useEffect(() => {
    if (layer3Depts.length && lines.length === 0) {
      setLines(layer3Depts.map(d => {
        const ex = existingRouting.find(r => r.department_id === d.id)
        return { departmentId: d.id, sequence: ex?.sequence_order ?? 1, checked: !!ex }
      }))
    }
  }, [depts])

  const toggle = (id: string) =>
    setLines(ls => ls.map(l => l.departmentId === id ? { ...l, checked: !l.checked } : l))

  const setSeq = (id: string, seq: number) =>
    setLines(ls => ls.map(l => l.departmentId === id ? { ...l, sequence: Math.max(1, seq) } : l))

  const addDepartment = (deptId: string) => {
    const maxSeq = Math.max(0, ...lines.filter(l => l.checked).map(l => l.sequence))
    setLines(ls => ls.map(l => l.departmentId === deptId ? { ...l, checked: true, sequence: maxSeq + 1 } : l))
  }

  const removeDepartment = (deptId: string) => {
    setLines(ls => ls.map(l => l.departmentId === deptId ? { ...l, checked: false } : l))
  }

  const autoSequence = () => {
    const checkedLines = lines.filter(l => l.checked)
    const updatedLines = lines.map(line => {
      const index = checkedLines.findIndex(l => l.departmentId === line.departmentId)
      if (index !== -1) {
        return { ...line, sequence: index + 1 }
      }
      return line
    })
    setLines(updatedLines)
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const sourceIndex = result.source.index
    const destinationIndex = result.destination.index

    // Get checked lines only
    const checkedLines = lines.filter(l => l.checked)
    
    // Reorder
    const reordered = [...checkedLines]
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(destinationIndex, 0, moved)

    // Only update the order in the array, preserve manual sequence numbers
    // If user wants auto-sequential, they can use the "Auto-Sequence" button
    const updatedLines = lines.map(line => {
      const reorderedIndex = reordered.findIndex(l => l.departmentId === line.departmentId)
      if (reorderedIndex !== -1) {
        return { ...line }
      }
      return line
    })

    // Rebuild the lines array in the new order
    const finalLines = layer3Depts.map(d => {
      const reorderedLine = reordered.find(l => l.departmentId === d.id)
      const existingLine = lines.find(l => l.departmentId === d.id)
      if (reorderedLine) {
        return { ...reorderedLine }
      }
      return existingLine || { departmentId: d.id, sequence: 1, checked: false }
    })

    setLines(finalLines)
  }

  // Group by sequence for visual parallel grouping
  const grouped: Record<number, string[]> = {}
  lines.filter(l => l.checked).forEach(l => {
    if (!grouped[l.sequence]) grouped[l.sequence] = []
    grouped[l.sequence].push(l.departmentId)
  })
  const parallelSeqs = Object.entries(grouped)
    .filter(([, ids]) => ids.length > 1)
    .map(([seq]) => Number(seq))

  // Get sorted checked lines for drag and drop
  const sortedCheckedLines = lines
    .filter(l => l.checked)
    .sort((a, b) => a.sequence - b.sequence)

  const mutation = useMutation({
    mutationFn: () => {
      const routing = lines
        .filter(l => l.checked)
        .map(l => ({ department_id: l.departmentId, sequence_order: l.sequence }))
      if (routing.length === 0) throw new Error('Select at least one department')
      return setRouting(projectId, routing)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routing', projectId] })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('Routing saved — departments activated')
      onSaved()
    },
    onError: (err: any) => {
      toast.error(err.message ?? err.response?.data?.error?.message ?? 'Failed to save routing')
    },
  })

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <p className="text-sm text-gray-700 font-medium mb-2">How to set routing:</p>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Drag and drop</strong> to reorder departments</li>
          <li>• <strong>Edit sequence numbers</strong> directly to set order</li>
          <li>• <strong>Same sequence number</strong> = parallel execution (e.g., set two departments to "1" to run them in parallel)</li>
          <li>• <strong>Auto-Sequence</strong> button resets to sequential order</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Departments */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-indigo-600">Available Departments</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {layer3Depts.filter(d => !lines.find(l => l.departmentId === d.id && l.checked)).length}
            </span>
          </h4>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {layer3Depts.filter(d => !lines.find(l => l.departmentId === d.id && l.checked)).map(d => (
              <div
                key={d.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-200 group"
              >
                <span className="font-medium text-gray-700">{d.name}</span>
                <button
                  onClick={() => addDepartment(d.id)}
                  className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Add to routing"
                >
                  <Plus size={18} />
                </button>
              </div>
            ))}
            {layer3Depts.filter(d => !lines.find(l => l.departmentId === d.id && l.checked)).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">All departments added</p>
            )}
          </div>
        </div>

        {/* Active Routing */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-indigo-600">Active Routing</span>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                {sortedCheckedLines.length}
              </span>
            </div>
            {sortedCheckedLines.length > 1 && (
              <button
                onClick={autoSequence}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                title="Auto-sequence all departments"
              >
                <RefreshCw size={14} />
                Auto-Sequence
              </button>
            )}
          </h4>
          
          {sortedCheckedLines.length > 0 ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="routing">
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`space-y-2 min-h-[100px] transition-colors duration-200 rounded-lg p-2
                      ${snapshot.isDraggingOver ? 'bg-indigo-50/50' : ''}`}
                  >
                    {sortedCheckedLines.map((line, index) => {
                      const dept = layer3Depts.find(d => d.id === line.departmentId)
                      if (!dept) return null
                      const isParallel = parallelSeqs.includes(line.sequence)
                      
                      return (
                        <Draggable key={line.departmentId} draggableId={line.departmentId} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200
                                ${snapshot.isDragging 
                                  ? 'bg-indigo-100 border-indigo-400 shadow-lg scale-105' 
                                  : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                                }`}
                            >
                              <div {...provided.dragHandleProps} className="cursor-grab text-gray-400 hover:text-indigo-600">
                                <GripVertical size={20} />
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={99}
                                  value={line.sequence}
                                  onChange={(e) => setSeq(dept.id, Number(e.target.value))}
                                  className={`w-12 h-8 text-center border rounded-lg font-bold text-sm
                                    focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all
                                    ${isParallel 
                                      ? 'bg-amber-100 border-amber-300 text-amber-800' 
                                      : 'bg-indigo-100 border-indigo-300 text-indigo-800'
                                    }`}
                                  aria-label="Sequence order"
                                />
                              </div>
                              <div className="flex-1">
                                <span className="font-medium text-gray-800">{dept.name}</span>
                                {isParallel && (
                                  <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                    parallel
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => removeDepartment(dept.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove from routing"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          )}
                        </Draggable>
                      )
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No departments in routing</p>
              <p className="text-xs mt-1">Add departments from the available list</p>
            </div>
          )}
        </div>
      </div>

      {/* Visual Flow Preview */}
      {Object.keys(grouped).length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-indigo-600">Execution Flow Preview</span>
          </h4>
          <div className="flex flex-wrap items-center gap-3">
            {Object.entries(grouped)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([seq, ids], index) => {
                const names = ids.map(id => layer3Depts.find(d => d.id === id)?.name ?? id)
                const isParallel = names.length > 1
                
                return (
                  <React.Fragment key={seq}>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all duration-200
                      ${isParallel 
                        ? 'bg-amber-50 border-amber-300' 
                        : 'bg-indigo-50 border-indigo-300'
                      }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold
                        ${isParallel ? 'bg-amber-500' : 'bg-indigo-500'}`}>
                        {seq}
                      </div>
                      <span className="font-medium text-gray-700 text-sm">{names.join(' + ')}</span>
                      {isParallel && (
                        <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                          parallel
                        </span>
                      )}
                    </div>
                    {index < Object.keys(grouped).length - 1 && (
                      <ArrowRight className="text-gray-400" size={20} />
                    )}
                  </React.Fragment>
                )
              })}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
          Save Routing
        </Button>
      </div>
    </div>
  )
}
