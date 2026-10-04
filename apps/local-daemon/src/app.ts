import {
  createCollectionContextUseCases,
  createProfileActivityUseCases,
} from '@bill-lm/application'
import {
  CollectionContextRevisionInputSchema,
  CreateLocalCollectionInputSchema,
  CreateLocalConnectionSchema,
  UpdateLocalConnectionSchema,
  EconomicActivityRevisionInputSchema,
  LocalCollectionDetailSchema,
  LocalCollectionSummarySchema,
  LocalInvoiceDetailSchema,
  LocalRunDetailSchema,
  LocalRunListFilterSchema,
  LocalRunSummarySchema,
  LocalConnectionResponseSchema,
  ModelTaxAnalysisPayloadSchema,
  LocalCollectionBatchAnalysisInputSchema,
  LocalCollectionBatchAnalysisProgressSchema,
  LocalCollectionBatchAnalysisResponseSchema,
  LocalCollectionAnalysisInputSchema,
  LocalCollectionInvoiceInputSchema,
  LocalCollectionInvoiceMembershipSchema,
  UpdateLocalCollectionInputSchema,
  TaxpayerProfileRevisionInputSchema,
  resolveLocalAnalysisAvailability,
} from '@bill-lm/contracts'
import { Hono } from 'hono'
import { z } from 'zod'

import { createLocalLlmAdapter } from './adapters'
import {
  LocalTaxAnalysisOutputJsonSchema,
  omitNullOutputFields,
} from './analysis-output-schema'
import { silentLocalDaemonLogger } from './logger'

import type { LocalLlmAdapter } from './adapters'
import type { LocalLibrary } from './library'
import type { LocalDaemonLogger } from './logger'
import type { UseCaseError } from '@bill-lm/application'
import type { LocalConnection } from '@bill-lm/contracts'
import type { Result } from '@bill-lm/domain'
import type { Context } from 'hono'

const AnalyzeLocalInvoiceSchema = LocalCollectionAnalysisInputSchema
const AnalyzeLocalCollectionSchema = LocalCollectionBatchAnalysisInputSchema

type LocalConnectionProbe = (
  input: LocalConnection,
) =>
  | Promise<{ ok: boolean; message?: string; cause?: string }>
  | { ok: boolean; message?: string; cause?: string }

const unavailableProbe: LocalConnectionProbe = () => ({
  ok: false,
  message: 'El adaptador GPU local todavía no está disponible.',
})

const IdSchema = z.string().uuid()

const modelOutputFields = new Set([
  'purpose',
  'classification',
  'reasoning',
  'uncertainties',
  'missingEvidence',
  'creditablePercentage',
  'potentialEligibleAmount',
  'relatedActivityRevisionIds',
])

const modelOutputIssueCodes = new Set([
  'custom',
  'invalid_element',
  'invalid_format',
  'invalid_key',
  'invalid_type',
  'invalid_union',
  'invalid_value',
  'not_multiple_of',
  'too_big',
  'too_small',
  'unrecognized_keys',
])

/**
 * Keeps model output out of logs while identifying the contract rule that
 * rejected it. Paths are reduced to known top-level fields plus array depth.
 */
function safeModelOutputIssuePath(path: readonly PropertyKey[]) {
  const root = path[0]
  const field =
    typeof root === 'string' && modelOutputFields.has(root) ? root : '$root'
  const nested = path
    .slice(1)
    .map((segment) => (typeof segment === 'number' ? '[]' : '.field'))
    .join('')
  return `${field}${nested}`
}

function safeModelOutputIssueCode(code: string) {
  return modelOutputIssueCodes.has(code) ? code : 'other'
}

function modelOutputValidationDiagnostics(error: z.ZodError) {
  const issues = error.issues.slice(0, 3)
  return {
    schemaIssuePaths: issues
      .map((issue) => safeModelOutputIssuePath(issue.path))
      .join('|'),
    schemaIssueCodes: issues
      .map((issue) => safeModelOutputIssueCode(issue.code))
      .join('|'),
  }
}

function mutationResponse<Value extends { readonly createdAt: string }>(
  context: Context,
  result: Result<Value, UseCaseError>,
  notFoundCode: string,
) {
  if (result.ok) return context.json(result.value, 201)
  if (result.error.code === 'resource.not_found')
    return context.json({ code: notFoundCode }, 404)
  if (
    result.error.code === 'activity_revision.invalid' ||
    result.error.code === 'activity_revision.duplicate'
  )
    return context.json({ code: 'INVALID_ACTIVITY_REVISION' }, 400)
  if (result.error.code === 'repository.failure')
    return context.json({ code: 'PROFILE_ACTIVITY_STORAGE_FAILURE' }, 500)
  return context.json({ code: 'INVALID_PROFILE_ACTIVITY' }, 400)
}

async function requestJson(context: Context): Promise<unknown> {
  try {
    return await context.req.json()
  } catch {
    return undefined
  }
}

