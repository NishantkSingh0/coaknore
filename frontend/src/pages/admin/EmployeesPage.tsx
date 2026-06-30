import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, createUser, deleteUser, resetUserPassword } from '../../api/users'
import { getDepartments } from '../../api/departments'
import { Button } from '../../components/common/Button'
import { Modal } from '../../components/common/Modal'
import { ConfirmDialog } from '../../components/common/ConfirmDialog'
import { Input, Select } from '../../components/common/Input'
import { Badge } from '../../components/common/Badge'
import { Spinner } from '../../components/common/Spinner'
import { EmptyState } from '../../components/common/EmptyState'
import { KeyRound, Plus, Trash2, UserCheck, UserX } from 'lucide-react'
import { formatDate, getInitials } from '../../utils'
import toast from 'react-hot-toast'

const ROLE_OPTIONS = [
  { value: 'admin',  label: 'Admin' },
  { value: 'layer2', label: 'Layer 2 (Production/Operation/Floor)' },
  { value: 'layer3', label: 'Layer 3 (Department)' },
]

export const EmployeesPage: React.FC = () => {
  const [emailEdited, setEmailEdited] = useState(false)
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [passwordTarget, setPasswordTarget] = useState<{ id: string; name: string } | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'],       queryFn: getUsers })
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: getDepartments })

  const [form, setForm] = useState({ name: '', email: '', password: '', role: '', department_id: '', phone: '' })
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [f]: e.target.value }))

  const createMutation = useMutation({
    mutationFn: () => createUser({
      name: form.name, email: form.email, password: form.password, role: form.role,
      phone: form.phone || undefined,
      department_id: form.department_id || undefined,
    }),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['users'] })
    toast.success('Member created')
    setShowCreate(false)
    setEmailEdited(false)
    setForm({ name: '', email: '', password: '', role: '', department_id: '', phone: ''})},
    onError: (err: any) => toast.error(err.response?.data?.error?.message ?? 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Member removed') },
    onError: () => toast.error('Failed to delete'),
    onSettled: () => setDeleteTarget(null),
  })

  const passwordMutation = useMutation({
    mutationFn: () => resetUserPassword(passwordTarget!.id, newPassword),
    onSuccess: () => {
      toast.success('Password changed')
      setPasswordTarget(null)
      setNewPassword('')
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message ?? 'Failed to change password'),
  })

  const deptOptions = departments.map(d => ({ value: d.id, label: `${d.name} (L${d.layer})` }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Members</h2>
        <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>Add Member</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : users.length === 0 ? (
        <EmptyState title="No Members yet" description="Add your first Member." />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avatar</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.filter(u => u.email !== "n@oaknore.in").map(u => {
                const dept = departments.find(d => d.id === u.department_id)
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.name} className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                          {getInitials(u.name)}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-5 py-3 text-gray-600">{u.email}</td>
                    <td className="px-5 py-3 capitalize text-gray-700">{u.role}</td>
                    <td className="px-5 py-3 text-gray-600">{dept?.name ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
                        ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.is_active ? <UserCheck size={11} /> : <UserX size={11} />}
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{formatDate(u.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPasswordTarget({ id: u.id, name: u.name })}
                          className="p-1 text-gray-400 hover:text-indigo-700 transition-colors"
                          aria-label="Reset password"
                        >
                          <KeyRound size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(u.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          aria-label="Delete Member"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Member" size="md">
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={form.name}
            onChange={(e) => {
              const name = e.target.value

              setForm(prev => ({
                ...prev,
                name,
                email: emailEdited
                  ? prev.email
                  : `${name.trim().split(/\s+/)[0].toLowerCase()}@oaknore.in`,
              }))
            }}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            placeholder="name@oaknore.in"
            onChange={(e) => {
              setEmailEdited(true)
              setForm(prev => ({
                ...prev,
                email: e.target.value,
              }))
            }}
          />
          <Input label="Password" type="password" value={form.password} onChange={set('password')} helper="Minimum 8 characters" />
          <Input label="Phone (optional)" value={form.phone} onChange={set('phone')} />
          <Select label="Role" options={ROLE_OPTIONS} value={form.role} onChange={set('role')} />
          <Select label="Department (optional)" options={deptOptions} value={form.department_id} onChange={set('department_id')} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>
              Create Member
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!passwordTarget}
        onClose={() => { setPasswordTarget(null); setNewPassword('') }}
        title="Reset Password"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Set a new password for <span className="font-medium text-gray-900">{passwordTarget?.name}</span>.
          </p>
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            helper="Minimum 8 characters"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setPasswordTarget(null); setNewPassword('') }}>Cancel</Button>
            <Button
              onClick={() => passwordMutation.mutate()}
              loading={passwordMutation.isPending}
              disabled={newPassword.length < 8}
            >
              Change Password
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        loading={deleteMutation.isPending}
        message="Are you sure you want to remove him?"
        confirmLabel="Remove"
      />
    </div>
  )
}
