import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const certificateDirectory = fileURLToPath(new URL('../.certs/', import.meta.url))
const certificatePath = `${certificateDirectory}dev-cert.pem`
const privateKeyPath = `${certificateDirectory}dev-key.pem`
const https = !process.env.VITE_HTTP_ONLY && existsSync(certificatePath) && existsSync(privateKeyPath)
  ? { cert: readFileSync(certificatePath), key: readFileSync(privateKeyPath) }
  : undefined

export default defineConfig({
  ...(process.env.VITE_CACHE_DIR ? { cacheDir: process.env.VITE_CACHE_DIR } : {}),
  plugins: [react()],
  server: {
    host: true,
    https,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  preview: {
    host: true,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
