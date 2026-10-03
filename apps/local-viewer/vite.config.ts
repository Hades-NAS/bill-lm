import viteReact from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const appRoot = fileURLToPath(new URL('.', import.meta.url))
const contractsRoot = fileURLToPath(new URL('../../packages/contracts', import.meta.url))
const uiRoot = fileURLToPath(new URL('../../packages/ui', import.meta.url))

const daemonTarget = process.env.BILL_LM_LOCAL_DAEMON_TARGET || 'http://127.0.0.1:4318'

export default defineConfig({
  root: appRoot,
  plugins: [viteReact()],
  server: {
    fs: {
      allow: [appRoot, contractsRoot, uiRoot],
    },
    proxy: {
      '/api': daemonTarget,
    },
  },
})
