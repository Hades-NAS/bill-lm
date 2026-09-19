import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { defineConfig, devices } from '@playwright/test'

const daemonUrl = 'http://127.0.0.1:4318/api/v1/rulesets'
const viewerPort = Number(process.env.PLAYWRIGHT_LOCAL_VIEWER_PORT ?? 4319)
const viewerUrl = `http://127.0.0.1:${viewerPort}`
const libraryDir = mkdtempSync(join(tmpdir(), 'bill-lm-local-viewer-e2e-'))

export default defineConfig({
  outputDir: 'test-evidences/local-viewer-artifacts',
  testDir: './e2e/local-viewer',
  use: {
    baseURL: viewerUrl,
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'bun run --cwd apps/local-daemon start',
      env: { BILL_LM_LOCAL_LIBRARY_DIR: libraryDir },
      name: 'LocalDaemon',
      reuseExistingServer: false,
      url: daemonUrl,
    },
    {
      command: `bun run --cwd apps/local-viewer dev -- --host 127.0.0.1 --port ${viewerPort}`,
      name: 'LocalViewer',
      reuseExistingServer: false,
      url: viewerUrl,
    },
  ],
})
