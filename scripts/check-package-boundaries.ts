import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { relative, resolve, sep } from 'node:path'

const WORKSPACES = [
  ['apps/web', 'web'],
  ['apps/local-viewer', 'local-viewer'],
  ['apps/local-daemon', 'local-daemon'],
  ['packages/domain', 'domain'],
  ['packages/application', 'application'],
  ['packages/contracts', 'contracts'],
  ['packages/ui', 'ui'],
  ['packages/testing', 'testing'],
] as const

const SOURCE_EXTENSION = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|css)$/
/**
 * Workspace source traversal must inspect only authored sources. Dependency
 * trees and tool caches can contain arbitrary bundled specifiers (including
 * legacy aliases) that are not imports made by this repository.
 */
const NON_SOURCE_DIRECTORIES = new Set([
  '.git',
  '.vite',
  'dist',
  'node_modules',
])
const INTERNAL_SPECIFIER = /^@bill-lm\/([a-z-]+)(?:\/(.*))?$/
const FORBIDDEN_PLATFORM_IMPORT =
  /^(?:bun(?::|$)|node:(?:fs|fs\/promises)(?:$|\/)|better-sqlite3(?:$|\/)|sqlite(?:$|\/)|sqlite3(?:$|\/)|@prisma\/(?:client|adapter-pg)(?:$|\/)|prisma(?:$|\/)|firebase(?:$|\/)|@trpc\/(?:client|server|tanstack-react-query)(?:$|\/)|@tanstack\/react-router(?:$|\/)|react(?:$|\/)|@mantine\/(?:core|dates|dropzone|hooks|modals|notifications|nprogress)(?:$|\/))/
const FORBIDDEN_UI_IMPORT =
  /^(?:bun(?::|$)|node:(?:fs|fs\/promises)(?:$|\/)|better-sqlite3(?:$|\/)|sqlite(?:$|\/)|sqlite3(?:$|\/)|@prisma\/(?:client|adapter-pg)(?:$|\/)|prisma(?:$|\/)|firebase(?:$|\/)|@trpc\/(?:client|server|tanstack-react-query)(?:$|\/)|@tanstack\/react-router(?:$|\/))/
const BROWSER_GLOBAL_OR_API =
  /\b(?:window|document|navigator|location|history|localStorage|sessionStorage|indexedDB|XMLHttpRequest|WebSocket|Worker|FileReader|DOMParser|HTMLElement|fetch|alert|confirm|prompt)\b/
const LEGACY_ROOT_MANIFEST = 'scripts/legacy-root-source-manifest.json'
const LEGACY_ROOT_REFERENCE =
  /(?:\.\.\/)+(?:src|local-viewer)\/[A-Za-z0-9_./$()[\]-]+|(?:^|[\s"'`])\/(?:src|local-viewer)\/[A-Za-z0-9_./$()[\]-]+|(?:^|[\s"'`])(?:src|local-viewer)\/[A-Za-z0-9_./$()[\]-]+|(?:^|[\s"'`])server\.ts(?=$|[\s"'`,)\]])|#\/|@\//gm

type LegacyRootManifest = {
  version: 1
  final: boolean
  legacyRootSourceFileCount: number
  legacyRootSourceDigest: string
  /**
   * A reviewable, per-importer migration allowance. Each entry names every
   * remaining root-code specifier and the config fields that intentionally
   * carry one. This replaces the former opaque reference digest.
   */
  legacyRootReferences: Array<{
    importer: string
    legacyRootSpecifiers: string[]
    configFields: string[]
  }>
}

export type BoundaryDiagnostic = {
  file: string
  line: number
  message: string
}

type Workspace = {
  name: (typeof WORKSPACES)[number][1]
  path: string
  manifest: Record<string, unknown>
  sourceFiles: string[]
}

function listSourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return []

  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const entryPath = resolve(directory, entry.name)
      if (entry.isDirectory())
        return NON_SOURCE_DIRECTORIES.has(entry.name)
          ? []
          : listSourceFiles(entryPath)
      return entry.isFile() && SOURCE_EXTENSION.test(entry.name)
        ? [entryPath]
        : []
    })
}

