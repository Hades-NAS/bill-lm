import { describe, expect, test } from 'bun:test'
import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, resolveConfig } from 'vite'

import { checkWorkspace } from '../check-package-boundaries'

const fixtures = fileURLToPath(
  new URL('../__fixtures__/package-boundaries/', import.meta.url),
)
const legacyFixtures = fileURLToPath(
  new URL('../__fixtures__/legacy-root-sources/', import.meta.url),
)

function diagnosticsFor(name: string) {
  return checkWorkspace(`${fixtures}${name}`).map(
    ({ file, line, message }) => `${file}:${line}: ${message}`,
  )
}

function legacyDiagnosticsFor(name: string) {
  return checkWorkspace(`${legacyFixtures}${name}`).map(
    ({ file, line, message }) => `${file}:${line}: ${message}`,
  )
}

describe('check-package-boundaries', () => {
  test('accepts an explicit, declared public dependency graph', () => {
    expect(diagnosticsFor('valid')).toEqual([])
  })

  test('reports every material violation in deterministic order', () => {
    expect(diagnosticsFor('invalid-rules')).toEqual([
      'apps/local-viewer/src/index.mjs:1: local-viewer must not import Bun, filesystem, SQLite, or daemon modules',
      'packages/application/src/index.mjs:1: application may only import @bill-lm/contracts, @bill-lm/domain, or relative modules',
      'packages/contracts/src/index.mjs:1: contracts must remain browser, framework, and infrastructure neutral',
      'packages/domain/src/index.mjs:1: domain may only use relative imports',
      'packages/ui/src/index.mjs:1: ui must not import router, infrastructure, or app/daemon packages',
    ])
  })

  test('allows React and Mantine as UI rendering dependencies', () => {
    expect(diagnosticsFor('valid')).toEqual([])
  })

  test('reports deep imports, missing declarations, and relative escapes', () => {
    expect(diagnosticsFor('invalid-imports')).toEqual([
      'apps/web/src/index.mjs:1: deep internal import is forbidden: @bill-lm/domain/internal',
      'apps/web/src/index.mjs:2: internal import must declare @bill-lm/domain as workspace:*',
      'apps/web/src/index.mjs:3: relative imports must not escape their workspace source root',
    ])
  })

  test('rejects wildcard and nonexistent export targets', () => {
    expect(diagnosticsFor('invalid-exports')).toEqual([
      'packages/contracts/package.json:1: export ./missing target does not exist: ./src/missing.mjs',
      'packages/contracts/package.json:1: exports maps must not use wildcard subpaths',
    ])
  })

  test('requires internal roots to be explicitly exported', () => {
    expect(diagnosticsFor('invalid-public')).toEqual([
      'apps/web/src/index.mjs:1: internal import must target a declared public root export: @bill-lm/domain',
      'packages/domain/package.json:1: packages with source files require an explicit exports map',
    ])
  })

  test('rejects browser globals and APIs in contracts', () => {
    expect(diagnosticsFor('invalid-browser-global')).toEqual([
      'packages/contracts/src/index.mjs:1: contracts must not use browser globals or APIs: window',
    ])
  })

  test('accepts the declared legacy root baseline', () => {
    expect(legacyDiagnosticsFor('valid')).toEqual([])
  })

  test('rejects a new legacy root source under the declared manifest', () => {
    expect(legacyDiagnosticsFor('new-root-source')).toEqual([
      'scripts/legacy-root-source-manifest.json:1: legacy root source baseline differs; expected 1 files but found 2',
    ])
  })

  test('rejects workspace imports back into legacy root code under the declared manifest', () => {
    expect(legacyDiagnosticsFor('workspace-root-import')).toEqual([
      'apps/web/src/index.mjs:1: relative imports must not escape their workspace source root',
      'apps/web/src/index.mjs:1: workspace sources must not reference legacy root code: ../../../src/legacy.ts',
    ])
  })

  test('ignores Vite dependency caches without exempting authored legacy aliases', () => {
    const fixtureRoot = `${legacyFixtures}workspace-alias-with-vite-cache`
    const dependencyCache = join(
      fixtureRoot,
      'apps/web/node_modules/.vite/deps/@prisma_adapter-pg.js',
    )
    mkdirSync(dirname(dependencyCache), { recursive: true })
    writeFileSync(dependencyCache, "import '@/generated/prisma/client'\n")

    try {
      expect(legacyDiagnosticsFor('workspace-alias-with-vite-cache')).toEqual([
        'apps/web/src/index.mjs:1: workspace sources must not reference legacy root code: @/',
      ])
    } finally {
      rmSync(join(fixtureRoot, 'apps/web/node_modules'), {
        recursive: true,
        force: true,
      })
    }
  })

  test('rejects a root configuration reference under the declared manifest', () => {
    expect(legacyDiagnosticsFor('new-config-reference')).toEqual([
      'scripts/legacy-root-source-manifest.json:1: legacy root reference importer inventory differs from manifest',
    ])
  })

  test('rejects package sources that import legacy root code', () => {
    expect(legacyDiagnosticsFor('package-root-import')).toEqual([
      'packages/domain/src/index.mjs:1: relative imports must not escape their workspace source root',
      'packages/domain/src/index.mjs:1: workspace sources must not reference legacy root code: ../../../src/legacy.ts',
    ])
  })

  test('accepts an empty final manifest only when no legacy root sources remain', () => {
    expect(legacyDiagnosticsFor('final-empty')).toEqual([])
    expect(legacyDiagnosticsFor('final-with-root')).toEqual([
      'scripts/legacy-root-source-manifest.json:1: a final legacy root source manifest requires no root application sources',
      'scripts/legacy-root-source-manifest.json:1: legacy root source baseline differs; expected 0 files but found 1',
    ])
  })

  test('keeps local-viewer Vite aliases out of package internals', async () => {
    const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
    const localConfig = await resolveConfig(
      { configFile: join(projectRoot, 'apps/local-viewer/vite.config.ts') },
      'serve',
    )

    expect(
      localConfig.resolve.alias.some(
        (alias) =>
          alias.find === '@bill-lm' ||
          (typeof alias.find === 'string' &&
            alias.find.startsWith('@bill-lm/')),
      ),
    ).toBe(false)
  })

  test('resolves only public package exports for Bun and Vite SSR', async () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'bill-lm-boundaries-'))
    const viewerRoot = join(temporaryRoot, 'apps/local-viewer')
    const sharedRoot = join(temporaryRoot, 'packages/shared')
    const importer = join(viewerRoot, 'src/index.mjs')
    const packageLink = join(viewerRoot, 'node_modules/@bill-lm/shared')

    mkdirSync(dirname(importer), { recursive: true })
    mkdirSync(sharedRoot, { recursive: true })
    mkdirSync(dirname(packageLink), { recursive: true })
    writeFileSync(importer, 'export {}\n')
    writeFileSync(
      join(sharedRoot, 'package.json'),
      JSON.stringify({
        name: '@bill-lm/shared',
        type: 'module',
        exports: { '.': './index.mjs' },
      }),
    )
    writeFileSync(join(sharedRoot, 'index.mjs'), 'export const shared = true\n')
    writeFileSync(
      join(sharedRoot, 'internal.mjs'),
      'export const internal = true\n',
    )
    symlinkSync(sharedRoot, packageLink, 'dir')

    const vite = await createServer({
      configFile: false,
      root: viewerRoot,
      logLevel: 'silent',
      server: { middlewareMode: true },
    })

    try {
      const publicEntryPoint = realpathSync(join(sharedRoot, 'index.mjs'))

      await expect(Bun.resolve('@bill-lm/shared', importer)).resolves.toBe(
        publicEntryPoint,
      )
      await expect(
        Bun.resolve('@bill-lm/shared/internal', importer),
      ).rejects.toThrow()

      const publicRoot = await vite.pluginContainer.resolveId(
        '@bill-lm/shared',
        importer,
        { ssr: true },
      )
      expect(publicRoot?.id).toBe(publicEntryPoint)
      await expect(
        vite.pluginContainer.resolveId('@bill-lm/shared/internal', importer, {
          ssr: true,
        }),
      ).rejects.toThrow('Missing "./internal" specifier')
    } finally {
      await vite.close()
      rmSync(temporaryRoot, { recursive: true, force: true })
    }
  })
})
