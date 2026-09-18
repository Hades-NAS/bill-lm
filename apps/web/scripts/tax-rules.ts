import { PrismaPg } from '@prisma/adapter-pg'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { TaxPurposeSchema, TaxRegimeSchema } from '#/schema/tax-analysis'

import {
  checkTaxRuleSource,
  extractTaxRulePdf,
  fetchTaxRuleSource,
} from '#/integrations/tax-rules/acquisition.server'
import {
  runTaxRuleBatch,
  runTaxRulePipeline,
  summarizeTaxRuleBatch,
  TaxRuleCommandError,
  taxRuleUserFacingError,
} from '#/integrations/tax-rules/command-runner'
import {
  DraftTaxRuleSectionSchema,
  buildTaxRuleBundle,
  ReviewedTaxRuleSectionSchema,
  TaxRuleSourceManifestSchema,
} from '#/integrations/tax-rules/contracts'
import {
  buildReviewedSections,
  resolveAmbiguousSection,
} from '#/integrations/tax-rules/promotion'
import {
  diffTaxRuleSections,
  splitTaxRuleSource,
} from '#/integrations/tax-rules/sectioning'

import { PrismaClient } from '../src/generated/prisma/client'

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url))
const sourceDirectory = join(projectRoot, 'resources/tax-rules/ec/sri/sources')
const cacheRoot = join(projectRoot, '.cache/tax-rules/ec/sri')

type DownloadRecord = {
  sourceId: string
  path: string
  resolvedUrl: string
  contentHash: string
  size: number
  retrievedAt: string
  contentType?: string
  contentLength?: number | null
  lastModified?: string | null
}

function option(name: string) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function hasFlag(name: string) {
  return process.argv.includes(name)
}

function requireOption(name: string) {
  const value = option(name)
  if (!value || value.startsWith('--'))
    throw new TaxRuleCommandError(
      `Falta ${name}. Consulta el README de rulesets para los argumentos requeridos.`,
    )
  return value
}

function parseCivilDate(value: string, name: string) {
  const parsed = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value)
  if (!parsed)
    throw new TaxRuleCommandError(`${name} debe usar el formato YYYY-MM-DD.`)
  const date = new Date(`${value}T00:00:00.000Z`)
  if (
    Number.isNaN(date.valueOf()) ||
    date.getUTCFullYear() !== Number(parsed[1]) ||
    date.getUTCMonth() + 1 !== Number(parsed[2]) ||
    date.getUTCDate() !== Number(parsed[3])
  )
    throw new TaxRuleCommandError(`${name} debe ser una fecha válida.`)
  return value
}

function purposeOption() {
  const parsed = TaxPurposeSchema.safeParse(requireOption('--purpose'))
  if (!parsed.success)
    throw new TaxRuleCommandError(
      'Indica un propósito válido: vat_credit, business_income_tax o personal_expenses.',
    )
  return parsed.data
}

function taxRegimeOption() {
  const parsed = TaxRegimeSchema.safeParse(requireOption('--tax-regime'))
  if (!parsed.success)
    throw new TaxRuleCommandError(
      'Indica un régimen válido: general, rimpe_entrepreneur, rimpe_popular_business o unknown.',
    )
  return parsed.data
}

function civilDateOption(name: string) {
  return parseCivilDate(requireOption(name), name)
}

function rationaleOption() {
  const rationale = requireOption('--rationale').trim()
  if (rationale.length < 10)
    throw new TaxRuleCommandError(
      'Explica la decisión con --rationale (al menos 10 caracteres).',
    )
  if (rationale.length > 2_000)
    throw new TaxRuleCommandError(
      'La justificación no puede superar los 2.000 caracteres.',
    )
  return rationale
}

function environmentFile() {
  const suffix = option('--env') ?? option('-e')
  if (!suffix) return join(projectRoot, '.env')
  if (!/^[a-zA-Z0-9_-]+$/.test(suffix))
    throw new TaxRuleCommandError(
      'El entorno solo puede usar letras, números, guiones y guiones bajos.',
    )
  return join(projectRoot, `.env.${suffix}`)
}