function listFiles(
  directory: string,
  predicate: (file: string) => boolean,
): string[] {
  if (!existsSync(directory)) return []

  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const entryPath = resolve(directory, entry.name)
      return entry.isDirectory()
        ? listFiles(entryPath, predicate)
        : entry.isFile() && predicate(entryPath)
          ? [entryPath]
          : []
    })
}

function listLegacyRootSources(root: string): string[] {
  const sources = listFiles(resolve(root, 'src'), (file) =>
    SOURCE_EXTENSION.test(file),
  )
  sources.push(
    ...listFiles(
      resolve(root, 'local-viewer'),
      (file) => SOURCE_EXTENSION.test(file) || file.endsWith('.html'),
    ),
  )
  if (existsSync(resolve(root, 'server.ts')))
    sources.push(resolve(root, 'server.ts'))
  return sources.map((file) => relative(root, file)).sort()
}

const LEGACY_REFERENCE_DIRECTORIES = [
  '.github',
  'docker',
  'e2e',
  'local-viewer',
  'prisma',
  'scripts',
] as const
const LEGACY_REFERENCE_ROOT_FILES = [
  'firebase.json',
  'firestore.indexes.json',
  'health.sh',
  'index.html',
  'opencode.json',
  'package.json',
  'playwright.config.ts',
  'tsconfig.json',
  'vite.config.ts',
] as const
const LEGACY_REFERENCE_FILE_EXTENSION =
  /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|json|ya?ml|sh|html|prisma)$/

function isLegacyReferenceFile(root: string, file: string): boolean {
  const fileName = relative(root, file)
  if (
    fileName.startsWith('scripts/__fixtures__/') ||
    fileName === LEGACY_ROOT_MANIFEST
  )
    return false
  return (
    LEGACY_REFERENCE_FILE_EXTENSION.test(fileName) ||
    fileName.endsWith('Dockerfile')
  )
}

function listLegacyReferenceFiles(root: string): string[] {
  const files = LEGACY_REFERENCE_DIRECTORIES.flatMap((directory) =>
    listFiles(resolve(root, directory), (file) =>
      isLegacyReferenceFile(root, file),
    ),
  )
  for (const file of LEGACY_REFERENCE_ROOT_FILES) {
    const filePath = resolve(root, file)
    if (existsSync(filePath)) files.push(filePath)
  }
  return files.map((file) => relative(root, file)).sort()
}

