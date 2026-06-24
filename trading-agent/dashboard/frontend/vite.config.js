import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/portfolio': 'http://localhost:8001',
      '/journal': 'http://localhost:8001',
      '/watchlist': 'http://localhost:8001',
    },
  },
})
