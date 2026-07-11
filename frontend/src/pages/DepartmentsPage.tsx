import { useState } from 'react'
import { PlusIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'
import { orgApi } from '../services/api'
import { useAsync, useAsyncAction } from '../hooks/useAsync'
import Modal from '../components/ui/Modal'
import ConfirmationModal from '../components/ui/ConfirmationModal'
import toast from 'react-hot-toast'
import type { DepartmentLayer } from '../types'
import clsx from 'clsx'

export default function DepartmentsPage() {
  const { data: depts, loading, refetch } = useAsync(() => orgApi.listDepartments(), [])
  const { execute, loading: actLoading } = useAsyncAction()

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', layer: 'layer3' as DepartmentLayer })
  const [toggleConfirm, setToggleConfirm] = useState<{ id: string; active: boolean; name: string } | null>(null)

  const handleCreate = async () => {
    if (!form.name) { toast.error('Name is required'); return }
    const ok = await execute(() => orgApi.createDepartment(form))
    if (ok !== null) {
      toast.success('Department created')
      setCreateOpen(false)
      setForm({ name: '', description: '', layer: 'layer3' })
      refetch()
    }
  }

  const handleToggle = async (id: string, active: boolean) => {
    const ok = await execute(() => orgApi.toggleDepartment(id, active))
    if (ok !== null) {
      toast.success(active ? 'Department enabled' : 'Department disabled')
      refetch()
    }
  }

  const layer2Depts = depts?.filter((d) => d.layer === 'layer2') || []
  const layer3Depts = depts?.filter((d) => d.layer === 'layer3') || []

  const DeptCard = ({ dept }: { dept: NonNullable<typeof depts>[number] }) => (
    <div className={clsx('card p-4', !dept.is_active && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            dept.layer === 'layer2' ? 'bg-purple-100' : 'bg-blue-100'
          )}>
            <BuildingOfficeIcon className={clsx('w-5 h-5', dept.layer === 'layer2' ? 'text-purple-600' : 'text-blue-600')} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{dept.name}</p>
            {dept.description && <p className="text-xs text-gray-500 mt-0.5">{dept.description}</p>}
            <p className="text-xs text-gray-400 mt-1">
              {dept.employee_count || 0} employee{(dept.employee_count || 0) !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={dept.is_active ? 'badge-green' : 'badge-gray'}>
            {dept.is_active ? 'Active' : 'Inactive'}
          </span>
          <button
            onClick={() => setToggleConfirm({ id: dept.id, active: !dept.is_active, name: dept.name })}
            className="btn-ghost btn-sm text-xs"
          >
            {dept.is_active ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h1 className="page-title">Departments</h1>
        <button onClick={() => setCreateOpen(true)} className="btn-primary">
          <PlusIcon className="w-4 h-4" /> New Department
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Layer 2 */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Production Management Departments</h2>
              <span className="badge-gray">{layer2Depts.length}</span>
            </div>
            {layer2Depts.length === 0 ? (
              <p className="text-sm text-gray-400">No Layer 2 departments yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {layer2Depts.map((d) => <DeptCard key={d.id} dept={d} />)}
              </div>
            )}
          </div>

          {/* Layer 3 */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Execution Departments</h2>
              <span className="badge-gray">{layer3Depts.length}</span>
            </div>
            {layer3Depts.length === 0 ? (
              <p className="text-sm text-gray-400">No Layer 3 departments yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {layer3Depts.map((d) => <DeptCard key={d.id} dept={d} />)}
              </div>
            )}
          </div>
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Department"
        footer={
          <>
            <button onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={actLoading} className="btn-primary">
              {actLoading ? 'Creating...' : 'Create'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Department Name <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input" placeholder="e.g. Carpentry" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2} className="input resize-none" />
          </div>
          <div>
            <label className="label">Layer <span className="text-red-500">*</span></label>
            <select value={form.layer} onChange={(e) => setForm((f) => ({ ...f, layer: e.target.value as DepartmentLayer }))}
              className="input">
              <option value="layer2">Layer 2 — Production Management</option>
              <option value="layer3">Layer 3 — Execution</option>
            </select>
          </div>
        </div>
      </Modal>

      {toggleConfirm && (
        <ConfirmationModal
          open={!!toggleConfirm}
          onClose={() => setToggleConfirm(null)}
          onConfirm={async () => {
            const { id, active } = toggleConfirm
            setToggleConfirm(null)
            await handleToggle(id, active)
          }}
          title={toggleConfirm.active ? 'Enable Department' : 'Disable Department'}
          message={
            toggleConfirm.active
              ? `Are you sure you want to enable the department "${toggleConfirm.name}"?`
              : `Are you sure you want to disable the department "${toggleConfirm.name}"? This might affect tasks and employees associated with it.`
          }
          confirmText={toggleConfirm.active ? 'Enable' : 'Disable'}
          type={toggleConfirm.active ? 'info' : 'warning'}
        />
      )}
    </div>
  )
}
