import {
  createCollectionContextUseCases,
  createProfileActivityUseCases,
} from '@bill-lm/application'
import type { UseCaseError } from '@bill-lm/application'
import type { Result } from '@bill-lm/domain'
import {
  CollectionContextRevisionInputSchema,
  CreateLocalCollectionInputSchema,
  CreateLocalConnectionSchema,
  EconomicActivityRevisionInputSchema,
  LocalCollectionDetailSchema,
  LocalCollectionRunDetailSchema,
  LocalCollectionSummarySchema,
  LocalConnectionResponseSchema,
  ModelTaxAnalysisPayloadSchema,
  LocalCollectionAnalysisInputSchema,
  LocalCollectionInvoiceInputSchema,
  LocalCollectionInvoiceMembershipSchema,
  TaxpayerProfileRevisionInputSchema,
  resolveLocalAnalysisAvailability,
} from '@bill-lm/contracts'
import type { LocalConnection } from '@bill-lm/contracts'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'

import { createLocalLlmAdapter } from './adapters'
import type { LocalLlmAdapter } from './adapters'
import type { LocalLibrary } from './library'

const AnalyzeLocalInvoiceSchema = LocalCollectionAnalysisInputSchema

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

export function createLocalDaemon(
  library: LocalLibrary,
  probeConnection: LocalConnectionProbe = unavailableProbe,
  adapterFactory: (connection: LocalConnection) => LocalLlmAdapter = createLocalLlmAdapter,
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
    const parsed = EconomicActivityRevisionInputSchema.safeParse(await requestJson(c))
    if (!parsed.success)
      return c.json({ code: 'INVALID_ACTIVITY', issues: parsed.error.flatten() }, 400)
    return mutationResponse(
      c,
      await profileActivities.createActivity(library.actorScope(), parsed.data),
      'ACTIVITY_NOT_FOUND',
    )
  })
  app.post('/activities/:id/revisions', async (c) => {
    const activityId = IdSchema.safeParse(c.req.param('id'))
    const parsed = EconomicActivityRevisionInputSchema.safeParse(await requestJson(c))
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
    const parsed = TaxpayerProfileRevisionInputSchema.safeParse(await requestJson(c))
    if (!parsed.success)
      return c.json({ code: 'INVALID_PROFILE', issues: parsed.error.flatten() }, 400)
    return mutationResponse(
      c,
      await profileActivities.createProfile(library.actorScope(), parsed.data),
      'PROFILE_NOT_FOUND',
    )
  })
  app.post('/profiles/:id/revisions', async (c) => {
    const profileId = IdSchema.safeParse(c.req.param('id'))
    const parsed = TaxpayerProfileRevisionInputSchema.safeParse(await requestJson(c))
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
    if (!result.ok)
      return c.json({ code: 'COLLECTION_STORAGE_FAILURE' }, 500)
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
      return c.json({ code: 'INVALID_COLLECTION', issues: input.error.flatten() }, 400)
    const result = await collectionContexts.createCollectionContext(
      library.actorScope(),
    )
    if (!result.ok)
      return c.json({ code: 'COLLECTION_STORAGE_FAILURE' }, 500)
    library.setCollectionMetadata(result.value.id, input.data)
    return contractJson(c, LocalCollectionSummarySchema, {
      ...result.value,
      ...input.data,
      invoiceCount: 0,
    }, 201)
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
    if (!collectionId.success) return c.json({ code: 'COLLECTION_NOT_FOUND' }, 404)
    const collection = await library
      .collectionContexts()
      .findCollectionContext(library.actorScope(), collectionId.data)
    if (!collection.ok) {
      return c.json(
        { code: collection.error.code === 'resource.not_found' ? 'COLLECTION_NOT_FOUND' : 'COLLECTION_STORAGE_FAILURE' },
        collection.error.code === 'resource.not_found' ? 404 : 500,
      )
    }
    return contractJson(c, LocalCollectionDetailSchema, {
      ...collection.value,
      invoices: library.listCollectionInvoices(collectionId.data),
      runs: library.listRuns(collectionId.data),
    })
  })
  app.get('/collections/:collectionId/runs/:runId', (c) => {
    const collectionId = IdSchema.safeParse(c.req.param('collectionId'))
    const runId = IdSchema.safeParse(c.req.param('runId'))
    if (!collectionId.success || !runId.success)
      return c.json({ code: 'RUN_NOT_FOUND' }, 404)
    const detail = library.getCollectionRunDetail(collectionId.data, runId.data)
    return detail
      ? contractJson(c, LocalCollectionRunDetailSchema, detail)
      : c.json({ code: 'RUN_NOT_FOUND' }, 404)
  })
  app.post('/collections/:id/invoices', async (c) => {
    const collectionId = IdSchema.safeParse(c.req.param('id'))
    const parsed = LocalCollectionInvoiceInputSchema.safeParse(await requestJson(c))
    if (!collectionId.success || !parsed.success)
      return c.json({ code: 'INVALID_COLLECTION_INVOICE', ...(parsed.success ? {} : { issues: parsed.error.flatten() }) }, 400)
    const result = library.attachInvoiceToCollection(collectionId.data, parsed.data.invoiceId)
    if (result.kind === 'collection-not-found') return c.json({ code: 'COLLECTION_NOT_FOUND' }, 404)
    if (result.kind === 'invoice-not-found') return c.json({ code: 'INVOICE_NOT_FOUND' }, 404)
    return contractJson(
      c,
      LocalCollectionInvoiceMembershipSchema,
      result,
      result.kind === 'attached' ? 201 : 200,
    )
  })
  app.delete('/collections/:id/invoices/:invoiceId', async (c) => {
    const collectionId = IdSchema.safeParse(c.req.param('id'))
    const invoiceId = IdSchema.safeParse(c.req.param('invoiceId'))
    if (!collectionId.success || !invoiceId.success)
      return c.json({ code: 'INVALID_COLLECTION_INVOICE' }, 400)
    const result = library.detachInvoiceFromCollection(collectionId.data, invoiceId.data)
    if (result.kind === 'collection-not-found') return c.json({ code: 'COLLECTION_NOT_FOUND' }, 404)
    if (result.kind === 'membership-not-found') return c.json({ code: 'COLLECTION_INVOICE_NOT_FOUND' }, 404)
    return contractJson(c, LocalCollectionInvoiceMembershipSchema, result)
  })
  app.post('/collections/:id/invoices/xml', async (c) => {
    const collectionId = IdSchema.safeParse(c.req.param('id'))
    const body = await requestJson(c) as { fileName?: unknown; xml?: unknown } | undefined
    if (!collectionId.success || typeof body?.fileName !== 'string' || typeof body.xml !== 'string')
      return c.json({ code: 'INVALID_XML_IMPORT', message: 'Envía un nombre y contenido XML.' }, 400)
    if (!library.hasCollection(collectionId.data)) return c.json({ code: 'COLLECTION_NOT_FOUND' }, 404)
    const imported = library.importXml(body.fileName, new TextEncoder().encode(body.xml))
    if (imported.kind === 'invalid-xml') return c.json(imported, 400)
    const membership = library.attachInvoiceToCollection(collectionId.data, imported.invoiceId)
    return c.json(
      {
        ...imported,
        membership: LocalCollectionInvoiceMembershipSchema.parse(membership),
      },
      membership.kind === 'attached' ? 201 : 200,
    )
  })

  const publicConnection = ({ secretRef: _secretRef, ...connection }: LocalConnection) => connection
  app.get('/connections', (c) => c.json({
    items: library.listConnections().map((connection) =>
      LocalConnectionResponseSchema.parse(JSON.parse(JSON.stringify(publicConnection(connection)))),
    ),
  }))
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
      LocalConnectionResponseSchema.parse(JSON.parse(JSON.stringify(publicConnection(library.createConnection(parsed.data))))),
      201,
    )
  })
  app.post('/connections/:id/probe', async (c) => {
    const connection = library.getConnection(c.req.param('id'))
    if (!connection) return c.json({ code: 'CONNECTION_NOT_FOUND' }, 404)
    const probe = await probeConnection(connection)
    library.recordProbe(connection.id, probe)
    return c.json(probe, probe.ok ? 200 : 422)
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
  app.post('/analysis', async (c) => {
    const parsed = AnalyzeLocalInvoiceSchema.safeParse(await c.req.json())
    if (!parsed.success)
      return c.json(
        { code: 'INVALID_ANALYSIS', issues: parsed.error.flatten() },
        400,
      )
    if (!library.hasInvoice(parsed.data.invoiceId))
      return c.json({ code: 'INVOICE_NOT_FOUND' }, 404)
    if (!library.hasCollection(parsed.data.collectionId))
      return c.json({ code: 'COLLECTION_NOT_FOUND' }, 404)
    if (!library.hasCollectionInvoice(parsed.data.collectionId, parsed.data.invoiceId))
      return c.json({ code: 'INVOICE_NOT_IN_COLLECTION' }, 409)

    const availability = resolveLocalAnalysisAvailability(
      library.listConnections(),
      parsed.data.connectionId,
    )
    if (availability.kind === 'oauth-guidance') return c.json(availability, 409)

    const connection = library.getConnection(availability.connectionId)!
    const probe = await probeConnection(connection)
    library.recordProbe(connection.id, probe)
    if (!probe.ok)
      return c.json(
        {
          code: 'GPU_PROBE_FAILED',
          message: probe.message ?? 'La prueba de GPU local falló.',
          cause: probe.cause ?? 'protocol',
          oauthGuidance: resolveLocalAnalysisAvailability([]),
        },
        422,
      )

    const ruleset = library.listRulesets()[0]
    const run = library.createRun({
      invoiceId: parsed.data.invoiceId,
      collectionId: parsed.data.collectionId,
      connectionId: connection.id,
      rulesetId: ruleset.id,
    })
    library.startRun(run.id)
    const adapter = adapterFactory(connection)
    const result = await adapter.analyze({
      connection,
      runId: run.id,
      prompt: 'Devuelve solamente JSON válido que cumpla el esquema de análisis tributario.',
      outputSchema: { type: 'object' },
    })
    if (!result.ok) {
      library.failRun(run.id, 'El análisis local no pudo completarse.')
      return c.json({ code: 'GPU_ANALYSIS_FAILED', cause: result.cause, oauthGuidance: resolveLocalAnalysisAvailability([]), runId: run.id }, 422)
    }
    const payload = ModelTaxAnalysisPayloadSchema.safeParse(result.payload)
    if (!payload.success) {
      library.failRun(run.id, 'El análisis local devolvió una salida inválida.')
      return c.json({ code: 'GPU_ANALYSIS_FAILED', cause: 'invalid-output', oauthGuidance: resolveLocalAnalysisAvailability([]), runId: run.id }, 422)
    }
    library.completeRun({ runId: run.id, invoiceId: parsed.data.invoiceId, payload: payload.data })
    return c.json({ ...run, status: 'completed' }, 201)
  })
  app.get('/runs/:id/events', (c) =>
    c.json({
      items: library.listRunEvents(c.req.param('id'), c.req.query('after')),
    }),
  )
  app.get('/runs', (c) => c.json({ items: library.listRuns() }))
  app.get('/runs/:id/result', (c) => {
    const result = library.getRunResult(c.req.param('id'))
    return result ? c.json(result) : c.json({ code: 'RESULT_NOT_FOUND' }, 404)
  })
  return app
}
