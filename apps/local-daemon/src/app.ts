import {
  createCollectionContextUseCases,
  createProfileActivityUseCases,
} from '@bill-lm/application'
import type { UseCaseError } from '@bill-lm/application'
import type { Result } from '@bill-lm/domain'
import {
  CollectionContextRevisionInputSchema,
  CreateLocalConnectionSchema,
  EconomicActivityRevisionInputSchema,
  ModelTaxAnalysisPayloadSchema,
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

const AnalyzeLocalInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  connectionId: z.string().uuid().optional(),
})

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
    return result.ok
      ? c.json({ items: result.value })
      : c.json({ code: 'COLLECTION_STORAGE_FAILURE' }, 500)
  })
  app.post('/collections', async (c) => {
    const result = await collectionContexts.createCollectionContext(
      library.actorScope(),
    )
    return result.ok
      ? c.json(result.value, 201)
      : c.json({ code: 'COLLECTION_STORAGE_FAILURE' }, 500)
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

  app.get('/connections', (c) => c.json({ items: library.listConnections() }))
  app.get('/rulesets', (c) => c.json({ items: library.listRulesets() }))
  app.post('/connections', async (c) => {
    const parsed = CreateLocalConnectionSchema.safeParse(await c.req.json())
    if (!parsed.success)
      return c.json(
        { code: 'INVALID_CONNECTION', issues: parsed.error.flatten() },
        400,
      )
    return c.json(library.createConnection(parsed.data), 201)
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
