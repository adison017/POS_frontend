import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const backendProxyTarget = process.env.VITE_BACKEND_URL ?? 'http://localhost:4000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: backendProxyTarget,
        changeOrigin: true,
      },
    },
  },
})