function contractJson<Output>(
  context: Context,
  schema: z.ZodType<Output>,
  value: unknown,
  status: 200 | 201 = 200,
) {
  return context.json(schema.parse(JSON.parse(JSON.stringify(value))), status)
}

function adapterHttpStatus(message: string, cause: string) {
  if (cause !== 'http') return undefined
  const status = /\b([1-5]\d\d)\b/.exec(message)?.[1]
  return status ? Number(status) : undefined
}

function adapterProtocolReason(message: string, cause: string) {
  if (cause !== 'protocol') return undefined
  if (message.includes('OpenAI-like no incluye choices'))
    return 'openai-missing-choices'
  if (message.includes('OpenAI-like no incluye contenido'))
    return 'openai-missing-content'
  if (message.includes('Claude-like no incluye content'))
    return 'claude-missing-content-array'
  if (message.includes('Claude-like no incluye contenido'))
    return 'claude-missing-text'
  if (message.includes('no contiene JSON válido')) return 'model-json-invalid'
  return 'protocol-response-invalid'
}

function localAnalysisContextBlock(executionContext: {
  collectionContext: unknown
  taxpayerProfile: unknown
  activities: unknown[]
}) {
  const context = executionContext.collectionContext as {
    purpose?: 'vat_credit' | 'business_income_tax' | 'personal_expenses'
  } | null
  if (!context)
    return {
      code: 'MISSING_COLLECTION_CONTEXT',
      message:
        'Configura el propósito, período y perfil de la colección antes de analizar.',
    }

  const profile = executionContext.taxpayerProfile as {
    hasRuc?: boolean
    taxRegime?: string
    vatFilingFrequency?: string
  } | null
  if (!profile)
    return {
      code: 'MISSING_TAXPAYER_PROFILE',
      message:
        'Configura un perfil tributario válido para la colección antes de analizar.',
    }

  const requiresActivities =
    context.purpose === 'vat_credit' ||
    context.purpose === 'business_income_tax'
  if (requiresActivities && !profile.hasRuc)
    return {
      code: 'MISSING_TAXPAYER_PROFILE',
      message: 'Este propósito requiere un perfil con RUC.',
    }
  if (requiresActivities && executionContext.activities.length === 0)
    return {
      code: 'MISSING_ECONOMIC_ACTIVITY',
      message: 'Selecciona al menos una actividad económica antes de analizar.',
    }
  if (
    context.purpose === 'personal_expenses' &&
    executionContext.activities.length > 0
  )
    return {
      code: 'UNRESOLVED_ANALYSIS_CONFIGURATION',
      message: 'Los gastos personales no usan actividades económicas.',
    }
  if (context.purpose === 'vat_credit' && profile.taxRegime === 'unknown')
    return {
      code: 'UNRESOLVED_TAX_REGIME',
      message: 'Resuelve el régimen tributario antes de analizar IVA.',
    }
  if (
    context.purpose === 'vat_credit' &&
    profile.vatFilingFrequency === 'unknown'
  )
    return {
      code: 'UNRESOLVED_VAT_FREQUENCY',
      message: 'Resuelve la periodicidad de IVA antes de analizar.',
    }
  return null
}

