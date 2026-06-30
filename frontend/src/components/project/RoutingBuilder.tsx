import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDepartments } from '../../api/departments'
import { setRouting } from '../../api/projects'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { Spinner } from '../common/Spinner'
import toast from 'react-hot-toast'
import type { Department, RoutingEntry } from '../../types'

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

  // Group by sequence for visual parallel grouping
  const grouped: Record<number, string[]> = {}
  lines.filter(l => l.checked).forEach(l => {
    if (!grouped[l.sequence]) grouped[l.sequence] = []
    grouped[l.sequence].push(l.departmentId)
  })
  const parallelSeqs = Object.entries(grouped)
    .filter(([, ids]) => ids.length > 1)
    .map(([seq]) => Number(seq))

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
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Check departments and assign a sequence number. Same number = parallel execution.
      </p>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-8"></th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Department</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-32">Sequence</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">Flow</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {layer3Depts.map(d => {
              const line = lines.find(l => l.departmentId === d.id)
              if (!line) return null
              const isParallel = line.checked && parallelSeqs.includes(line.sequence)
              return (
                <tr
                  key={d.id}
                  className={line.checked ? 'bg-indigo-50/40' : 'bg-white'}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={line.checked}
                      onChange={() => toggle(d.id)}
                      className="h-4 w-4 text-indigo-600 rounded border-gray-300"
                      aria-label={`Include ${d.name}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{d.name}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={line.sequence}
                      onChange={e => setSeq(d.id, Number(e.target.value))}
                      disabled={!line.checked}
                      className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm
                        focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-40"
                      aria-label="Sequence order"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {line.checked && isParallel && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        parallel
                      </span>
                    )}
                    {line.checked && !isParallel && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        sequential
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Visual summary */}
      {Object.keys(grouped).length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
          <p className="font-medium mb-2 text-gray-700">Execution order preview:</p>
          <ol className="space-y-1">
            {Object.entries(grouped)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([seq, ids]) => {
                const names = ids.map(id => layer3Depts.find(d => d.id === id)?.name ?? id)
                return (
                  <li key={seq} className="flex items-center gap-2">
                    <span className="bg-indigo-600 text-white rounded-full h-5 w-5 flex items-center
                      justify-center font-bold shrink-0">{seq}</span>
                    <span>{names.join(' + ')}</span>
                    {names.length > 1 && <span className="text-amber-600">(parallel)</span>}
                  </li>
                )
              })}
          </ol>
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
