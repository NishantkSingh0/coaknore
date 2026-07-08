import { useState } from 'react'
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { orgApi } from '../services/api'
import { useAsync, useAsyncAction } from '../hooks/useAsync'
import { layerLabel, fmtDate } from '../utils/helpers'
import Modal from '../components/ui/Modal'
import toast from 'react-hot-toast'
import type { LayerType, DepartmentLayer } from '../types'
import clsx from 'clsx'

export default function EmployeesPage() {
  const [search, setSearch] = useState('')
  const [layer, setLayer] = useState<LayerType | ''>('')
  const [page, setPage] = useState(1)

  const { data: empsData, loading, refetch } = useAsync(
    () => orgApi.listEmployees({ page, page_size: 20, search, layer: layer || undefined }),
    [page, search, layer]
  )
  const { data: depts } = useAsync(() => orgApi.listDepartments(), [])
  const { execute, loading: actLoading } = useAsyncAction()

  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [resetId, setResetId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [form, setForm] = useState({
    email: '', password: '', first_name: '', last_name: '',
    phone: '', layer: 'layer3' as LayerType, department_id: ''
  })

  const resetForm = () => setForm({
    email: '', password: '', first_name: '', last_name: '',
    phone: '', layer: 'layer3', department_id: ''
  })

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.first_name || !form.last_name) {
      toast.error('Email, password, first name and last name required'); return
    }
    const ok = await execute(() => orgApi.createEmployee(form))
    if (ok !== null) {
      toast.success('Employee created')
      setCreateOpen(false); resetForm(); refetch()
    }
  }

  const handleToggle = async (id: string, active: boolean) => {
    const ok = await execute(() => orgApi.toggleEmployee(id, active))
    if (ok !== null) {
      toast.success(active ? 'Employee enabled' : 'Employee disabled')
      refetch()
    }
  }

  const handleResetPassword = async () => {
    if (!resetId || !newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters'); return
    }
    const ok = await execute(() => orgApi.resetEmployeePassword(resetId, newPassword))
    if (ok !== null) {
      toast.success('Password reset')
      setResetId(null); setNewPassword('')
    }
  }

  const LAYER_OPTS: { label: string; value: LayerType | '' }[] = [
    { label: 'All', value: '' },
    { label: 'Admin', value: 'layer1' },
    { label: 'Production Mgmt', value: 'layer2' },
    { label: 'Execution', value: 'layer3' },
  ]

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Employees</h1>
        <button onClick={() => { resetForm(); setCreateOpen(true) }} className="btn-primary">
          <PlusIcon className="w-4 h-4" /> New Employee
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name or email..."
            className="input pl-9"
          />
        </div>
        <div className="flex gap-2">
          {LAYER_OPTS.map((opt) => (
            <button key={opt.value}
              onClick={() => { setLayer(opt.value); setPage(1) }}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                layer === opt.value ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Email</th>
                <th>Layer</th>
                <th>Department</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {empsData?.data?.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No employees found</td></tr>
              )}
              {empsData?.data?.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-brand-700 text-xs font-bold">
                          {emp.first_name[0]}{emp.last_name[0]}
                        </span>
                      </div>
                      <span className="font-medium">{emp.first_name} {emp.last_name}</span>
                    </div>
                  </td>
                  <td className="text-gray-500">{emp.email}</td>
                  <td>
                    <span className="badge-blue">{layerLabel[emp.layer]}</span>
                  </td>
                  <td>{emp.department_name || '—'}</td>
                  <td>
                    <span className={emp.is_active ? 'badge-green' : 'badge-gray'}>
                      {emp.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="text-gray-500">{fmtDate(emp.last_login_at)}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggle(emp.id, !emp.is_active)}
                        className="btn-ghost btn-sm text-xs"
                      >
                        {emp.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => setResetId(emp.id)}
                        className="btn-ghost btn-sm text-xs"
                      >
                        Reset Pwd
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {empsData && empsData.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{empsData.total} employees</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary btn-sm">Previous</button>
            <span className="text-sm">{page} / {empsData.total_pages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= empsData.total_pages} className="btn-secondary btn-sm">Next</button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Employee" size="lg"
        footer={
          <>
            <button onClick={() => setCreateOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={actLoading} className="btn-primary">
              {actLoading ? 'Creating...' : 'Create Employee'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name <span className="text-red-500">*</span></label>
              <input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Last Name <span className="text-red-500">*</span></label>
              <input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Email <span className="text-red-500">*</span></label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="label">Password <span className="text-red-500">*</span></label>
            <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="input" placeholder="Min 8 characters" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="label">Layer / Role <span className="text-red-500">*</span></label>
            <select value={form.layer} onChange={(e) => setForm((f) => ({ ...f, layer: e.target.value as LayerType }))} className="input">
              <option value="layer1">Admin (Layer 1)</option>
              <option value="layer2">Production Mgmt (Layer 2)</option>
              <option value="layer3">Execution (Layer 3)</option>
            </select>
          </div>
          <div>
            <label className="label">Department</label>
            <select value={form.department_id} onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))} className="input">
              <option value="">— No Department —</option>
              {depts?.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.layer})</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetId} onClose={() => { setResetId(null); setNewPassword('') }} title="Reset Password"
        footer={
          <>
            <button onClick={() => { setResetId(null); setNewPassword('') }} className="btn-secondary">Cancel</button>
            <button onClick={handleResetPassword} disabled={actLoading} className="btn-primary">
              {actLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </>
        }
      >
        <div>
          <label className="label">New Password <span className="text-red-500">*</span></label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            className="input" placeholder="Min 8 characters" />
        </div>
      </Modal>
    </div>
  )
}