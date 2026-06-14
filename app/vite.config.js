import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// App is served under /spotter/ (ansonsajugeorge.online/spotter/)
export default defineConfig({
  base: '/spotter/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    // dev: forward same-origin /spotter/api calls to local Django (strip /spotter)
    proxy: {
      '/spotter/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/spotter/, ''),
      },
      '/spotter/admin': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/spotter/, ''),
      },
    },
  },
})
