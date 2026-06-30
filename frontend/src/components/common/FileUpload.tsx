import React, { useRef, useState } from 'react'
import { Upload, X, Image } from 'lucide-react'
import { cn } from '../../utils/cn'

interface FileUploadProps {
  onFile: (file: File) => void
  uploading?: boolean
  previewUrl?: string | null
  accept?: string
  label?: string
  className?: string
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFile, uploading, previewUrl, accept = 'image/*,application/pdf',
  label = 'Click to upload or drag & drop', className
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  const handleFile = (file: File) => onFile(file)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
        drag ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400',
        className
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      aria-label="File upload area"
      onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {previewUrl ? (
        <div className="relative inline-block">
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-40 max-w-full rounded-lg mx-auto object-contain"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-gray-500">
          {uploading
            ? <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            : <Upload size={32} className="text-gray-400" />
          }
          <span className="text-sm">{uploading ? 'Uploading…' : label}</span>
          <span className="text-xs text-gray-400">JPEG, PNG, WebP up to 10MB · PDF up to 25MB</span>
        </div>
      )}
    </div>
  )
}