export function createLocalDaemon(
  library: LocalLibrary,
  probeConnection: LocalConnectionProbe = unavailableProbe,
  adapterFactory: (
    connection: LocalConnection,
  ) => LocalLlmAdapter = createLocalLlmAdapter,
  logger: LocalDaemonLogger = silentLocalDaemonLogger,
) {
  const app = new Hono().basePath('/api/v1')
  const profileActivities = createProfileActivityUseCases({
    repository: library.profileActivities(),
    clock: { now: () => new Date() },
    ids: { next: () => crypto.randomUUID() },
  })
  const collectionContexts = createCollectionContextUseCases({
    repository: library.collectionContexts(),
    clock: { now: () => new Date() },
    ids: { next: () => crypto.randomUUID() },
  })

  app.get('/activities', async (c) => {
    const result = await profileActivities.listActivities(library.actorScope())
    return result.ok
      ? c.json({ items: result.value })
      : c.json({ code: 'PROFILE_ACTIVITY_STORAGE_FAILURE' }, 500)
  })
  app.post('/activities', async (c) => {
    const parsed = EconomicActivityRevisionInputSchema.safeParse(
      await requestJson(c),
    )
    if (!parsed.success)
      return c.json(
        { code: 'INVALID_ACTIVITY', issues: parsed.error.flatten() },
        400,
      )
    return mutationResponse(
      c,
      await profileActivities.createActivity(library.actorScope(), parsed.data),
      'ACTIVITY_NOT_FOUND',
    )
  })
  app.post('/activities/:id/revisions', async (c) => {
    const activityId = IdSchema.safeParse(c.req.param('id'))
    const parsed = EconomicActivityRevisionInputSchema.safeParse(
      await requestJson(c),
    )
    if (!activityId.success || !parsed.success)
      return c.json(
        {
          code: 'INVALID_ACTIVITY',
          ...(parsed.success ? {} : { issues: parsed.error.flatten() }),
        },
        400,
      )
    return mutationResponse(
      c,
      await profileActivities.reviseActivity(
        library.actorScope(),
        activityId.data,
        parsed.data,
      ),
      'ACTIVITY_NOT_FOUND',
    )
  })
  app.get('/profiles', async (c) => {
    const result = await profileActivities.listProfiles(library.actorScope())
    return result.ok
      ? c.json({ items: result.value })
      : c.json({ code: 'PROFILE_ACTIVITY_STORAGE_FAILURE' }, 500)
  })
  app.post('/profiles', async (c) => {
    const parsed = TaxpayerProfileRevisionInputSchema.safeParse(
      await requestJson(c),
    )
    if (!parsed.success)
      return c.json(
        { code: 'INVALID_PROFILE', issues: parsed.error.flatten() },
        400,
      )
    return mutationResponse(
      c,
      await profileActivities.createProfile(library.actorScope(), parsed.data),
      'PROFILE_NOT_FOUND',
    )
  })
  app.post('/profiles/:id/revisions', async (c) => {
    const profileId = IdSchema.safeParse(c.req.param('id'))
    const parsed = TaxpayerProfileRevisionInputSchema.safeParse(
      await requestJson(c),
    )
    if (!profileId.success || !parsed.success)
      return c.json(
        {
          code: 'INVALID_PROFILE',
          ...(parsed.success ? {} : { issues: parsed.error.flatten() }),
        },
        400,
      )
    return mutationResponse(
      c,
      await profileActivities.reviseProfile(
        library.actorScope(),
        profileId.data,
        parsed.data,
      ),
      'PROFILE_NOT_FOUND',
    )
  })
  app.get('/collections', async (c) => {
    const result = await collectionContexts.listCollectionContexts(
      library.actorScope(),
    )
    if (!result.ok) return c.json({ code: 'COLLECTION_STORAGE_FAILURE' }, 500)
    const metadata = new Map(
      library.listCollectionMetadata().map((item) => [item.id, item]),
    )
    return c.json({
      items: result.value.map((collection) =>
        LocalCollectionSummarySchema.parse({
          ...collection,
          ...metadata.get(collection.id),
        }),
      ),
    })
  })
  app.post('/collections', async (c) => {
    const input = CreateLocalCollectionInputSchema.safeParse(
      (await requestJson(c)) ?? {
        name: 'Colección local',
        year: new Date().getFullYear(),
      },
    )
    if (!input.success)
      return c.json(
        { code: 'INVALID_COLLECTION', issues: input.error.flatten() },
        400,
      )
    const result = await collectionContexts.createCollectionContext(
      library.actorScope(),
    )
    if (!result.ok) return c.json({ code: 'COLLECTION_STORAGE_FAILURE' }, 500)
    library.setCollectionMetadata(result.value.id, {
      ...input.data,
      description: input.data.description ?? null,
    })
    return contractJson(
      c,
      LocalCollectionSummarySchema,
      {
        ...result.value,
        ...input.data,
        description: input.data.description ?? null,
        invoiceCount: 0,
      },
      201,
    )
  })
  app.post('/collections/:id/revisions', async (c) => {
    const collectionId = IdSchema.safeParse(c.req.param('id'))
    const parsed = CollectionContextRevisionInputSchema.safeParse(
      await requestJson(c),
    )
    if (!collectionId.success || !parsed.success)
      return c.json(
        {
          code: 'INVALID_COLLECTION_CONTEXT',
          ...(parsed.success ? {} : { issues: parsed.error.flatten() }),
        },
        400,
      )
    const result = await collectionContexts.createCollectionContextRevision(
      library.actorScope(),
      collectionId.data,
      parsed.data,
    )
    if (result.ok) return c.json(result.value, 201)
    if (result.error.code === 'resource.not_found')
      return c.json({ code: 'COLLECTION_NOT_FOUND' }, 404)
    if (result.error.code === 'repository.failure')
      return c.json({ code: 'COLLECTION_STORAGE_FAILURE' }, 500)
    return c.json({ code: 'INVALID_COLLECTION_CONTEXT' }, 400)
  })
  app.get('/collections/:id', async (c) => {
    const collectionId = IdSchema.safeParse(c.req.param('id'))
    if (!collectionId.success)
      return c.json({ code: 'COLLECTION_NOT_FOUND' }, 404)
    const collection = await library
      .collectionContexts()
      .findCollectionContext(library.actorScope(), collectionId.data)
    if (!collection.ok) {
      return c.json(
        {
          code:
            collection.error.code === 'resource.not_found'
              ? 'COLLECTION_NOT_FOUND'
              : 'COLLECTION_STORAGE_FAILURE',
        },
        collection.error.code === 'resource.not_found' ? 404 : 500,
      )
    }
    const metadata = library.getCollectionMetadata(collectionId.data)
    if (!metadata) return c.json({ code: 'COLLECTION_NOT_FOUND' }, 404)
    return contractJson(c, LocalCollectionDetailSchema, {
      ...collection.value,
      ...metadata,
      invoices: library.listCollectionInvoices(collectionId.data),
      runs: library.listRuns({ collectionId: collectionId.data }),
    })
  })
  app.patch('/collections/:id', async (c) => {
    const collectionId = IdSchema.safeParse(c.req.param('id'))
    const parsed = UpdateLocalCollectionInputSchema.safeParse(
      await requestJson(c),
    )
    if (!collectionId.success || !parsed.success)
      return c.json(
        {
          code: 'INVALID_COLLECTION',
          ...(parsed.success ? {} : { issues: parsed.error.flatten() }),
        },
        400,
      )
    const updated = library.updateCollectionMetadata(
      collectionId.data,
      parsed.data,
    )
    if (!updated) return c.json({ code: 'COLLECTION_NOT_FOUND' }, 404)
    const collection = await library
      .collectionContexts()
      .findCollectionContext(library.actorScope(), collectionId.data)
    if (!collection.ok)
      return c.json({ code: 'COLLECTION_STORAGE_FAILURE' }, 500)
    return contractJson(c, LocalCollectionSummarySchema, {
      ...updated,
      latestRevision: collection.value.latestRevision,
    })
  })
  app.get('/collections/:id/runs', (c) => {
    const collectionId = IdSchema.safeParse(c.req.param('id'))
    if (!collectionId.success || !library.hasCollection(collectionId.data))
      return c.json({ code: 'COLLECTION_NOT_FOUND' }, 404)
    return c.json({
      items: library.listRuns({ collectionId: collectionId.data }),
    })
  })
  app.get('/collections/:collectionId/runs/:runId', (c) => {
    const collectionId = IdSchema.safeParse(c.req.param('collectionId'))
    const runId = IdSchema.safeParse(c.req.param('runId'))
    if (!collectionId.success || !runId.success)
      return c.json({ code: 'RUN_NOT_FOUND' }, 404)
    const detail = library.getCollectionRunDetail(collectionId.data, runId.data)
    return detail
      ? contractJson(c, LocalRunDetailSchema, detail)
      : c.json({ code: 'RUN_NOT_FOUND' }, 404)
  })
  app.post('/collections/:id/invoices', async (c) => {
    const collectionId = IdSchema.safeParse(c.req.param('id'))
    const parsed = LocalCollectionInvoiceInputSchema.safeParse(
      await requestJson(c),
    )
    if (!collectionId.success || !parsed.success)
      return c.json(
        {
          code: 'INVALID_COLLECTION_INVOICE',
          ...(parsed.success ? {} : { issues: parsed.error.flatten() }),
        },
        400,
      )
    const result = library.attachInvoiceToCollection(
      collectionId.data,
      parsed.data.invoiceId,
    )
    if (result.kind === 'collection-not-found')
      return c.json({ code: 'COLLECTION_NOT_FOUND' }, 404)
    if (result.kind === 'invoice-not-found')
      return c.json({ code: 'INVOICE_NOT_FOUND' }, 404)
    return contractJson(
      c,
      LocalCollectionInvoiceMembershipSchema,
      result,
      result.kind === 'attached' ? 201 : 200,
    )
  })
  app.get('/collections/:collectionId/invoices/:invoiceId', (c) => {
    const collectionId = IdSchema.safeParse(c.req.param('collectionId'))
    const invoiceId = IdSchema.safeParse(c.req.param('invoiceId'))
    if (!collectionId.success || !invoiceId.success)
      return c.json({ code: 'INVOICE_NOT_FOUND' }, 404)
    const invoice = library.getCollectionInvoiceDetail(
      collectionId.data,
      invoiceId.data,
    )
    return invoice
      ? contractJson(c, LocalInvoiceDetailSchema, invoice)
      : c.json({ code: 'INVOICE_NOT_FOUND' }, 404)
  })
  app.delete('/collections/:id/invoices/:invoiceId', async (c) => {
    const collectionId = IdSchema.safeParse(c.req.param('id'))
    const invoiceId = IdSchema.safeParse(c.req.param('invoiceId'))
    if (!collectionId.success || !invoiceId.success)
      return c.json({ code: 'INVALID_COLLECTION_INVOICE' }, 400)
    const result = library.detachInvoiceFromCollection(
      collectionId.data,
      invoiceId.data,
    )
    if (result.kind === 'collection-not-found')
      return c.json({ code: 'COLLECTION_NOT_FOUND' }, 404)
    if (result.kind === 'membership-not-found')
      return c.json({ code: 'COLLECTION_INVOICE_NOT_FOUND' }, 404)
    return contractJson(c, LocalCollectionInvoiceMembershipSchema, result)
  })
  app.post('/collections/:id/invoices/xml', async (c) => {
    const collectionId = IdSchema.safeParse(c.req.param('id'))
    const body = (await requestJson(c)) as
      | { fileName?: unknown; xml?: unknown }
      | undefined
    if (
      !collectionId.success ||
      typeof body?.fileName !== 'string' ||
      typeof body.xml !== 'string'
    )
      return c.json(
        {
          code: 'INVALID_XML_IMPORT',
          message: 'Envía un nombre y contenido XML.',
        },
        400,
      )
    if (!library.hasCollection(collectionId.data))
      return c.json({ code: 'COLLECTION_NOT_FOUND' }, 404)
    const imported = library.importXml(
      body.fileName,
      new TextEncoder().encode(body.xml),
    )
    if (imported.kind === 'invalid-xml') return c.json(imported, 400)
    const membership = library.attachInvoiceToCollection(
      collectionId.data,
      imported.invoiceId,
    )
    return c.json(
      {
        ...imported,
        membership: LocalCollectionInvoiceMembershipSchema.parse(membership),
      },
      membership.kind === 'attached' ? 201 : 200,
    )
  })

  const publicConnection = ({
    secretRef: _secretRef,
    ...connection
  }: LocalConnection) => connection
  app.get('/connections', (c) =>
    c.json({
      items: library
        .listConnections()
        .map((connection) =>
          LocalConnectionResponseSchema.parse(
            JSON.parse(JSON.stringify(publicConnection(connection))),
          ),
        ),
    }),
  )
  app.get('/rulesets', (c) => c.json({ items: library.listRulesets() }))
  app.get('/official-sources', (c) => {
    try {
      return c.json({ items: library.listOfficialSources() })
    } catch {
      return c.json({ code: 'LOCAL_RULESET_UNAVAILABLE' }, 500)
    }
  })
  app.get('/official-sources/:id', (c) => {
    try {
      const source = library.getOfficialSource(c.req.param('id'))
      return source
        ? c.json(source)
        : c.json({ code: 'OFFICIAL_SOURCE_NOT_FOUND' }, 404)
    } catch {
      return c.json({ code: 'LOCAL_RULESET_UNAVAILABLE' }, 500)
    }
  })
  app.get('/library/summary', (c) => {
    try {
      return c.json(library.getLibrarySummary())
    } catch {
      return c.json({ code: 'LOCAL_RULESET_UNAVAILABLE' }, 500)
    }
  })
  app.post('/connections', async (c) => {
    const parsed = CreateLocalConnectionSchema.safeParse(await c.req.json())
    if (!parsed.success)
      return c.json(
        { code: 'INVALID_CONNECTION', issues: parsed.error.flatten() },
        400,
      )
    return c.json(
      LocalConnectionResponseSchema.parse(
        JSON.parse(
          JSON.stringify(
            publicConnection(library.createConnection(parsed.data)),
          ),
        ),
      ),
      201,
    )
  })
  app.post('/connections/:id/probe', async (c) => {
    const connection = library.getConnection(c.req.param('id'))
    if (!connection) return c.json({ code: 'CONNECTION_NOT_FOUND' }, 404)
    const probe = await probeConnection(connection)
    if (!library.recordProbe(connection.id, probe, connection))
      return c.json(
        {
          code: 'CONNECTION_CHANGED',
          message: 'La conexión cambió durante la prueba. Vuelve a intentarlo.',
        },
        409,
      )
    return c.json(probe, probe.ok ? 200 : 422)
  })
  app.patch('/connections/:id', async (c) => {
    const parsed = UpdateLocalConnectionSchema.safeParse(await requestJson(c))
    if (!parsed.success)
      return c.json(
        { code: 'INVALID_CONNECTION', issues: parsed.error.flatten() },
        400,
      )
    const connection = library.updateConnection(c.req.param('id'), parsed.data)
    return connection
      ? c.json(
          LocalConnectionResponseSchema.parse(
            JSON.parse(JSON.stringify(publicConnection(connection))),
          ),
        )
      : c.json({ code: 'CONNECTION_NOT_FOUND' }, 404)
  })
  app.delete('/connections/:id', (c) => {
    const result = library.deleteConnection(c.req.param('id'))
    if (result.kind === 'not-found')
      return c.json({ code: 'CONNECTION_NOT_FOUND' }, 404)
    if (result.kind === 'active-runs')
      return c.json({ code: 'CONNECTION_HAS_ACTIVE_RUNS' }, 409)
    return c.body(null, 204)
  })
  app.post('/invoices/xml', async (c) => {
    const body = await c.req.json<{ fileName?: unknown; xml?: unknown }>()
    if (typeof body.fileName !== 'string' || typeof body.xml !== 'string')
      return c.json(
        {
          code: 'INVALID_XML_IMPORT',
          message: 'Envía un nombre y contenido XML.',
        },
        400,
      )
    const result = library.importXml(
      body.fileName,
      new TextEncoder().encode(body.xml),
    )
    return c.json(
      result,
      result.kind === 'invalid-xml'
        ? 400
        : result.kind === 'duplicate'
          ? 200
          : 201,
    )
  })
  app.get('/invoices', (c) => c.json({ items: library.listInvoices() }))
  app.get('/collections/:id/analysis', (c) => {
    const collectionId = IdSchema.safeParse(c.req.param('id'))
    if (!collectionId.success)
      return c.json({ code: 'COLLECTION_NOT_FOUND' }, 404)
    const batch = library.getActiveAnalysisBatch(collectionId.data)
    return c.json(
      batch ? LocalCollectionBatchAnalysisProgressSchema.parse(batch) : null,
    )
  })
  app.post('/collections/:id/analysis', async (c) => {
    const body = await requestJson(c)
    const parsed = AnalyzeLocalCollectionSchema.safeParse({
      ...(body && typeof body === 'object' ? body : {}),
      collectionId: c.req.param('id'),
    })
    if (!parsed.success) {
      logger.warn('analysis.collection.rejected', { reason: 'invalid-input' })
      return c.json(
        { code: 'INVALID_ANALYSIS', issues: parsed.error.flatten() },
        400,
      )
    }
    if (!library.hasCollection(parsed.data.collectionId)) {
      logger.warn('analysis.collection.rejected', {
        reason: 'collection-not-found',
        collectionId: parsed.data.collectionId,
      })
      return c.json({ code: 'COLLECTION_NOT_FOUND' }, 404)
    }

    const invoices = library.listCollectionInvoices(parsed.data.collectionId)
    if (invoices.length === 0) {
      logger.warn('analysis.collection.rejected', {
        reason: 'collection-without-invoices',
        collectionId: parsed.data.collectionId,
      })
      return c.json({ code: 'COLLECTION_WITHOUT_INVOICES' }, 409)
    }
    const contextBlock = localAnalysisContextBlock(
      library.getExecutionContext(parsed.data.collectionId),
    )
    if (contextBlock) {
      logger.warn('analysis.collection.rejected', {
        reason: contextBlock.code.toLowerCase(),
        collectionId: parsed.data.collectionId,
      })
      return c.json(contextBlock, 409)
    }
    if (
      resolveLocalAnalysisAvailability(
        library.listConnections(),
        parsed.data.connectionId,
      ).kind === 'oauth-guidance'
    ) {
      logger.warn('analysis.collection.rejected', {
        reason: 'connection-unavailable',
        connectionId: parsed.data.connectionId,
      })
      return c.json(resolveLocalAnalysisAvailability([]), 409)
    }

    const batch = library.createAnalysisBatch({
      collectionId: parsed.data.collectionId,
      connectionId: parsed.data.connectionId,
      invoiceCount: invoices.length,
    })
    logger.info('analysis.collection.queued', {
      batchId: batch.id,
      collectionId: parsed.data.collectionId,
      connectionId: parsed.data.connectionId,
      invoiceCount: invoices.length,
    })
    void (async () => {
      library.startAnalysisBatch(batch.id)
      for (const invoice of invoices) {
        try {
          const response = await app.request('/api/v1/analysis', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-local-analysis-batch-id': batch.id,
            },
            body: JSON.stringify({
              collectionId: parsed.data.collectionId,
              connectionId: parsed.data.connectionId,
              invoiceId: invoice.id,
            }),
          })
          if (!response.ok) {
            logger.warn('analysis.collection.invoice-rejected', {
              batchId: batch.id,
              collectionId: parsed.data.collectionId,
              invoiceId: invoice.id,
              status: response.status,
            })
            continue
          }
          const run = (await response.json()) as { id: string }
          while (true) {
            const status = library.getRunDetail(run.id)?.status
            if (
              status === 'completed' ||
              status === 'failed' ||
              status === 'blocked' ||
              !status
            )
              break
            await Bun.sleep(250)
          }
        } finally {
          library.finishAnalysisBatchInvoice(batch.id)
        }
      }
      logger.info('analysis.collection.completed', {
        batchId: batch.id,
        collectionId: parsed.data.collectionId,
        invoiceCount: invoices.length,
      })
    })().catch(() => {
      logger.error('analysis.collection.unexpected-failure', {
        batchId: batch.id,
        collectionId: parsed.data.collectionId,
      })
    })
    return c.json(
      LocalCollectionBatchAnalysisResponseSchema.parse({
        batchId: batch.id,
        status: 'queued',
        invoiceCount: invoices.length,
        queuedAt: batch.queuedAt,
      }),
      202,
    )
  })
  app.post('/analysis', async (c) => {
    const parsed = AnalyzeLocalInvoiceSchema.safeParse(await c.req.json())
    if (!parsed.success) {
      logger.warn('analysis.request.rejected', { reason: 'invalid-input' })
      return c.json(
        { code: 'INVALID_ANALYSIS', issues: parsed.error.flatten() },
        400,
      )
    }
    const batchId = c.req.header('x-local-analysis-batch-id')
    const parsedBatchId = batchId ? IdSchema.safeParse(batchId) : null
    if (batchId && !parsedBatchId?.success)
      return c.json({ code: 'INVALID_ANALYSIS_BATCH' }, 400)
    logger.info('analysis.request.received', {
      collectionId: parsed.data.collectionId,
      invoiceId: parsed.data.invoiceId,
      connectionId: parsed.data.connectionId,
    })
    logger.debug('analysis.request.validated', {
      collectionId: parsed.data.collectionId,
      invoiceId: parsed.data.invoiceId,
      connectionId: parsed.data.connectionId,
    })
    if (!library.hasInvoice(parsed.data.invoiceId)) {
      logger.warn('analysis.request.rejected', {
        reason: 'invoice-not-found',
        invoiceId: parsed.data.invoiceId,
      })
      return c.json({ code: 'INVOICE_NOT_FOUND' }, 404)
    }
    if (!library.hasCollection(parsed.data.collectionId)) {
      logger.warn('analysis.request.rejected', {
        reason: 'collection-not-found',
        collectionId: parsed.data.collectionId,
      })
      return c.json({ code: 'COLLECTION_NOT_FOUND' }, 404)
    }
    if (
      !library.hasCollectionInvoice(
        parsed.data.collectionId,
        parsed.data.invoiceId,
      )
    ) {
      logger.warn('analysis.request.rejected', {
        reason: 'invoice-not-in-collection',
        collectionId: parsed.data.collectionId,
        invoiceId: parsed.data.invoiceId,
      })
      return c.json({ code: 'INVOICE_NOT_IN_COLLECTION' }, 409)
    }

    const executionContext = library.getExecutionContext(
      parsed.data.collectionId,
    )
    const contextBlock = localAnalysisContextBlock(executionContext)
    if (contextBlock) {
      logger.warn('analysis.request.rejected', {
        reason: contextBlock.code.toLowerCase(),
        collectionId: parsed.data.collectionId,
      })
      return c.json(contextBlock, 409)
    }
    const analysisPurpose = (
      executionContext.collectionContext as {
        purpose: 'vat_credit' | 'business_income_tax' | 'personal_expenses'
      }
    ).purpose

    const availability = resolveLocalAnalysisAvailability(
      library.listConnections(),
      parsed.data.connectionId,
    )
    if (availability.kind === 'oauth-guidance') {
      logger.warn('analysis.request.rejected', {
        reason: 'connection-unavailable',
        connectionId: parsed.data.connectionId,
      })
      return c.json(availability, 409)
    }

    const connection = library.getConnection(availability.connectionId)!
    logger.info('analysis.connection.probing', {
      connectionId: connection.id,
      apiFlavor: connection.apiFlavor,
      model: connection.model,
    })
    const probe = await probeConnection(connection)
    if (!library.recordProbe(connection.id, probe, connection))
      return c.json(
        {
          code: 'CONNECTION_CHANGED',
          message: 'La conexión cambió durante la prueba. Vuelve a intentarlo.',
        },
        409,
      )
    if (!probe.ok) {
      logger.error('analysis.connection.probe-failed', {
        connectionId: connection.id,
        cause: probe.cause ?? 'protocol',
      })
      return c.json(
        {
          code: 'GPU_PROBE_FAILED',
          message: probe.message ?? 'La prueba de GPU local falló.',
          cause: probe.cause ?? 'protocol',
          oauthGuidance: resolveLocalAnalysisAvailability([]),
        },
        422,
      )
    }
    logger.info('analysis.connection.probe-succeeded', {
      connectionId: connection.id,
      apiFlavor: connection.apiFlavor,
      model: connection.model,
    })

    const ruleset = library.listRulesets()[0]
    const snapshot = {
      invoice: library.getInvoiceSnapshot(parsed.data.invoiceId),
      fileName: library.getInvoiceFileName(parsed.data.invoiceId),
      collectionName:
        library.getCollectionMetadata(parsed.data.collectionId)?.name ?? null,
      ...executionContext,
      connection: publicConnection(connection),
      ruleset: {
        id: ruleset.id,
        version: ruleset.version,
        jurisdiction: ruleset.jurisdiction,
      },
    }
    const run = library.createRun({
      invoiceId: parsed.data.invoiceId,
      collectionId: parsed.data.collectionId,
      batchId: parsedBatchId?.success ? parsedBatchId.data : undefined,
      connectionId: connection.id,
      rulesetId: ruleset.id,
      snapshot,
    })
    logger.info('analysis.run.queued', {
      runId: run.id,
      collectionId: parsed.data.collectionId,
      invoiceId: parsed.data.invoiceId,
      connectionId: connection.id,
      model: connection.model,
      rulesetId: ruleset.id,
    })
    void (async () => {
      const startedAt = Date.now()
      library.startRun(run.id)
      logger.info('analysis.run.started', {
        runId: run.id,
        connectionId: connection.id,
        apiFlavor: connection.apiFlavor,
        model: connection.model,
      })
      const adapter = adapterFactory(connection)
      logger.debug('analysis.run.dispatching', {
        runId: run.id,
        connectionId: connection.id,
        apiFlavor: connection.apiFlavor,
        model: connection.model,
      })
      const result = await adapter.analyze({
        connection,
        runId: run.id,
        prompt: `Analiza la factura ecuatoriana usando exclusivamente este snapshot local. Puedes realizar razonamiento interno en el idioma que prefieras. Sin embargo, redacta en español todos los valores textuales visibles del JSON de salida, incluidos reasoning, uncertainties, missingEvidence y cualquier categoría o descripción textual. Conserva sin traducir los identificadores técnicos, enums, UUID y valores numéricos. Devuelve solamente JSON válido que cumpla el esquema tributario solicitado.\n${JSON.stringify(snapshot)}`,
        outputSchema: LocalTaxAnalysisOutputJsonSchema,
        purpose: analysisPurpose,
      })
      if (!result.ok) {
        logger.error('analysis.run.failed', {
          runId: run.id,
          cause: result.cause,
          httpStatus: adapterHttpStatus(result.message, result.cause),
          protocolReason: adapterProtocolReason(result.message, result.cause),
          responseVariant: result.responseVariant,
          contentKind: result.contentKind,
          contentBytes: result.contentBytes,
          jsonParseReason: result.jsonParseReason,
          finishReason: result.finishReason,
          agentsErrorKind: result.agentsErrorKind,
          agentsTimeoutMs: result.agentsTimeoutMs,
          durationMs: Date.now() - startedAt,
        })
        return library.failRun(run.id, result.message)
      }
      logger.debug('analysis.run.response-received', {
        runId: run.id,
        durationMs: Date.now() - startedAt,
      })
      const payload = ModelTaxAnalysisPayloadSchema.safeParse(
        omitNullOutputFields(result.payload),
      )
      if (!payload.success) {
        logger.error('analysis.run.invalid-output', {
          runId: run.id,
          issueCount: payload.error.issues.length,
          ...modelOutputValidationDiagnostics(payload.error),
          durationMs: Date.now() - startedAt,
        })
        return library.failRun(
          run.id,
          'El análisis local devolvió una salida inválida.',
        )
      }
      library.completeRun({
        runId: run.id,
        invoiceId: parsed.data.invoiceId,
        payload: payload.data,
      })
      logger.info('analysis.run.completed', {
        runId: run.id,
        durationMs: Date.now() - startedAt,
        classification: payload.data.classification,
        purpose: payload.data.purpose,
      })
    })().catch(() => {
      logger.error('analysis.run.unexpected-failure', { runId: run.id })
      library.failRun(run.id, 'El análisis local terminó de forma inesperada.')
    })
    return c.json({ ...run, status: 'queued' }, 202)
  })
  app.get('/runs/:id/events', (c) =>
    c.json({
      items: library.listRunEvents(c.req.param('id'), c.req.query('after')),
    }),
  )
  app.get('/runs', (c) => {
    const unread = c.req.query('unread')
    const parsed = LocalRunListFilterSchema.safeParse({
      collectionId: c.req.query('collectionId'),
      status: c.req.query('status'),
      ...(unread === undefined
        ? {}
        : {
            unread:
              unread === 'true' ? true : unread === 'false' ? false : unread,
          }),
    })
    if (!parsed.success)
      return c.json(
        { code: 'INVALID_RUN_FILTER', issues: parsed.error.flatten() },
        400,
      )
    return contractJson(
      c,
      z.object({ items: z.array(LocalRunSummarySchema) }),
      { items: library.listRuns(parsed.data) },
    )
  })
  app.get('/runs/:id', (c) => {
    const detail = library.getRunDetail(c.req.param('id'))
    return detail
      ? contractJson(c, LocalRunDetailSchema, detail)
      : c.json({ code: 'RUN_NOT_FOUND' }, 404)
  })
  app.patch('/runs/:id/read', (c) => {
    const result = library.markRunRead(c.req.param('id'))
    return result.found
      ? c.json({ changed: result.changed })
      : c.json({ code: 'RUN_NOT_FOUND' }, 404)
  })
  app.patch('/runs/read-all', (c) =>
    c.json({ changed: library.markAllRunsRead() }),
  )
  app.post('/runs/clear-eligible', (c) =>
    c.json({ changed: library.clearEligibleRuns() }),
  )
  app.get('/runs/:id/result', (c) => {
    const result = library.getRunResult(c.req.param('id'))
    return result ? c.json(result) : c.json({ code: 'RESULT_NOT_FOUND' }, 404)
  })
  return app
}
