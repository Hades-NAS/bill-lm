import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

import {
  checkTaxRuleSource,
  extractTaxRulePdf,
  fetchTaxRuleSource,
} from '#/integrations/tax-rules/acquisition.server'
import {
  DraftTaxRuleSectionSchema,
  ReviewedTaxRuleSectionSchema,
  TaxRuleSourceManifestSchema,
} from '#/integrations/tax-rules/contracts'
import {
  runTaxRuleBatch,
  summarizeTaxRuleBatch,
  TaxRuleCommandError,
  taxRuleUserFacingError,
} from '#/integrations/tax-rules/command-runner'
import { diffTaxRuleSections, splitTaxRuleSource } from '#/integrations/tax-rules/sectioning'

const projectRoot = process.cwd()
const sourceDirectory = join(projectRoot, 'resources/tax-rules/ec/sri/sources')
const cacheRoot = join(projectRoot, '.cache/tax-rules/ec/sri')

type DownloadRecord = {
  sourceId: string
  path: string
  resolvedUrl: string
  contentHash: string
  size: number
  retrievedAt: string
}

function option(name: string) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function requireOption(name: string) {
  const value = option(name)
  if (!value || value.startsWith('--'))
    throw new TaxRuleCommandError(`Falta ${name}. Ejemplo: bun run rules:sri:fetch --source ec-sri-rlrti --url https://www.sri.gob.ec/archivo.pdf`)
  return value
}

async function loadSources() {
  const files = (await readdir(sourceDirectory)).filter((file) => file.endsWith('.source.json'))
  const sources = await Promise.all(
    files.map(async (file) =>
      TaxRuleSourceManifestSchema.parse(JSON.parse(await readFile(join(sourceDirectory, file), 'utf8'))),
    ),
  )
  return sources.sort((left, right) => left.id.localeCompare(right.id))
}

async function loadSource(sourceId: string) {
  const source = (await loadSources()).find((candidate) => candidate.id === sourceId)
  if (!source) throw new TaxRuleCommandError(`No existe la fuente SRI registrada “${sourceId}”.`)
  return source
}

async function selectedSources() {
  const sourceId = option('--source')
  if (!sourceId) return loadSources()
  return [await loadSource(sourceId)]
}

async function loadDownloadRecord(sourceId: string): Promise<DownloadRecord> {
  try {
    return JSON.parse(await readFile(join(cacheRoot, 'downloads', `${sourceId}.json`), 'utf8'))
  } catch {
    throw new TaxRuleCommandError(`No hay un original descargado para “${sourceId}”. Ejecuta primero rules:sri:fetch.`)
  }
}

async function readJsonFiles(directory: string): Promise<unknown[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const values = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return readJsonFiles(path)
      if (!entry.name.endsWith('.json')) return []
      return [JSON.parse(await readFile(path, 'utf8'))]
    }),
  )
  return values.flat()
}

async function loadDrafts(sourceId: string) {
  try {
    const record = await loadDownloadRecord(sourceId)
    const path = join(cacheRoot, 'sections', 'drafts', `${basename(record.path, '.pdf')}.json`)
    return DraftTaxRuleSectionSchema.array().parse(JSON.parse(await readFile(path, 'utf8')))
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('No hay un original')) throw error
    throw new TaxRuleCommandError(`No hay borradores para “${sourceId}”. Ejecuta primero rules:sri:split.`)
  }
}

async function loadReviewedSections(sourceId: string) {
  const directory = join(projectRoot, 'resources/tax-rules/ec/sri/sections/reviewed')
  const values = await readJsonFiles(directory)
  return ReviewedTaxRuleSectionSchema.array().parse(
    values.filter((value) =>
      typeof value === 'object'
      && value !== null
      && 'sourceId' in value
      && value.sourceId === sourceId,
    ),
  )
}

async function runBatch(
  command: string,
  operation: (source: Awaited<ReturnType<typeof loadSources>>[number]) => Promise<unknown>,
) {
  const results = await runTaxRuleBatch(await selectedSources(), operation)
  const summary = summarizeTaxRuleBatch(results)
  console.log(JSON.stringify({ command, summary, results }, null, 2))
  if (summary.failed > 0) process.exitCode = 1
}

