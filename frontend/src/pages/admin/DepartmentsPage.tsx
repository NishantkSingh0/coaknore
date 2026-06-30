import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDepartments, createDepartment, deleteDepartment } from '../../api/departments'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { Input, Select } from '../../components/common/Input'
import { Spinner } from '../../components/common/Spinner'
import { Plus, Trash2, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'

export const DepartmentsPage: React.FC = () => {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', layer: '3', description: '' })

  const { data: departments = [], isLoading } = useQuery({ queryKey: ['departments'], queryFn: getDepartments })

  const createMutation = useMutation({
    mutationFn: () => createDepartment({ name: form.name, layer: Number(form.layer), description: form.description || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] })
      toast.success('Department created')
      setShowCreate(false)
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message ?? 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); toast.success('Department removed') },
    onSettled: () => setDeleteTarget(null),
  })

  const layer2 = departments.filter(d => d.layer === 2)
  const layer3 = departments.filter(d => d.layer === 3)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Departments</h2>
        <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>Add Department</Button>
      </div>

      {isLoading ? <div className="flex justify-center py-20"><Spinner size="lg" /></div> : (
        <div className="grid grid-cols-1 gap-6">
          {/* Layer 2 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
              <h3 className="font-semibold text-blue-800">Layer 2 — Management</h3>
            </div>
            <ul className="divide-y divide-gray-100">
              {layer2.map(d => (
                <li key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Building2 size={16} className="text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{d.name}</p>
                      {d.description && <p className="text-xs text-gray-500">{d.description}</p>}
                    </div>
                  </div>
                  <button onClick={() => setDeleteTarget(d.id)} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Layer 3 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100">
              <h3 className="font-semibold text-indigo-800">Layer 3 — Production Depts</h3>
            </div>
            <ul className="divide-y divide-gray-100">
              {layer3.map(d => (
                <li key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Building2 size={16} className="text-indigo-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{d.name}</p>
                      {d.description && <p className="text-xs text-gray-500">{d.description}</p>}
                    </div>
                  </div>
                  <button onClick={() => setDeleteTarget(d.id)} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Department" size="sm">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Select
            label="Layer"
            options={[{ value: '2', label: 'Layer 2 (Management)' }, { value: '3', label: 'Layer 3 (Production)' }]}
            value={form.layer}
            onChange={e => setForm(f => ({ ...f, layer: e.target.value }))}
          />
          <Input label="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>Create</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        loading={deleteMutation.isPending}
        message="Delete this department? Users assigned to it will become unlinked."
        confirmLabel="Delete"
      />
    </div>
  )
}
