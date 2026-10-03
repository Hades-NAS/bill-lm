import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { defineConfig, devices } from '@playwright/test'

const daemonPort = Number(process.env.PLAYWRIGHT_LOCAL_DAEMON_PORT ?? 4418)
const daemonUrl = `http://127.0.0.1:${daemonPort}/api/v1/rulesets`
const viewerPort = Number(process.env.PLAYWRIGHT_LOCAL_VIEWER_PORT ?? 4419)
const viewerUrl = `http://127.0.0.1:${viewerPort}`
const libraryDir = mkdtempSync(join(tmpdir(), 'bill-lm-local-viewer-e2e-'))

export default defineConfig({
  outputDir: 'test-evidences/local-viewer-artifacts',
  testDir: './e2e/local-viewer',
  workers: 1,
  use: {
    baseURL: viewerUrl,
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'bun e2e/local-viewer/fixtures/server.ts',
      env: { BILL_LM_LOCAL_LIBRARY_DIR: libraryDir, PLAYWRIGHT_LOCAL_DAEMON_PORT: String(daemonPort) },
      name: 'LocalDaemon',
      reuseExistingServer: false,
      url: daemonUrl,
    },
    {
      command: `BILL_LM_LOCAL_DAEMON_TARGET=http://127.0.0.1:${daemonPort} bun run --cwd apps/local-viewer dev -- --host 127.0.0.1 --port ${viewerPort}`,
      name: 'LocalViewer',
      reuseExistingServer: false,
      url: viewerUrl,
    },
  ],
})
