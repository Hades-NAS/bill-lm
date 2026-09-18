import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const configPath = fileURLToPath(
  new URL('../../playwright.config.ts', import.meta.url),
)

describe('Playwright configuration', () => {
  it('permite aislar el servidor E2E con PLAYWRIGHT_PORT', () => {
    const config = readFileSync(configPath, 'utf8')

    expect(config).toContain('process.env.PLAYWRIGHT_PORT ?? 3000')
    expect(config).toContain('PORT=${port} bun run --cwd apps/web start')
  })
})
