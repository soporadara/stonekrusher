import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const phpBackend = env.VITE_API_BACKEND || process.env.VITE_API_BACKEND || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5199,
      strictPort: false,
      proxy: {
        '/api': {
          target: phpBackend,
          changeOrigin: true,
          secure: false
        },
        '/uploads': {
          target: phpBackend,
          changeOrigin: true,
          secure: false
        },
        '/medialibrary': {
          target: phpBackend,
          changeOrigin: true,
          secure: false
        }
      }
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: false
    }
  }
})
