import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { 
  XMarkIcon, 
  ArrowDownTrayIcon, 
  ArrowTopRightOnSquareIcon, 
  DocumentIcon 
} from '@heroicons/react/24/outline'
import { usePreviewModal } from '../../hooks/usePreviewModal'

export default function PreviewModal() {
  const { isOpen, url, fileName, fileType, closePreview } = usePreviewModal()
  const [downloading, setDownloading] = useState(false)

  if (!isOpen || !url) return null

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Network response was not ok')
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = fileName || 'downloaded-file'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.warn('Direct blob download failed (possibly due to CORS). Falling back to opening in a new tab.', error)
      // Fallback: Open file URL in new tab which will download it or let the user save it
      window.open(url, '_blank')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closePreview}>
        {/* Backdrop overlay */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                  <Dialog.Title as="h3" className="text-sm font-semibold text-gray-900 truncate pr-4" title={fileName || ''}>
                    {fileName || 'File Preview'}
                  </Dialog.Title>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownload}
                      disabled={downloading}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Download file"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4 text-gray-500" />
                      <span>{downloading ? 'Downloading...' : 'Download'}</span>
                    </button>

                    <button
                      onClick={closePreview}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      title="Close preview"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Body / Content */}
                <div className="flex-1 overflow-auto bg-gray-100/50 p-6 flex items-center justify-center min-h-[50vh]">
                  {fileType === 'image' && (
                    <div className="relative max-w-full max-h-[75vh] flex items-center justify-center">
                      <img
                        src={url}
                        alt={fileName || 'Preview'}
                        className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-lg bg-white"
                      />
                    </div>
                  )}

                  {fileType === 'video' && (
                    <div className="relative w-full max-w-3xl max-h-[75vh] flex items-center justify-center">
                      <video
                        src={url}
                        controls
                        autoPlay
                        className="w-full max-h-[75vh] object-contain rounded-lg shadow-lg bg-black"
                      />
                    </div>
                  )}

                  {fileType === 'pdf' && (
                    <div className="w-full h-[75vh] rounded-lg overflow-hidden border border-gray-200 shadow-md bg-white">
                      <iframe
                        src={`${url}#toolbar=0`}
                        className="w-full h-full border-0"
                        title={fileName || 'PDF Preview'}
                      />
                    </div>
                  )}

                  {fileType === 'other' && (
                    <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-md space-y-5">
                      <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center">
                        <DocumentIcon className="w-8 h-8 text-brand-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-base text-center break-all max-w-[280px] mx-auto" title={fileName || ""}>
                          {fileName}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          This file type cannot be previewed directly. Please download it and open it with a supported application.                        
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
