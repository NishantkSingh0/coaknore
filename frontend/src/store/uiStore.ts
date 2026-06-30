import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  activeModal: string | null
  openModal: (name: string) => void
  closeModal: () => void
}

export const useUIStore = create<UIState>(set => ({
  sidebarOpen: true,
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: open => set({ sidebarOpen: open }),

  activeModal: null,
  openModal:  name => set({ activeModal: name }),
  closeModal: ()   => set({ activeModal: null }),
}))
