import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL('.', import.meta.url))
  const env = loadEnv(mode, root, '')

  const apiUrl = env.VITE_API_URL || 'http://localhost:8080/api'
  const proxyTarget = apiUrl.startsWith('http')
    ? (apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl)
    : 'http://localhost:8080'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})