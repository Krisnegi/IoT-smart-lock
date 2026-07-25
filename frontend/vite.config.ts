import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Proxy WebSocket connections (handshakes & upgrades)
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
})
