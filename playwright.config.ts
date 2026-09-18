import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000)
const baseURL = `http://localhost:${port}`

export default defineConfig({
  outputDir: 'test-evidences/playwright-artifacts',
  testDir: './e2e/__tests__',
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
  },
  webServer: {
    // The health check builds the app first, so browser tests exercise the
    // same TanStack Start server entry that deployment uses.
    command: `PORT=${port} bun run --cwd apps/web start`,
    reuseExistingServer: !process.env.CI,
    url: baseURL,
  },
})