function referencesIn(content: string): string[] {
  return [
    ...new Set(
      [...content.matchAll(LEGACY_ROOT_REFERENCE)].map((match) =>
        match[0].trim().replace(/^["'`]/, ''),
      ),
    ),
  ].sort()
}

function sourceDigest(files: string[]): string {
  return createHash('sha256').update(JSON.stringify(files)).digest('hex')
}

function sameStrings(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function readLegacyRootManifest(root: string): LegacyRootManifest | undefined {
  const manifestPath = resolve(root, LEGACY_ROOT_MANIFEST)
  if (!existsSync(manifestPath)) return undefined
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as LegacyRootManifest
}

function validateLegacyRootMigration(
  root: string,
  diagnostics: BoundaryDiagnostic[],
) {
  const manifest = readLegacyRootManifest(root)
  if (!manifest) return

  const manifestFile = LEGACY_ROOT_MANIFEST
  const actualSources = listLegacyRootSources(root)
  const actualReferenceFiles = listLegacyReferenceFiles(root)
  const expectedReferences = Array.isArray(manifest.legacyRootReferences)
    ? manifest.legacyRootReferences
    : []

  if (manifest.version !== 1) {
    diagnostics.push({
      file: manifestFile,
      line: 1,
      message: 'legacy root source manifest must use version 1',
    })
  }
  if (
    typeof manifest.legacyRootSourceFileCount !== 'number' ||
    typeof manifest.legacyRootSourceDigest !== 'string' ||
    manifest.legacyRootSourceFileCount !== actualSources.length ||
    sourceDigest(actualSources) !== manifest.legacyRootSourceDigest
  ) {
    diagnostics.push({
      file: manifestFile,
      line: 1,
      message: `legacy root source baseline differs; expected ${manifest.legacyRootSourceFileCount ?? 0} files but found ${actualSources.length}`,
    })
  }
  if (manifest.legacyRootSourceFileCount === 0 && !manifest.final) {
    diagnostics.push({
      file: manifestFile,
      line: 1,
      message: 'an empty legacy root source baseline requires final: true',
    })
  }
  if (
    manifest.final &&
    (actualSources.length > 0 || manifest.legacyRootSourceFileCount > 0)
  ) {
    diagnostics.push({
      file: manifestFile,
      line: 1,
      message:
        'a final legacy root source manifest requires no root application sources',
    })
  }

  const expectedImporters = expectedReferences.map(({ importer }) => importer)
  if (!sameStrings([...expectedImporters].sort(), expectedImporters)) {
    diagnostics.push({
      file: manifestFile,
      line: 1,
      message: 'legacy root reference importers must be sorted and unique',
    })
  }
  if (!sameStrings(expectedImporters, actualReferenceFiles)) {
    diagnostics.push({
      file: manifestFile,
      line: 1,
      message: 'legacy root reference importer inventory differs from manifest',
    })
  }
  for (const expected of expectedReferences) {
    if (
      !Array.isArray(expected.legacyRootSpecifiers) ||
      !sameStrings(
        [...expected.legacyRootSpecifiers].sort(),
        expected.legacyRootSpecifiers,
      )
    ) {
      diagnostics.push({
        file: manifestFile,
        line: 1,
        message: `legacy root specifiers for ${expected.importer} must be sorted and unique`,
      })
      continue
    }
    if (
      !Array.isArray(expected.configFields) ||
      !sameStrings([...expected.configFields].sort(), expected.configFields)
    ) {
      diagnostics.push({
        file: manifestFile,
        line: 1,
        message: `legacy root config fields for ${expected.importer} must be sorted and unique`,
      })
      continue
    }
    const filePath = resolve(root, expected.importer)
    if (!existsSync(filePath)) continue
    const actualSpecifiers = referencesIn(readFileSync(filePath, 'utf8'))
    if (!sameStrings(expected.legacyRootSpecifiers, actualSpecifiers)) {
      diagnostics.push({
        file: manifestFile,
        line: 1,
        message: `legacy root specifiers for ${expected.importer} differ from manifest`,
      })
    }
  }

  for (const workspace of WORKSPACES.map(([workspacePath]) => workspacePath)) {
    for (const file of listSourceFiles(resolve(root, workspace))) {
      const rootReferences = referencesIn(readFileSync(file, 'utf8')).filter(
        (reference) => {
          if (reference === '@/') return true
          if (reference === '#/') return workspace !== 'apps/web'
          if (
            reference.startsWith('/src/') ||
            reference.startsWith('/local-viewer/')
          )
            return true
          const target = resolve(file, '..', reference)
          return (
            !isOutside(target, resolve(root, 'src')) ||
            !isOutside(target, resolve(root, 'local-viewer'))
          )
        },
      )
      if (rootReferences.length > 0) {
        diagnostics.push({
          file: relative(root, file),
          line: 1,
          message: `workspace sources must not reference legacy root code: ${rootReferences.join(', ')}`,
        })
      }
    }
  }
}

function readManifest(workspacePath: string): Record<string, unknown> {
  const manifestPath = resolve(workspacePath, 'package.json')
  if (!existsSync(manifestPath)) return {}
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
    string,
    unknown
  >
}

function lineAt(content: string, offset: number): number {
  return content.slice(0, offset).split('\n').length
}

function importsIn(
  content: string,
): Array<{ specifier: string; line: number }> {
  const found: Array<{ specifier: string; line: number }> = []
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?[\s\S]*?\s+from\s*(['"])([^'"\n]+)\1/g,
    /\bimport\s*(['"])([^'"\n]+)\1/g,
    /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g,
  ]

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      found.push({
        specifier: match[2],
        line: lineAt(content, match.index ?? 0),
      })
    }
  }

  return found
}

function hasUndeclaredDynamicImport(content: string): number | undefined {
  const match = /\bimport\s*\(\s*(?!['"])/.exec(content)
  return match ? lineAt(content, match.index) : undefined
}

function browserGlobalOrApiIn(
  content: string,
): { name: string; line: number } | undefined {
  const match = BROWSER_GLOBAL_OR_API.exec(content)
  return match
    ? { name: match[0], line: lineAt(content, match.index) }
    : undefined
}

function hasWorkspaceDependency(
  manifest: Record<string, unknown>,
  packageName: string,
): boolean {
  return [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ].some((key) => {
    const dependencies = manifest[key]
    return (
      typeof dependencies === 'object' &&
      dependencies !== null &&
      (dependencies as Record<string, unknown>)[packageName] === 'workspace:*'
    )
  })
}

function isOutside(path: string, directory: string): boolean {
  const pathFromDirectory = relative(directory, path)
  return pathFromDirectory === '..' || pathFromDirectory.startsWith(`..${sep}`)
}

function exportTargets(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return []
  return Object.values(value as Record<string, unknown>).flatMap(exportTargets)
}

function validateExports(
  root: string,
  workspace: Workspace,
  diagnostics: BoundaryDiagnostic[],
) {
  if (workspace.sourceFiles.length === 0) return

  const exportsValue = workspace.manifest.exports
  const manifestFile = `${workspace.path}/package.json`
  if (
    typeof exportsValue !== 'object' ||
    exportsValue === null ||
    Array.isArray(exportsValue)
  ) {
    diagnostics.push({
      file: manifestFile,
      line: 1,
      message: 'packages with source files require an explicit exports map',
    })
    return
  }

  for (const [subpath, target] of Object.entries(
    exportsValue as Record<string, unknown>,
  )) {
    if (subpath.includes('*')) {
      diagnostics.push({
        file: manifestFile,
        line: 1,
        message: 'exports maps must not use wildcard subpaths',
      })
      continue
    }

    const targets = exportTargets(target)
    if (targets.length === 0) {
      diagnostics.push({
        file: manifestFile,
        line: 1,
        message: `export ${subpath} must target a file`,
      })
      continue
    }

    for (const exportTarget of targets) {
      const targetPath = resolve(root, workspace.path, exportTarget)
      if (!exportTarget.startsWith('./') || exportTarget.includes('..')) {
        diagnostics.push({
          file: manifestFile,
          line: 1,
          message: `export ${subpath} target must start with ./ and contain no traversal`,
        })
      } else if (!existsSync(targetPath) || !statSync(targetPath).isFile()) {
        diagnostics.push({
          file: manifestFile,
          line: 1,
          message: `export ${subpath} target does not exist: ${exportTarget}`,
        })
      }
    }
  }
}

function validateImport(
  root: string,
  workspace: Workspace,
  workspacesByName: Map<string, Workspace>,
  file: string,
  specifier: string,
  line: number,
  diagnostics: BoundaryDiagnostic[],
) {
  const fileName = file
  const packageMatch = INTERNAL_SPECIFIER.exec(specifier)

  if (specifier.startsWith('.')) {
    const target = resolve(root, file, '..', specifier)
    if (
      workspace.name === 'local-viewer' &&
      fileName.includes('/__tests__/') &&
      target === resolve(root, workspace.path, 'vite.config')
    ) {
      return
    }
    if (isOutside(target, resolve(root, workspace.path, 'src'))) {
      diagnostics.push({
        file: fileName,
        line,
        message: 'relative imports must not escape their workspace source root',
      })
    }
    return
  }

  if (packageMatch) {
    const [, targetName, deepPath] = packageMatch
    if (deepPath) {
      diagnostics.push({
        file: fileName,
        line,
        message: `deep internal import is forbidden: ${specifier}`,
      })
      return
    }
    const targetPackage = `@bill-lm/${targetName}`
    if (!hasWorkspaceDependency(workspace.manifest, targetPackage)) {
      diagnostics.push({
        file: fileName,
        line,
        message: `internal import must declare ${targetPackage} as workspace:*`,
      })
      return
    }
  }

  if (workspace.name === 'domain') {
    diagnostics.push({
      file: fileName,
      line,
      message: 'domain may only use relative imports',
    })
    return
  }

  if (
    workspace.name === 'application' &&
    specifier !== '@bill-lm/domain' &&
    specifier !== '@bill-lm/contracts'
  ) {
    diagnostics.push({
      file: fileName,
      line,
      message:
        'application may only import @bill-lm/contracts, @bill-lm/domain, or relative modules',
    })
    return
  }

  if (packageMatch) {
    const targetWorkspace = workspacesByName.get(packageMatch[1])
    const targetExports = targetWorkspace?.manifest.exports
    if (
      typeof targetExports !== 'object' ||
      targetExports === null ||
      Array.isArray(targetExports) ||
      !Object.hasOwn(targetExports, '.')
    ) {
      diagnostics.push({
        file: fileName,
        line,
        message: `internal import must target a declared public root export: ${specifier}`,
      })
      return
    }
  }

  if (
    workspace.name === 'contracts' &&
    FORBIDDEN_PLATFORM_IMPORT.test(specifier)
  ) {
    diagnostics.push({
      file: fileName,
      line,
      message:
        'contracts must remain browser, framework, and infrastructure neutral',
    })
    return
  }

  if (workspace.name === 'ui') {
    if (
      FORBIDDEN_UI_IMPORT.test(specifier) ||
      /^@bill-lm\/(?:web|local-viewer|local-daemon)$/.test(specifier)
    ) {
      diagnostics.push({
        file: fileName,
        line,
        message:
          'ui must not import router, infrastructure, or app/daemon packages',
      })
    }
    return
  }

  if (workspace.name === 'local-viewer') {
    if (
      !fileName.includes('/__tests__/') &&
      /^(?:bun(?::|$)|node:(?:fs|fs\/promises)(?:$|\/)|better-sqlite3(?:$|\/)|sqlite(?:$|\/)|sqlite3(?:$|\/)|@bill-lm\/local-daemon(?:$|\/))/.test(
        specifier,
      )
    ) {
      diagnostics.push({
        file: fileName,
        line,
        message:
          'local-viewer must not import Bun, filesystem, SQLite, or daemon modules',
      })
    }
  }
}

export function checkWorkspace(root: string): BoundaryDiagnostic[] {
  const workspaces = WORKSPACES.flatMap(([workspacePath, name]) => {
    const absolutePath = resolve(root, workspacePath)
    if (!existsSync(absolutePath)) return []
    return [
      {
        name,
        path: workspacePath,
        manifest: readManifest(absolutePath),
        sourceFiles: listSourceFiles(resolve(absolutePath, 'src')),
      } satisfies Workspace,
    ]
  })
  const diagnostics: BoundaryDiagnostic[] = []
  const workspacesByName = new Map(
    workspaces.map((workspace) => [workspace.name, workspace]),
  )

  for (const workspace of workspaces) {
    validateExports(root, workspace, diagnostics)
    for (const sourceFile of workspace.sourceFiles) {
      const content = readFileSync(sourceFile, 'utf8')
      const displayFile = relative(root, sourceFile)
      const browserGlobalOrApi = browserGlobalOrApiIn(content)
      if (workspace.name === 'contracts' && browserGlobalOrApi) {
        diagnostics.push({
          file: displayFile,
          line: browserGlobalOrApi.line,
          message: `contracts must not use browser globals or APIs: ${browserGlobalOrApi.name}`,
        })
      }
      const dynamicLine = hasUndeclaredDynamicImport(content)
      if (dynamicLine)
        diagnostics.push({
          file: displayFile,
          line: dynamicLine,
          message: 'unverifiable dynamic specifier',
        })
      for (const imported of importsIn(content)) {
        validateImport(
          root,
          workspace,
          workspacesByName,
          displayFile,
          imported.specifier,
          imported.line,
          diagnostics,
        )
      }
    }
  }

  validateLegacyRootMigration(root, diagnostics)

  return diagnostics.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.message.localeCompare(right.message),
  )
}

if (import.meta.main) {
  const diagnostics = checkWorkspace(process.cwd())
  for (const diagnostic of diagnostics) {
    console.error(
      `${diagnostic.file}:${diagnostic.line}: ${diagnostic.message}`,
    )
  }
  if (diagnostics.length > 0) process.exitCode = 1
}
