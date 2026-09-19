import { afterEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { LocalDaemonClient } from '../api'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

describe('LocalDaemonClient', () => {
  it('uses only its localhost Hono HTTP contract for profile, activity, and collection CRUD', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
      requests.push({ url: String(input), init })
      if (String(input).endsWith('/collections') && init?.method === 'POST')
        return Response.json({
          id: '00000000-0000-4000-8000-000000000001',
          name: 'Gastos personales',
          year: 2026,
          invoiceCount: 0,
          latestRevision: null,
        })
      return Response.json({ items: [], id: '00000000-0000-4000-8000-000000000001', latestRevision: null })
    }) as typeof fetch

    const client = new LocalDaemonClient('http://127.0.0.1:4318')
    await client.listActivities()
    await client.createActivity({ displayName: 'Servicios de software', registeredActivityName: 'Desarrollo de software', activityDescription: 'Desarrollo local.', revenueVatTreatment: 'taxed_nonzero' })
    await client.listProfiles()
    await client.createProfile({ displayName: 'Biblioteca local', hasEmploymentIncome: false, hasRuc: false, taxRegime: 'unknown', vatFilingFrequency: 'none', activityRevisionIds: [] })
    await client.listCollections()
    await client.createCollection({ name: 'Gastos personales', year: 2026 })

    expect(requests.map((request) => `${request.init?.method ?? 'GET'} ${request.url}`)).toEqual([
      'GET http://127.0.0.1:4318/api/v1/activities',
      'POST http://127.0.0.1:4318/api/v1/activities',
      'GET http://127.0.0.1:4318/api/v1/profiles',
      'POST http://127.0.0.1:4318/api/v1/profiles',
      'GET http://127.0.0.1:4318/api/v1/collections',
      'POST http://127.0.0.1:4318/api/v1/collections',
    ])
    expect(requests.at(-1)?.init?.body).toBe(
      JSON.stringify({ name: 'Gastos personales', year: 2026 }),
    )
  })

  it('defaults to same-origin requests and keeps viewer sources cloud-free', async () => {
    const sources = ['../api.ts', '../local-viewer.tsx', '../local-sections.tsx'].map((path) => readFileSync(join(import.meta.dir, path), 'utf8'))
    const requestedUrls: string[] = []
    globalThis.fetch = (async (input: URL | RequestInfo) => {
      requestedUrls.push(String(input))
      return Response.json({ items: [] })
    }) as typeof fetch

    await new LocalDaemonClient().listRulesets()
    expect(requestedUrls).toEqual(['/api/v1/rulesets'])
    expect(sources.join('\n')).not.toMatch(/(?:@\/integrations\/(?:firebase|prisma|trpc)|firebase\/|@prisma\/client|@trpc\/)/)
    expect(sources.join('\n')).not.toMatch(/https?:\/\/(?!127\.0\.0\.1|localhost)/)
  })

  it('parses collection detail only through the typed local Hono contract', async () => {
    const id = '00000000-0000-4000-8000-000000000001'
    globalThis.fetch = (async () => Response.json({
      id,
      latestRevision: null,
      invoices: [{ id, fileName: 'factura.xml', createdAt: '2026-09-18T20:00:00.000Z' }],
      runs: [{ id, invoiceId: id, collectionId: id, status: 'completed', createdAt: '2026-09-18T20:00:00.000Z' }],
    })) as unknown as typeof fetch

    await expect(new LocalDaemonClient().getCollectionDetail(id)).resolves.toMatchObject({
      id,
      invoices: [{ fileName: 'factura.xml' }],
      runs: [{ collectionId: id }],
    })
  })

  it('loads analysis detail from its collection-scoped local route', async () => {
    const collectionId = '00000000-0000-4000-8000-000000000001'
    const runId = '00000000-0000-4000-8000-000000000002'
    const requestedUrls: string[] = []
    globalThis.fetch = (async (input: URL | RequestInfo) => {
      requestedUrls.push(String(input))
      return Response.json({
        id: runId, invoiceId: collectionId, collectionId, status: 'failed', createdAt: '2026-09-18T20:00:00.000Z', events: [], result: null,
      })
    }) as typeof fetch

    await expect(new LocalDaemonClient('http://127.0.0.1:4318').getCollectionRunDetail(collectionId, runId)).resolves.toMatchObject({ id: runId, result: null })
    expect(requestedUrls).toEqual([`http://127.0.0.1:4318/api/v1/collections/${collectionId}/runs/${runId}`])
  })

  it('keeps collection-scoped XML imports and membership mutations on local Hono routes', async () => {
    const id = '00000000-0000-4000-8000-000000000001'
    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
      requests.push({ url: String(input), init })
      return Response.json(init?.method === 'DELETE' ? { kind: 'detached' } : { kind: 'attached' })
    }) as typeof fetch

    const client = new LocalDaemonClient('http://127.0.0.1:4318')
    await client.importCollectionXml(id, new File(['<factura/>'], 'factura.xml', { type: 'application/xml' }))
    await client.attachInvoice(id, id)
    await client.detachInvoice(id, id)
    expect(requests.map((request) => `${request.init?.method} ${request.url}`)).toEqual([
      `POST http://127.0.0.1:4318/api/v1/collections/${id}/invoices/xml`,
      `POST http://127.0.0.1:4318/api/v1/collections/${id}/invoices`,
      `DELETE http://127.0.0.1:4318/api/v1/collections/${id}/invoices/${id}`,
    ])
  })

  it('uses only local Hono routes for official-source snapshots and Biblioteca summary', async () => {
    const urls: string[] = []
    globalThis.fetch = (async (input: URL | RequestInfo) => {
      urls.push(String(input))
      if (String(input).endsWith('/library/summary'))
        return Response.json({ invoiceCount: 0, collectionCount: 0, profileCount: 0, activityCount: 0, runCount: 0, ruleset: null })
      if (String(input).includes('/official-sources/ec-sri-lrti'))
        return Response.json({ id: 'ec-sri-lrti', fragments: [], ruleset: { id: 'ec-sri-2026.3', version: '3', jurisdiction: 'EC', reviewStatus: 'local-snapshot' } })
      return Response.json({ items: [] })
    }) as typeof fetch

    const client = new LocalDaemonClient('http://127.0.0.1:4318')
    await client.listOfficialSources()
    await client.getOfficialSource('ec-sri-lrti')
    await client.getLibrarySummary()
    expect(urls).toEqual([
      'http://127.0.0.1:4318/api/v1/official-sources',
      'http://127.0.0.1:4318/api/v1/official-sources/ec-sri-lrti',
      'http://127.0.0.1:4318/api/v1/library/summary',
    ])
  })

  it('sends explicit collection and Local-GPU connection IDs for analysis', async () => {
    const id = '00000000-0000-4000-8000-000000000001'
    const connectionId = '00000000-0000-4000-8000-000000000002'
    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
      requests.push({ url: String(input), init })
      return Response.json({ id, status: 'completed' })
    }) as typeof fetch

    await new LocalDaemonClient('http://127.0.0.1:4318').analyze({ collectionId: id, connectionId, invoiceId: id })
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      url: 'http://127.0.0.1:4318/api/v1/analysis',
      init: { method: 'POST', body: JSON.stringify({ collectionId: id, connectionId, invoiceId: id }) },
    })
  })
})
