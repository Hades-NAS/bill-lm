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
      return Response.json({ items: [], id: '00000000-0000-4000-8000-000000000001', latestRevision: null })
    }) as typeof fetch

    const client = new LocalDaemonClient('http://127.0.0.1:4318')
    await client.listActivities()
    await client.createActivity({ displayName: 'Servicios de software', registeredActivityName: 'Desarrollo de software', activityDescription: 'Desarrollo local.', revenueVatTreatment: 'taxed_nonzero' })
    await client.listProfiles()
    await client.createProfile({ displayName: 'Biblioteca local', hasEmploymentIncome: false, hasRuc: false, taxRegime: 'unknown', vatFilingFrequency: 'none', activityRevisionIds: [] })
    await client.listCollections()
    await client.createCollection()

    expect(requests.map((request) => `${request.init?.method ?? 'GET'} ${request.url}`)).toEqual([
      'GET http://127.0.0.1:4318/api/v1/activities',
      'POST http://127.0.0.1:4318/api/v1/activities',
      'GET http://127.0.0.1:4318/api/v1/profiles',
      'POST http://127.0.0.1:4318/api/v1/profiles',
      'GET http://127.0.0.1:4318/api/v1/collections',
      'POST http://127.0.0.1:4318/api/v1/collections',
    ])
  })

  it('defaults to same-origin requests and keeps viewer sources cloud-free', async () => {
    const sources = ['../api.ts', '../local-viewer.tsx'].map((path) => readFileSync(join(import.meta.dir, path), 'utf8'))
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
})
