import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { 
  ExclamationTriangleIcon, 
  InformationCircleIcon, 
  CheckCircleIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline'

interface ConfirmationModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  type?: 'warning' | 'danger' | 'info' | 'success'
  loading?: boolean
  children?: React.ReactNode
}

export default function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  loading = false,
  children
}: ConfirmationModalProps) {
  
  // Icon configuration based on modal type
  const iconConfig = {
    warning: {
      icon: ExclamationTriangleIcon,
      bgColor: 'bg-amber-100',
      iconColor: 'text-amber-800',
      btnColor: 'bg-amber-800 hover:bg-amber-700 focus:ring-amber-500 text-white',
    },
    danger: {
      icon: ExclamationTriangleIcon,
      bgColor: 'bg-red-100',
      iconColor: 'text-red-800',
      btnColor: 'bg-red-800 hover:bg-red-700 focus:ring-red-500 text-white',
    },
    info: {
      icon: InformationCircleIcon,
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-800',
      btnColor: 'bg-brand-600 hover:bg-brand-700 focus:ring-brand-500 text-white',
    },
    success: {
      icon: CheckCircleIcon,
      bgColor: 'bg-green-100',
      iconColor: 'text-green-600',
      btnColor: 'bg-green-600 hover:bg-green-700 focus:ring-green-500 text-white',
    }
  }

  const config = iconConfig[type]
  const IconComponent = config.icon

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={loading ? () => {} : onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
              leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all border border-gray-200">
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${config.bgColor}`}>
                    <IconComponent className={`h-6 w-6 ${config.iconColor}`} aria-hidden="true" />
                  </div>
                  
                  <div className="flex-1 mt-0">
                    <div className="flex items-center justify-between">
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                        {title}
                      </Dialog.Title>
                      {!loading && (
                        <button
                          type="button"
                          className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
                          onClick={onClose}
                        >
                          <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    
                    <div className="mt-2">
                      <div className="text-sm text-gray-500 leading-relaxed">
                        {message}
                      </div>
                    </div>

                    {children && (
                      <div className="mt-4">
                        {children}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-row-reverse gap-3">
                  <button
                    type="button"
                    disabled={loading}
                    className={`inline-flex justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${config.btnColor}`}
                    onClick={onConfirm}
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Processing...
                      </div>
                    ) : confirmText}
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    className="inline-flex justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50"
                    onClick={onClose}
                  >
                    {cancelText}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
