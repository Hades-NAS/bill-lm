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
    throw new Error(`Falta ${name}. Ejemplo: bun run rules:sri:fetch --source ec-sri-rlrti --url https://www.sri.gob.ec/archivo.pdf`)
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
  if (!source)
    throw new Error(`No existe la fuente SRI registrada “${sourceId}”.`)
  return source
}

async function loadDownloadRecord(sourceId: string): Promise<DownloadRecord> {
  try {
    return JSON.parse(await readFile(join(cacheRoot, 'downloads', `${sourceId}.json`), 'utf8'))
  } catch {
    throw new Error(`No hay un original descargado para “${sourceId}”. Ejecuta primero rules:sri:fetch.`)
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
    throw new Error(`No hay borradores para “${sourceId}”. Ejecuta primero rules:sri:split.`)
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

async function runCheck() {
  const results = await Promise.all(
    (await loadSources()).map(async (source) => {
      try {
        return await checkTaxRuleSource(source)
      } catch (error) {
        return {
          sourceId: source.id,
          status: 'source-unavailable' as const,
          detail: error instanceof Error ? error.message : 'No se pudo consultar la fuente.',
        }
      }
    }),
  )
  console.log(JSON.stringify(results, null, 2))
}

async function runFetch() {
  const sourceId = requireOption('--source')
  const source = await loadSource(sourceId)
  const urlOverride = option('--url')
  if (!source.resolvedUrl && !urlOverride)
    throw new Error(
      `La fuente “${sourceId}” todavía no tiene un PDF resuelto. Indica --url con un enlace HTTPS de www.sri.gob.ec encontrado y revisado desde su página oficial.`,
    )

  const downloaded = await fetchTaxRuleSource(
    urlOverride ? { ...source, resolvedUrl: urlOverride } : source,
    cacheRoot,
  )
  const record: DownloadRecord = {
    sourceId,
    ...downloaded,
    retrievedAt: new Date().toISOString(),
  }
  const metadataPath = join(cacheRoot, 'downloads', `${sourceId}.json`)
  await mkdir(join(cacheRoot, 'downloads'), { recursive: true })
  await writeFile(metadataPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(record, null, 2))
}

async function runExtract() {
  const sourceId = requireOption('--source')
  const record = await loadDownloadRecord(sourceId)
  const pdf = await readFile(record.path)
  const contentHash = `sha256:${createHash('sha256').update(pdf).digest('hex')}`
  if (contentHash !== record.contentHash)
    throw new Error(`El original de “${sourceId}” no coincide con el hash registrado. Descárgalo de nuevo.`)

  const markdown = await extractTaxRulePdf(pdf)
  const outputPath = join(
    cacheRoot,
    'extracted',
    `${basename(record.path, '.pdf')}.md`,
  )
  await mkdir(join(cacheRoot, 'extracted'), { recursive: true })
  await writeFile(outputPath, markdown, 'utf8')
  console.log(JSON.stringify({ sourceId, path: outputPath, sourceContentHash: contentHash }, null, 2))
}

async function runSplit() {
  const sourceId = requireOption('--source')
  const source = await loadSource(sourceId)
  const record = await loadDownloadRecord(sourceId)
  const markdown = await readFile(
    join(cacheRoot, 'extracted', `${basename(record.path, '.pdf')}.md`),
    'utf8',
  ).catch(() => {
    throw new Error(`No hay extracción para “${sourceId}”. Ejecuta primero rules:sri:extract.`)
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
  console.log(JSON.stringify({ sourceId, path: outputPath, sections: drafts.length }, null, 2))
}

async function runDiff() {
  const sourceId = requireOption('--source')
  const diff = diffTaxRuleSections(
    await loadDrafts(sourceId),
    await loadReviewedSections(sourceId),
  )
  console.log(JSON.stringify({ sourceId, ...diff }, null, 2))
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
  if (!draft) throw new Error(`No existe un borrador “${sectionId}” para revisar.`)
  console.log(JSON.stringify({
    section: draft,
    nextStep: 'Revisa el texto, páginas, vigencia, propósito, régimen y referencias. La promoción es manual y debe crear un archivo nuevo en resources/tax-rules/ec/sri/sections/reviewed/.',
  }, null, 2))
}

const command = process.argv[2]
if (command === 'check') await runCheck()
else if (command === 'fetch') await runFetch()
else if (command === 'extract') await runExtract()
else if (command === 'split') await runSplit()
else if (command === 'diff') await runDiff()
else if (command === 'review') await runReview()
else
  throw new Error(
    'Usa uno de: check, fetch, extract, split, diff o review. Consulta el diseño para los argumentos requeridos.',
  )