async function databaseUrl() {
  const path = environmentFile()
  let content: string
  try {
    content = await readFile(path, 'utf8')
  } catch {
    throw new TaxRuleCommandError(
      `No existe el archivo de entorno “${basename(path)}”.`,
    )
  }
  const line = content
    .split(/\r?\n/)
    .find((value) => value.startsWith('DATABASE_URL='))
  const value = line
    ?.slice('DATABASE_URL='.length)
    .trim()
    .replace(/^['"]|['"]$/g, '')
  if (!value)
    throw new TaxRuleCommandError(`“${basename(path)}” no define DATABASE_URL.`)
  return value
}

async function loadSources() {
  const files = (await readdir(sourceDirectory)).filter((file) =>
    file.endsWith('.source.json'),
  )
  const sources = await Promise.all(
    files.map(async (file) =>
      TaxRuleSourceManifestSchema.parse(
        JSON.parse(await readFile(join(sourceDirectory, file), 'utf8')),
      ),
    ),
  )
  return sources.sort((left, right) => left.id.localeCompare(right.id))
}

async function loadSource(sourceId: string) {
  const source = (await loadSources()).find(
    (candidate) => candidate.id === sourceId,
  )
  if (!source)
    throw new TaxRuleCommandError(
      `No existe la fuente SRI registrada “${sourceId}”.`,
    )
  return source
}

async function selectedSources() {
  const sourceId = option('--source')
  if (!sourceId) return loadSources()
  return [await loadSource(sourceId)]
}

async function loadDownloadRecord(sourceId: string): Promise<DownloadRecord> {
  try {
    return JSON.parse(
      await readFile(join(cacheRoot, 'downloads', `${sourceId}.json`), 'utf8'),
    )
  } catch {
    throw new TaxRuleCommandError(
      `No hay un original descargado para “${sourceId}”. Ejecuta primero rules:sri:fetch.`,
    )
  }
}

async function loadObservedDownloadRecord(
  sourceId: string,
): Promise<DownloadRecord | null> {
  try {
    return await loadDownloadRecord(sourceId)
  } catch {
    return null
  }
}

async function writeAtomically(path: string, value: string) {
  const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`
  await writeFile(temporaryPath, value, 'utf8')
  await rename(temporaryPath, path)
}

async function readJsonFiles(directory: string): Promise<Array<unknown>> {
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
    const path = join(
      cacheRoot,
      'sections',
      'drafts',
      `${basename(record.path, '.pdf')}.json`,
    )
    return DraftTaxRuleSectionSchema.array().parse(
      JSON.parse(await readFile(path, 'utf8')),
    )
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('No hay un original')
    )
      throw error
    throw new TaxRuleCommandError(
      `No hay borradores para “${sourceId}”. Ejecuta primero rules:sri:split.`,
    )
  }
}

async function loadReviewedSections(sourceId: string) {
  const directory = join(
    projectRoot,
    'resources/tax-rules/ec/sri/sections/reviewed',
  )
  const values = await readJsonFiles(directory)
  return ReviewedTaxRuleSectionSchema.array().parse(
    values.filter(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        'sourceId' in value &&
        value.sourceId === sourceId,
    ),
  )
}

async function runBatch(
  command: string,
  operation: (
    source: Awaited<ReturnType<typeof loadSources>>[number],
  ) => Promise<unknown>,
) {
  const results = await runTaxRuleBatch(await selectedSources(), operation)
  const summary = summarizeTaxRuleBatch(results)
  console.log(JSON.stringify({ command, summary, results }, null, 2))
  if (summary.failed > 0) process.exitCode = 1
}

async function runAll() {
  if (option('--url'))
    throw new TaxRuleCommandError(
      'rules:sri:run no acepta --url. Actualiza primero la fuente puntual con rules:sri:fetch --source <id> --url <pdf-sri>.',
    )

  const sources = await selectedSources()
  const results = await runTaxRulePipeline(sources, [
    {
      name: 'check',
      run: async (source) => {
        const observed = await loadObservedDownloadRecord(source.id)
        const result = await checkTaxRuleSource(source, observed?.contentHash)
        if (result.status === 'source-unresolved')
          throw new TaxRuleCommandError(
            `La fuente “${source.id}” todavía no tiene un PDF resuelto. Registra un enlace oficial antes de ejecutar el flujo completo.`,
          )
        return result
      },
    },
    { name: 'fetch', run: fetchSource },
    { name: 'extract', run: extractSource },
    { name: 'split', run: splitSource },
    { name: 'diff', run: diffSource },
  ])
  const summary = summarizeTaxRuleBatch(results)
  console.log(JSON.stringify({ command: 'run', summary, results }, null, 2))
  if (summary.failed > 0) process.exitCode = 1
}

async function fetchSource(
  source: Awaited<ReturnType<typeof loadSources>>[number],
) {
  const urlOverride = option('--url')
  if (urlOverride && !option('--source'))
    throw new TaxRuleCommandError(
      'Usa --url solo junto con --source para no aplicar un PDF a varias fuentes.',
    )
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
  await writeAtomically(metadataPath, `${JSON.stringify(record, null, 2)}\n`)
  return record
}

async function extractSource(
  source: Awaited<ReturnType<typeof loadSources>>[number],
) {
  const record = await loadDownloadRecord(source.id)
  const pdf = await readFile(record.path)
  const contentHash = `sha256:${createHash('sha256').update(pdf).digest('hex')}`
  if (contentHash !== record.contentHash)
    throw new TaxRuleCommandError(
      `El original de “${source.id}” no coincide con el hash registrado. Descárgalo de nuevo.`,
    )

  const markdown = await extractTaxRulePdf(pdf)
  const outputPath = join(
    cacheRoot,
    'extracted',
    `${basename(record.path, '.pdf')}.md`,
  )
  await mkdir(join(cacheRoot, 'extracted'), { recursive: true })
  await writeAtomically(outputPath, markdown)
  return { path: outputPath, sourceContentHash: contentHash }
}

async function splitSource(
  source: Awaited<ReturnType<typeof loadSources>>[number],
) {
  const record = await loadDownloadRecord(source.id)
  const markdown = await readFile(
    join(cacheRoot, 'extracted', `${basename(record.path, '.pdf')}.md`),
    'utf8',
  ).catch(() => {
    throw new TaxRuleCommandError(
      `No hay extracción para “${source.id}”. Ejecuta primero rules:sri:extract.`,
    )
  })
  const drafts = splitTaxRuleSource(
    {
      id: source.id,
      sourceKind: source.sourceKind,
      contentHash: record.contentHash,
    },
    markdown,
  )
  const outputPath = join(
    cacheRoot,
    'sections',
    'drafts',
    `${basename(record.path, '.pdf')}.json`,
  )
  await mkdir(join(cacheRoot, 'sections', 'drafts'), { recursive: true })
  await writeAtomically(outputPath, `${JSON.stringify(drafts, null, 2)}\n`)
  return { path: outputPath, sections: drafts.length }
}

async function diffSource(
  source: Awaited<ReturnType<typeof loadSources>>[number],
) {
  const drafts = await loadDrafts(source.id)
  const reviewed = await loadReviewedSections(source.id)
  const draftHash = createHash('sha256')
    .update(JSON.stringify(drafts))
    .digest('hex')
  const reviewedHash = createHash('sha256')
    .update(JSON.stringify(reviewed))
    .digest('hex')
  const output = {
    sourceId: source.id,
    generatedAt: new Date().toISOString(),
    sourceContentHash: drafts[0]?.sourceContentHash ?? null,
    draftHash: `sha256:${draftHash}`,
    reviewedHash: `sha256:${reviewedHash}`,
    reviewedSectionCount: reviewed.length,
    ...diffTaxRuleSections(drafts, reviewed),
  }
  const outputPath = join(
    cacheRoot,
    'diffs',
    `${source.id}-${draftHash}-${reviewedHash}.json`,
  )
  await mkdir(join(cacheRoot, 'diffs'), { recursive: true })
  await writeAtomically(outputPath, `${JSON.stringify(output, null, 2)}\n`)
  return { path: outputPath, ...output }
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
  if (!draft)
    throw new TaxRuleCommandError(
      `No existe un borrador “${sectionId}” para revisar.`,
    )
  console.log(
    JSON.stringify(
      {
        section: draft,
        nextStep:
          'Revisa el texto, páginas, vigencia, propósito, régimen y referencias. Si confirmas que el fragmento es válido, usa rules:sri:resolve con una justificación; no edites JSON a mano.',
      },
      null,
      2,
    ),
  )
}

async function findDraftById(sectionId: string) {
  const drafts = await Promise.all(
    (await loadSources()).map(async (source) => {
      try {
        return await loadDrafts(source.id)
      } catch {
        return []
      }
    }),
  )
  return drafts.flat().find((section) => section.id === sectionId)
}

function reviewedMetadata() {
  const effectiveFrom = civilDateOption('--effective-from')
  const effectiveTo = option('--effective-to') ?? null
  if (effectiveTo) parseCivilDate(effectiveTo, '--effective-to')
  if (effectiveTo && effectiveTo < effectiveFrom)
    throw new TaxRuleCommandError(
      'La vigencia final debe ser igual o posterior a la inicial.',
    )
  return {
    reviewer: requireOption('--reviewer'),
    purpose: purposeOption(),
    taxRegime: taxRegimeOption(),
    effectiveFrom,
    effectiveTo,
    reviewedAt: new Date().toISOString(),
  }
}

async function runResolve() {
  if (hasFlag('--all'))
    throw new TaxRuleCommandError(
      'rules:sri:resolve aprueba una sola sección. Indica --section <id>.',
    )
  const sectionId = requireOption('--section')
  const draft = await findDraftById(sectionId)
  if (!draft)
    throw new TaxRuleCommandError(
      `No existe el borrador “${sectionId}”. Ejecuta primero rules:sri:split.`,
    )

  const directory = join(
    projectRoot,
    'resources/tax-rules/ec/sri/sections/reviewed',
  )
  const existingIds = new Set(
    (await loadAllReviewedSectionsOrEmpty()).map((section) => section.id),
  )
  let reviewed: Awaited<ReturnType<typeof resolveAmbiguousSection>>
  try {
    reviewed = resolveAmbiguousSection(
      draft,
      { ...reviewedMetadata(), rationale: rationaleOption() },
      existingIds,
    )
  } catch (error) {
    throw new TaxRuleCommandError(
      error instanceof Error
        ? error.message
        : 'No se pudo resolver la sección. Revisa los datos e inténtalo de nuevo.',
    )
  }

  await mkdir(directory, { recursive: true })
  await writeAtomically(
    join(directory, `${reviewed.id}.json`),
    `${JSON.stringify(reviewed, null, 2)}\n`,
  )
  console.log(
    JSON.stringify(
      {
        command: 'resolve',
        status: 'completed',
        sectionId: reviewed.id,
        path: join(directory, `${reviewed.id}.json`),
      },
      null,
      2,
    ),
  )
}

async function runPromote() {
  const bulk = hasFlag('--all')
  const sectionId = option('--section')
  const sourceId = option('--source')
  if (bulk && sectionId)
    throw new TaxRuleCommandError('Usa --all o --section, no ambos.')
  if (!bulk && !sectionId)
    throw new TaxRuleCommandError(
      'Indica --section <id> o usa --all junto con --source <id>.',
    )
  if (bulk && !sourceId)
    throw new TaxRuleCommandError(
      'La promoción masiva exige --source <id> para no mezclar criterios de fuentes distintas.',
    )
  const rationale = option('--rationale') ? rationaleOption() : undefined
  const metadata = { ...reviewedMetadata(), reviewNotes: rationale }
  const drafts = bulk
    ? await loadDrafts(sourceId!)
    : (
        await Promise.all(
          (await loadSources()).map(async (source) => {
            try {
              return await loadDrafts(source.id)
            } catch {
              return []
            }
          }),
        )
      )
        .flat()
        .filter((draft) => draft.id === sectionId)
  if (!drafts.length && !bulk)
    throw new TaxRuleCommandError(
      `No existe el borrador “${sectionId}”. Ejecuta primero rules:sri:split.`,
    )
  const directory = join(
    projectRoot,
    'resources/tax-rules/ec/sri/sections/reviewed',
  )
  const existingIds = new Set(
    (await loadAllReviewedSectionsOrEmpty()).map((section) => section.id),
  )
  let reviewed: Awaited<ReturnType<typeof buildReviewedSections>>
  try {
    reviewed = buildReviewedSections(drafts, metadata, existingIds)
  } catch (error) {
    throw new TaxRuleCommandError(
      error instanceof Error
        ? error.message
        : 'No se pudieron validar las secciones para promoción.',
    )
  }
  await mkdir(directory, { recursive: true })
  await Promise.all(
    reviewed.map((section) =>
      writeAtomically(
        join(directory, `${section.id}.json`),
        `${JSON.stringify(section, null, 2)}\n`,
      ),
    ),
  )
  console.log(
    JSON.stringify(
      {
        command: 'promote',
        status: 'completed',
        sectionIds: reviewed.map((section) => section.id),
        count: reviewed.length,
      },
      null,
      2,
    ),
  )
}

async function loadAllReviewedSectionsOrEmpty() {
  const directory = join(
    projectRoot,
    'resources/tax-rules/ec/sri/sections/reviewed',
  )
  try {
    return ReviewedTaxRuleSectionSchema.array().parse(
      await readJsonFiles(directory),
    )
  } catch {
    return []
  }
}

async function loadAllReviewedSections() {
  const directory = join(
    projectRoot,
    'resources/tax-rules/ec/sri/sections/reviewed',
  )
  try {
    const sections = ReviewedTaxRuleSectionSchema.array().parse(
      await readJsonFiles(directory),
    )
    if (sections.length === 0)
      throw new TaxRuleCommandError(
        'No hay secciones revisadas. Promueve una sección revisada antes de validar o construir un bundle.',
      )
    return sections
  } catch {
    throw new TaxRuleCommandError(
      'No hay secciones revisadas. Promueve una sección revisada antes de validar o construir un bundle.',
    )
  }
}

async function validatePublication() {
  const sections = await loadAllReviewedSections()
  const sourceIds = new Set((await loadSources()).map((source) => source.id))
  const ids = new Set<string>()
  for (const section of sections) {
    if (ids.has(section.id))
      throw new TaxRuleCommandError(
        `La sección revisada “${section.id}” está duplicada.`,
      )
    ids.add(section.id)
    if (!sourceIds.has(section.sourceId))
      throw new TaxRuleCommandError(
        `La sección “${section.id}” referencia una fuente no registrada.`,
      )
    if (section.effectiveTo && section.effectiveTo < section.effectiveFrom)
      throw new TaxRuleCommandError(
        `La vigencia de “${section.id}” no es válida.`,
      )
  }
  return {
    sections: sections.length,
    sourceIds: [...new Set(sections.map((section) => section.sourceId))],
  }
}

async function runValidate() {
  console.log(
    JSON.stringify(
      {
        command: 'validate',
        status: 'completed',
        ...(await validatePublication()),
      },
      null,
      2,
    ),
  )
}

async function runBuild() {
  const version = Number(requireOption('--version'))
  if (!Number.isInteger(version) || version < 1)
    throw new TaxRuleCommandError('--version debe ser un entero positivo.')
  const createdBy = requireOption('--created-by')
  const effectiveFrom = requireOption('--effective-from')
  const effectiveTo = option('--effective-to') ?? null
  if (effectiveTo && effectiveTo < effectiveFrom)
    throw new TaxRuleCommandError(
      'La vigencia final debe ser igual o posterior a la inicial.',
    )
  await validatePublication()
  const sections = await loadAllReviewedSections()
  const sources = await loadSources()
  const selectedSources = sources
    .filter((source) =>
      sections.some((section) => section.sourceId === source.id),
    )
    .map((source) => ({
      ...source,
      contentHash: sections.find((section) => section.sourceId === source.id)!
        .sourceContentHash,
      reviewStatus: 'reviewed' as const,
    }))
  const year = effectiveFrom.slice(0, 4)
  const bundle = buildTaxRuleBundle({
    schemaVersion: '1',
    rulesetId: `ec-sri-${year}.${version}`,
    version,
    jurisdiction: 'EC',
    effectiveFrom,
    effectiveTo,
    sourceManifests: selectedSources,
    sections,
    rules: [],
    promptContractVersion: 'v2',
    createdAt: new Date().toISOString(),
    createdBy,
  })
  const directory = join(projectRoot, 'resources/tax-rules/ec/sri/rulesets')
  const outputPath = join(directory, `${bundle.rulesetId}.bundle.json`)
  try {
    await readFile(outputPath)
    throw new TaxRuleCommandError(
      `Ya existe el bundle “${bundle.rulesetId}”; crea una versión nueva.`,
    )
  } catch (error) {
    if (error instanceof TaxRuleCommandError) throw error
  }
  await mkdir(directory, { recursive: true })
  await writeAtomically(outputPath, `${JSON.stringify(bundle, null, 2)}\n`)
  console.log(
    JSON.stringify(
      {
        command: 'build',
        status: 'completed',
        path: outputPath,
        rulesetId: bundle.rulesetId,
        bundleHash: bundle.bundleHash,
      },
      null,
      2,
    ),
  )
}

async function loadBundle(version: number) {
  const files = (
    await readdir(join(projectRoot, 'resources/tax-rules/ec/sri/rulesets'))
  ).filter((file) => file.endsWith('.bundle.json'))
  for (const file of files) {
    const bundle = buildTaxRuleBundle(
      JSON.parse(
        await readFile(
          join(projectRoot, 'resources/tax-rules/ec/sri/rulesets', file),
          'utf8',
        ),
      ),
    )
    if (bundle.version === version) return bundle
  }
  throw new TaxRuleCommandError(
    `No existe un bundle con versión ${version}. Ejecuta primero rules:sri:build.`,
  )
}

function dbSelection() {
  return {
    purpose: purposeOption(),
    taxRegime: taxRegimeOption(),
    vatFilingFrequency: requireOption('--vat-filing-frequency'),
  }
}

async function runSyncDb() {
  const version = Number(requireOption('--version'))
  if (!Number.isInteger(version) || version < 1)
    throw new TaxRuleCommandError('--version debe ser un entero positivo.')
  const selection = dbSelection()
  const bundle = await loadBundle(version)
  const sections = bundle.sections.filter(
    (section) =>
      section.purposes.includes(selection.purpose) &&
      section.taxRegimes.includes(selection.taxRegime),
  )
  if (!sections.length)
    throw new TaxRuleCommandError(
      'El bundle no tiene secciones compatibles con el propósito y régimen indicados.',
    )
  const plan = {
    command: 'sync:db',
    version,
    environment: basename(environmentFile()),
    dryRun: !process.argv.includes('--apply'),
    sources: bundle.sourceManifests.length,
    fragments: sections.length,
    selection,
  }
  if (!process.argv.includes('--apply'))
    return console.log(JSON.stringify({ status: 'planned', ...plan }, null, 2))
  const url = await databaseUrl()
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  })
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.taxRuleSet.findFirst({
        where: {
          version,
          ...selection,
          effectiveFrom: new Date(`${bundle.effectiveFrom}T00:00:00.000Z`),
        },
      })
      if (existing) {
        if (existing.contentHash !== bundle.bundleHash)
          throw new TaxRuleCommandError(
            'Ya existe esta versión con contenido distinto; crea una versión nueva.',
          )
        return
      }
      const sourceIds = new Map<string, string>()
      for (const source of bundle.sourceManifests) {
        const existingSource = await tx.taxRuleSource.findFirst({
          where: {
            officialUrl: source.resolvedUrl ?? source.discoveryUrl,
            contentHash: source.contentHash!,
          },
        })
        const persisted =
          existingSource ??
          (await tx.taxRuleSource.create({
            data: {
              title: source.title ?? source.id,
              issuer: source.issuer,
              officialUrl: source.resolvedUrl ?? source.discoveryUrl,
              jurisdiction: source.jurisdiction,
              originalStoragePath: `bundle:${bundle.rulesetId}`,
              contentHash: source.contentHash!,
              reviewStatus: 'reviewed',
            },
          }))
        sourceIds.set(source.id, persisted.id)
      }
      const ruleSet = await tx.taxRuleSet.create({
        data: {
          version,
          ...selection,
          effectiveFrom: new Date(`${bundle.effectiveFrom}T00:00:00.000Z`),
          effectiveTo: bundle.effectiveTo
            ? new Date(`${bundle.effectiveTo}T00:00:00.000Z`)
            : null,
          contentHash: bundle.bundleHash,
          reviewStatus: 'reviewed',
        },
      })
      for (const section of sections) {
        const sourceId = sourceIds.get(section.sourceId)!
        const fragment = await tx.taxRuleFragment.create({
          data: {
            sourceId,
            articleOrSection: section.articleOrSection,
            contentHash: `sha256:${createHash('sha256').update(section.markdown).digest('hex')}`,
            contentMarkdown: section.markdown,
            purposes: section.purposes,
            taxRegimes: section.taxRegimes,
            effectiveFrom: new Date(`${section.effectiveFrom}T00:00:00.000Z`),
            effectiveTo: section.effectiveTo
              ? new Date(`${section.effectiveTo}T00:00:00.000Z`)
              : null,
          },
        })
        await tx.taxRuleSetFragment.create({
          data: { ruleSetId: ruleSet.id, fragmentId: fragment.id },
        })
      }
    })
    console.log(JSON.stringify({ status: 'completed', ...plan }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

async function runActivateDb() {
  const version = Number(requireOption('--version'))
  if (!Number.isInteger(version) || version < 1)
    throw new TaxRuleCommandError('--version debe ser un entero positivo.')
  const selection = dbSelection()
  const plan = {
    command: 'activate:db',
    version,
    environment: basename(environmentFile()),
    dryRun: !process.argv.includes('--apply'),
    selection,
  }
  if (!process.argv.includes('--apply'))
    return console.log(JSON.stringify({ status: 'planned', ...plan }, null, 2))
  const url = await databaseUrl()
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  })
  try {
    await prisma.$transaction(async (tx) => {
      const target = await tx.taxRuleSet.findFirst({
        where: { version, ...selection, reviewStatus: 'reviewed' },
      })
      if (!target)
        throw new TaxRuleCommandError(
          'No existe un ruleset revisado compatible para activar.',
        )
      await tx.taxRuleSet.updateMany({
        where: { ...selection, reviewStatus: 'active' },
        data: { reviewStatus: 'retired' },
      })
      await tx.taxRuleSet.update({
        where: { id: target.id },
        data: { reviewStatus: 'active' },
      })
    })
    console.log(JSON.stringify({ status: 'completed', ...plan }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  const command = process.argv[2]
  if (command === 'check')
    await runBatch(command, async (source) => {
      const observed = await loadObservedDownloadRecord(source.id)
      return checkTaxRuleSource(source, observed?.contentHash)
    })
  else if (command === 'fetch') await runBatch(command, fetchSource)
  else if (command === 'extract') await runBatch(command, extractSource)
  else if (command === 'split') await runBatch(command, splitSource)
  else if (command === 'diff') await runBatch(command, diffSource)
  else if (command === 'run') await runAll()
  else if (command === 'review') await runReview()
  else if (command === 'resolve') await runResolve()
  else if (command === 'promote') await runPromote()
  else if (command === 'validate') await runValidate()
  else if (command === 'build') await runBuild()
  else if (command === 'sync:db') await runSyncDb()
  else if (command === 'activate:db') await runActivateDb()
  else
    throw new TaxRuleCommandError(
      'Usa uno de: check, fetch, extract, split, diff, run, review, resolve, promote, validate, build, sync:db o activate:db. Consulta el README de rulesets para los argumentos requeridos.',
    )
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        status: 'failed',
        message: taxRuleUserFacingError(error),
      },
      null,
      2,
    ),
  )
  process.exitCode = 1
})
