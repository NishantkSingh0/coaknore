import { useState } from 'react'
import { uploadFile } from '../api/files'
import toast from 'react-hot-toast'

export function useFileUpload(folder: string) {
  const [uploading, setUploading] = useState(false)
  const [url, setUrl]   = useState<string | null>(null)
  const [key, setKey]   = useState<string | null>(null)

  const upload = async (file: File): Promise<{ url: string; key: string } | null> => {
    setUploading(true)
    try {
      const result = await uploadFile(file, folder)
      setUrl(result.url)
      setKey(result.key)
      return result
    } catch {
      toast.error('File upload failed')
      return null
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading, url, key, reset: () => { setUrl(null); setKey(null) } }
}
