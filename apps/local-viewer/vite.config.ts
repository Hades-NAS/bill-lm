import viteReact from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const appRoot = fileURLToPath(new URL('.', import.meta.url))
const contractsRoot = fileURLToPath(new URL('../../packages/contracts', import.meta.url))
const uiRoot = fileURLToPath(new URL('../../packages/ui', import.meta.url))

export default defineConfig({
  root: appRoot,
  plugins: [viteReact()],
  server: {
    fs: {
      allow: [appRoot, contractsRoot, uiRoot],
    },
    proxy: {
      '/api': 'http://127.0.0.1:4318',
    },
  },
})
