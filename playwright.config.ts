import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  outputDir: 'test-evidences/playwright-artifacts',
  testDir: './e2e/__tests__',
  use: {
    baseURL: 'http://localhost:3000',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'bun run dev',
    reuseExistingServer: !process.env.CI,
    url: 'http://localhost:3000',
  },
})
