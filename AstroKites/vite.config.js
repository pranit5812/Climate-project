import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/power-data': 'http://127.0.0.1:8000',
      '/forecast': 'http://127.0.0.1:8000',
      '/forecast-simple': 'http://127.0.0.1:8000',
      '/check-date': 'http://127.0.0.1:8000',
      '/state-7day-forecast': 'http://127.0.0.1:8000',
      '/send-sms': 'http://127.0.0.1:8000',
      '/api': 'http://127.0.0.1:8000',
    }
  }
})
