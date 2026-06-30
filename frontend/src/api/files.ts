import api from './client'

export const uploadFile = (file: File, folder: string): Promise<{ key: string; url: string; public_url?: string }> => {
  const form = new FormData()
  form.append('file', file)
  form.append('folder', folder)
  return api.post('/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data.data)
}

export const getPresignedUrl = (key: string): Promise<{ url: string; expires_at: string }> =>
  api.get('/files/presigned', { params: { key } }).then(r => r.data.data)
