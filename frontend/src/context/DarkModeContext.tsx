import React, { createContext, useContext, useEffect, useState } from 'react'

interface DarkModeContextValue {
  isDark: boolean
  setDark: (v: boolean) => void
  toggle: () => void
}

const DarkModeContext = createContext<DarkModeContextValue | null>(null)

const STORAGE_KEY = 'pms_dark_mode'

export const DarkModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      if (s === null) return false
      return s === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(isDark))
    } catch {}
  }, [isDark])

  // The provider will add a wrapper div with `dark` class when enabled so Tailwind `dark:`
  // styles apply inside the application layout only (public pages are unaffected).
  const setDark = (v: boolean) => setIsDark(v)
  const toggle = () => setIsDark((s) => !s)

  return (
    <DarkModeContext.Provider value={{ isDark, setDark, toggle }}>
      <div className={isDark ? 'dark' : ''}>{children}</div>
    </DarkModeContext.Provider>
  )
}

export const useDarkMode = () => {
  const ctx = useContext(DarkModeContext)
  if (!ctx) throw new Error('useDarkMode must be used within DarkModeProvider')
  return ctx
}

export default DarkModeContext
