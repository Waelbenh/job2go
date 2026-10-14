import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@/components/..." means "src/components/..."
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    // While developing, calls to /api (data and buttons) and /applications (pack files) go to
    // the Python server, serve.py. JOB2GO_API can point to another one (used for testing).
    proxy: {
      '/api': process.env.JOB2GO_API ?? 'http://127.0.0.1:8765',
      '/applications': process.env.JOB2GO_API ?? 'http://127.0.0.1:8765',
    },
  },
})
