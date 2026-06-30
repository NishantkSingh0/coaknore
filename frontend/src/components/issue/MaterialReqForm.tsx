import React, { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '../common/Input'
import { Button } from '../common/Button'
import { createMaterialRequisition } from '../../api/issues'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'

interface Item { material_name: string; material_description: string; quantity_required: string; unit: string }
const emptyItem = (): Item => ({ material_name: '', material_description: '', quantity_required: '', unit: '' })

interface MaterialReqFormProps { issueId: string; onSuccess: () => void; onCancel: () => void }

export const MaterialReqForm: React.FC<MaterialReqFormProps> = ({ issueId, onSuccess, onCancel }) => {
  const [department, setDepartment] = useState('')
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0])
  const [items, setItems] = useState<Item[]>([emptyItem()])

  const setItem = (i: number, field: keyof Item, value: string) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))

  const mutation = useMutation({
    mutationFn: () => createMaterialRequisition(issueId, {
      department, request_date: requestDate,
      items: items.map(it => ({
        material_name: it.material_name,
        material_description: it.material_description || undefined,
        quantity_required: Number(it.quantity_required),
        unit: it.unit || undefined,
      })),
    }),
    onSuccess,
    onError: (err: any) => toast.error(err.response?.data?.error?.message ?? 'Failed'),
  })

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-gray-700">Material Requisition</p>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Department"
          value={department}
          onChange={e => setDepartment(e.target.value)}
          placeholder="Requesting department"
        />
        <Input
          label="Request Date"
          type="date"
          value={requestDate}
          onChange={e => setRequestDate(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Items</p>
          <Button
            type="button" variant="ghost" size="sm"
            icon={<Plus size={14} />}
            onClick={() => setItems(prev => [...prev, emptyItem()])}
          >
            Add Item
          </Button>
        </div>

        {items.map((item, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-3 relative">
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500"
                aria-label="Remove item"
              >
                <Trash2 size={14} />
              </button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Material Name"
                value={item.material_name}
                onChange={e => setItem(i, 'material_name', e.target.value)}
                placeholder="e.g. Fabric — Velvet"
              />
              <div className="flex gap-2">
                <Input
                  label="Quantity"
                  type="number"
                  value={item.quantity_required}
                  onChange={e => setItem(i, 'quantity_required', e.target.value)}
                  min="0.01"
                  step="0.01"
                />
                <Input
                  label="Unit"
                  value={item.unit}
                  onChange={e => setItem(i, 'unit', e.target.value)}
                  placeholder="pcs / m / kg"
                />
              </div>
              <Input
                label="Description"
                value={item.material_description}
                onChange={e => setItem(i, 'material_description', e.target.value)}
                className="col-span-2"
                placeholder="Optional notes"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
          Submit Requisition
        </Button>
      </div>
    </div>
  )
}