async function fetchSource(source: Awaited<ReturnType<typeof loadSources>>[number]) {
  const urlOverride = option('--url')
  if (urlOverride && !option('--source'))
    throw new TaxRuleCommandError('Usa --url solo junto con --source para no aplicar un PDF a varias fuentes.')
  if (!source.resolvedUrl && !urlOverride)
    throw new TaxRuleCommandError(
      `La fuente “${source.id}” todavía no tiene un PDF resuelto. Indica --url con un enlace HTTPS de www.sri.gob.ec encontrado y revisado desde su página oficial.`,
    )

  const downloaded = await fetchTaxRuleSource(
    urlOverride ? { ...source, resolvedUrl: urlOverride } : source,
    cacheRoot,
  )
  const record: DownloadRecord = {
    sourceId: source.id,
    ...downloaded,
    retrievedAt: new Date().toISOString(),
  }
  const metadataPath = join(cacheRoot, 'downloads', `${source.id}.json`)
  await mkdir(join(cacheRoot, 'downloads'), { recursive: true })
  await writeFile(metadataPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  return record
}

async function extractSource(source: Awaited<ReturnType<typeof loadSources>>[number]) {
  const record = await loadDownloadRecord(source.id)
  const pdf = await readFile(record.path)
  const contentHash = `sha256:${createHash('sha256').update(pdf).digest('hex')}`
  if (contentHash !== record.contentHash)
    throw new TaxRuleCommandError(`El original de “${source.id}” no coincide con el hash registrado. Descárgalo de nuevo.`)

  const markdown = await extractTaxRulePdf(pdf)
  const outputPath = join(
    cacheRoot,
    'extracted',
    `${basename(record.path, '.pdf')}.md`,
  )
  await mkdir(join(cacheRoot, 'extracted'), { recursive: true })
  await writeFile(outputPath, markdown, 'utf8')
  return { path: outputPath, sourceContentHash: contentHash }
}

async function splitSource(source: Awaited<ReturnType<typeof loadSources>>[number]) {
  const record = await loadDownloadRecord(source.id)
  const markdown = await readFile(
    join(cacheRoot, 'extracted', `${basename(record.path, '.pdf')}.md`),
    'utf8',
  ).catch(() => {
    throw new TaxRuleCommandError(`No hay extracción para “${source.id}”. Ejecuta primero rules:sri:extract.`)
  })
  const drafts = splitTaxRuleSource(
    { id: source.id, sourceKind: source.sourceKind, contentHash: record.contentHash },
    markdown,
  )
  const outputPath = join(
    cacheRoot,
    'sections',
    'drafts',
    `${basename(record.path, '.pdf')}.json`,
  )
  await mkdir(join(cacheRoot, 'sections', 'drafts'), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(drafts, null, 2)}\n`, 'utf8')
  return { path: outputPath, sections: drafts.length }
}

async function diffSource(source: Awaited<ReturnType<typeof loadSources>>[number]) {
  const diff = diffTaxRuleSections(
    await loadDrafts(source.id),
    await loadReviewedSections(source.id),
  )
  return diff
}

async function runReview() {
  const sectionId = requireOption('--section')
  const drafts = await Promise.all(
    (await loadSources()).map(async (source) => {
      try {
        return await loadDrafts(source.id)
      } catch {
        return []
      }
    }),
  )
  const draft = drafts.flat().find((section) => section.id === sectionId)
  if (!draft) throw new TaxRuleCommandError(`No existe un borrador “${sectionId}” para revisar.`)
  console.log(JSON.stringify({
    section: draft,
    nextStep: 'Revisa el texto, páginas, vigencia, propósito, régimen y referencias. La promoción es manual y debe crear un archivo nuevo en resources/tax-rules/ec/sri/sections/reviewed/.',
  }, null, 2))
}

async function main() {
  const command = process.argv[2]
  if (command === 'check') await runBatch(command, checkTaxRuleSource)
  else if (command === 'fetch') await runBatch(command, fetchSource)
  else if (command === 'extract') await runBatch(command, extractSource)
  else if (command === 'split') await runBatch(command, splitSource)
  else if (command === 'diff') await runBatch(command, diffSource)
  else if (command === 'review') await runReview()
  else
    throw new TaxRuleCommandError(
      'Usa uno de: check, fetch, extract, split, diff o review. Consulta el README de rulesets para los argumentos requeridos.',
    )
}

main().catch((error) => {
  console.error(JSON.stringify({
    status: 'failed',
    message: taxRuleUserFacingError(error),
  }, null, 2))
  process.exitCode = 1
})
