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
      '/prices': 'http://localhost:8001',
      '/market': 'http://localhost:8001',
      '/orders': 'http://localhost:8001',
      '/news': 'http://localhost:8001',
      '/history': 'http://localhost:8001',
    },
  },
})
