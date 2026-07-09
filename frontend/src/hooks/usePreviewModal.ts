import { create } from 'zustand'

export type PreviewFileType = 'image' | 'video' | 'pdf' | 'other'

interface PreviewState {
  isOpen: boolean
  url: string | null
  fileName: string | null
  fileType: PreviewFileType | null
  openPreview: (url: string, fileName?: string) => void
  closePreview: () => void
}

export const usePreviewModal = create<PreviewState>((set) => ({
  isOpen: false,
  url: null,
  fileName: null,
  fileType: null,
  openPreview: (url, fileName = '') => {
    let detectedType: PreviewFileType = 'other'
    
    // Clean query parameters from URL to check extension
    const cleanUrl = url.split('?')[0].toLowerCase()
    
    if (cleanUrl.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp)$/) || url.startsWith('data:image/')) {
      detectedType = 'image'
    } else if (cleanUrl.match(/\.(mp4|webm|ogg)$/) || url.startsWith('data:video/')) {
      detectedType = 'video'
    } else if (cleanUrl.match(/\.pdf$/) || url.startsWith('data:application/pdf')) {
      detectedType = 'pdf'
    }
    
    const finalFileName = fileName || url.split('/').pop()?.split('?')[0] || 'File'
    
    set({
      isOpen: true,
      url,
      fileName: finalFileName,
      fileType: detectedType,
    })
  },
  closePreview: () => set({ isOpen: false, url: null, fileName: null, fileType: null }),
}))
