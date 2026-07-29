import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { useCacheClear } from './hooks/useCacheClear'
import './index.css'
import 'highlight.js/styles/github-dark.css'

// Component to clear cache on app mount
function CacheClearer() {
  useCacheClear()
  return null
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CacheClearer />
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#363636', color: '#fff' },
            success: { style: { background: '#166534', color: '#fff' } },
            error: { style: { background: '#991b1b', color: '#fff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
