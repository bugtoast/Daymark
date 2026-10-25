import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

const appVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  server: {
    port: Number(process.env.PORT ?? 3100),
    host: '127.0.0.1',
    strictPort: true,
    proxy: {
      '/api': `http://127.0.0.1:${process.env.API_PORT ?? 3101}`,
    },
  },
  preview: {
    port: Number(process.env.PORT ?? 3100),
    host: '127.0.0.1',
    proxy: {
      '/api': `http://127.0.0.1:${process.env.API_PORT ?? 3101}`,
    },
  },
})
