import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: string
  confirmLabel?: string
  loading?: boolean
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open, onClose, onConfirm, title = 'Confirm Action',
  message, confirmLabel = 'Confirm', loading,
}) => (
  <Modal open={open} onClose={onClose} title={title} size="sm">
    <div className="flex gap-3 items-start mb-6">
      <AlertTriangle size={24} className="text-amber-500 shrink-0 mt-0.5" />
      <p className="text-sm text-gray-700">{message}</p>
    </div>
    <div className="flex justify-end gap-3">
      <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
      <Button variant="danger" size="sm" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
    </div>
  </Modal>
)
