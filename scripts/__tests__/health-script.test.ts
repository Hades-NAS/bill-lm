import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const healthScriptPath = fileURLToPath(new URL('../../health.sh', import.meta.url))
const healthFixturePath = fileURLToPath(new URL('../../.env.health', import.meta.url))
const packageJsonPath = fileURLToPath(new URL('../../package.json', import.meta.url))
const viteConfigPath = fileURLToPath(new URL('../../vite.config.ts', import.meta.url))
const playwrightConfigPath = fileURLToPath(
  new URL('../../playwright.config.ts', import.meta.url),
)
const viteBinaryPath = fileURLToPath(
  new URL('../../node_modules/.bin/vite', import.meta.url),
)
const firebaseServerPath = fileURLToPath(
  new URL('../../src/integrations/firebase/firebase.server.ts', import.meta.url),
)

const requiredRuntimeKeys = [
  'DATABASE_URL',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'MINIO_ENDPOINT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET_NAME',
  'ANALYZE_QUEUE_NAME',
  'REDIS_HOST',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close((error) => {
        if (error) return reject(error)
        if (!address || typeof address === 'string') {
          return reject(new Error('No se pudo reservar un puerto para Vite.'))
        }
        resolve(address.port)
      })
    })
  })
}

async function waitForText(url: string): Promise<string> {
  const deadline = Date.now() + 10_000
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return await response.text()
      lastError = new Error(`Vite respondió ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Vite no inició dentro del tiempo esperado.')
}

describe('health.sh', () => {
  it('uses the tracked inert fixture in a clean child environment', () => {
    const script = readFileSync(healthScriptPath, 'utf8')

    expect(script).toContain('HEALTH_ENV_FILE=".env.health"')
    expect(script).toContain('HEALTH_PLAYWRIGHT_PORT="${PLAYWRIGHT_PORT:-3000}"')
    expect(script).toContain('HEALTH_SKIP_E2E="${SKIP_E2E:-false}"')
    expect(script).toContain('env -i')
    expect(script).toContain('./node_modules/.bin/dotenv -e "$HEALTH_ENV_FILE"')
    expect(script).toContain('bun --no-env-file run typecheck')
    expect(script).toContain('bun --no-env-file run build')
    expect(script).toContain('bun --no-env-file run test -- --passWithNoTests')
    expect(script).toContain('bun --no-env-file run test:e2e')
    expect(script).not.toContain('dotenv -e .env --')
    expect(script).not.toContain('dotenv -e .env.local --')
  })

  it('covers every required runtime key with placeholder values only', () => {
    const fixture = readFileSync(healthFixturePath, 'utf8')

    for (const key of requiredRuntimeKeys) {
      expect(fixture).toMatch(new RegExp(`^${key}=.+$`, 'm'))
    }

    expect(fixture).toContain('GOOGLE_APPLICATION_CREDENTIALS=/tmp/')
    expect(fixture).not.toMatch(/BEGIN (?:RSA )?PRIVATE KEY/)
    expect(fixture).not.toMatch(/AIza[\w-]{20,}/)
    expect(fixture).not.toContain('OPENAI_API_KEY=')
    expect(fixture).not.toContain('CLAUDE_API_KEY=')
  })

  it('prevents Bun from auto-loading API keys from a project .env', () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), 'bill-lm-health-env-'))
    writeFileSync(join(tempDirectory, '.env'), 'OPENAI_API_KEY=must-not-load\n')

    try {
      const output = execFileSync(
        'bun',
        [
          '--no-env-file',
          '-e',
          'process.stdout.write(process.env.OPENAI_API_KEY ?? "missing")',
        ],
        {
          cwd: tempDirectory,
          env: {
            PATH: process.env.PATH ?? '',
            HOME: process.env.HOME ?? '',
          },
          encoding: 'utf8',
        },
      )

      expect(output).toBe('missing')
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true })
    }
  })

  it('does not read Firebase Admin credentials while bootstrapping route modules', () => {
    const firebaseServer = readFileSync(firebaseServerPath, 'utf8')

    expect(firebaseServer).toContain('function createLazyFirebaseService')
    expect(firebaseServer).toContain('getAdminApp().firestore()')
    expect(firebaseServer).toContain('getAdminApp().auth()')
    expect(firebaseServer).not.toContain('export const adminDb = admin.firestore()')
    expect(firebaseServer).not.toContain('export const adminAuth = admin.auth()')
  })

  it('disables Bun env auto-loading for the nested Playwright command', () => {
    const packageJson = readFileSync(packageJsonPath, 'utf8')

    expect(packageJson).toContain('bun --no-env-file x playwright test')
    expect(packageJson).not.toContain('npx playwright test')
  })

  it('disables Vite .env loading for the health build and Playwright dev server', () => {
    const viteConfig = readFileSync(viteConfigPath, 'utf8')
    const playwrightConfig = readFileSync(playwrightConfigPath, 'utf8')

    expect(viteConfig).toContain('envDir: false')
    expect(playwrightConfig).toContain('vite dev --port ${port}')
  })

  it('does not expose a VITE-only .env value in an isolated Vite build or dev server', async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), 'bill-lm-health-vite-'))
    const viteConfig = 'export default { envDir: false }\n'
    const marker = 'must-not-load-vite-health'

    writeFileSync(join(tempDirectory, '.env'), `VITE_HEALTH_LEAK=${marker}\n`)
    writeFileSync(join(tempDirectory, 'vite.config.ts'), viteConfig)
    mkdirSync(join(tempDirectory, 'src'))
    writeFileSync(
      join(tempDirectory, 'index.html'),
      '<div id="app"></div><script type="module" src="/src/main.ts"></script>',
    )
    writeFileSync(
      join(tempDirectory, 'src/main.ts'),
      'document.querySelector("#app")!.textContent = import.meta.env.VITE_HEALTH_LEAK ?? "missing"',
    )

    try {
      execFileSync(viteBinaryPath, ['build', '--config', 'vite.config.ts'], {
        cwd: tempDirectory,
        env: {
          PATH: process.env.PATH ?? '',
          HOME: process.env.HOME ?? '',
        },
        stdio: 'pipe',
      })

      const assetDirectory = join(tempDirectory, 'dist/assets')
      const buildOutput = readdirSync(assetDirectory)
        .map((file) => readFileSync(join(assetDirectory, file), 'utf8'))
        .join('\n')
      expect(buildOutput).not.toContain(marker)

      const port = await reservePort()
      const devServer = spawn(
        viteBinaryPath,
        ['--config', 'vite.config.ts', '--host', '127.0.0.1', '--port', String(port)],
        {
          cwd: tempDirectory,
          env: {
            PATH: process.env.PATH ?? '',
            HOME: process.env.HOME ?? '',
          },
          stdio: 'pipe',
        },
      )

      try {
        const source = await waitForText(`http://127.0.0.1:${port}/src/main.ts`)
        expect(source).not.toContain(marker)
      } finally {
        devServer.kill('SIGTERM')
      }
    } finally {
      rmSync(tempDirectory, { recursive: true, force: true })
    }
  })
})
