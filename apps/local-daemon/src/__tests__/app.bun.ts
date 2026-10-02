import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'

import { createLocalDaemon } from '../app'
import { createLocalLlmAdapter } from '../adapters'
import { LocalLibrary } from '../library'
import { startLocalDaemon } from '../server'
import { resolveLocalLibraryPath } from '../main'

const libraries: Array<LocalLibrary> = []
afterEach(() => libraries.splice(0).forEach((library) => library.close()))

const validSriInvoice = `<?xml version="1.0" encoding="UTF-8"?>
<autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>123</numeroAutorizacion><fechaAutorizacion>2026-01-01</fechaAutorizacion><ambiente>PRODUCCION</ambiente><comprobante><![CDATA[<factura><infoTributaria><ambiente>2</ambiente><tipoEmision>1</tipoEmision><razonSocial>Proveedor</razonSocial><nombreComercial>Proveedor</nombreComercial><ruc>1790012345001</ruc><claveAcceso>123</claveAcceso><codDoc>01</codDoc><estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000000001</secuencial><dirMatriz>Quito</dirMatriz></infoTributaria><infoFactura><fechaEmision>01/01/2026</fechaEmision><obligadoContabilidad>NO</obligadoContabilidad><tipoIdentificacionComprador>05</tipoIdentificacionComprador><razonSocialComprador>Comprador</razonSocialComprador><identificacionComprador>0102030405</identificacionComprador><totalSinImpuestos>10.00</totalSinImpuestos><totalDescuento>0.00</totalDescuento><totalConImpuestos><totalImpuesto><codigo>2</codigo><codigoPorcentaje>0</codigoPorcentaje><baseImponible>10.00</baseImponible><tarifa>0</tarifa><valor>0.00</valor></totalImpuesto></totalConImpuestos><importeTotal>10.00</importeTotal><moneda>DOLAR</moneda></infoFactura><detalles><detalle><codigoPrincipal>001</codigoPrincipal><descripcion>Servicio</descripcion><cantidad>1</cantidad><precioUnitario>10</precioUnitario><descuento>0</descuento><precioTotalSinImpuesto>10</precioTotalSinImpuesto><impuestos><impuesto><codigo>2</codigo><codigoPorcentaje>0</codigoPorcentaje><tarifa>0</tarifa><baseImponible>10</baseImponible><valor>0</valor></impuesto></impuestos></detalle></detalles></factura>]]></comprobante></autorizacion>`

const validPayload = {
  purpose: 'personal_expenses' as const,
  classification: 'needs_review' as const,
  reasoning: 'Falta evidencia para confirmar la categoría.',
  uncertainties: [],
  missingEvidence: ['Sustento de gasto personal'],
}

const successAdapter = {
  probe: async () => ({ ok: true as const }),
  analyze: async () => ({ ok: true as const, payload: validPayload }),
}

describe('local daemon', () => {
  it('resolves a deterministic user-local library path and accepts only absolute overrides', () => {
    expect(resolveLocalLibraryPath({ XDG_DATA_HOME: '/tmp/bill-lm-data' }))
      .toBe('/tmp/bill-lm-data/bill-lm')
    expect(resolveLocalLibraryPath({ HOME: '/Users/example' }))
      .toBe('/Users/example/.local/share/bill-lm')
    expect(resolveLocalLibraryPath({ BILL_LM_LOCAL_LIBRARY_DIR: '/Volumes/data/bills' }))
      .toBe('/Volumes/data/bills')
    expect(() => resolveLocalLibraryPath({ BILL_LM_LOCAL_LIBRARY_DIR: 'bills' }))
      .toThrow('BILL_LM_LOCAL_LIBRARY_DIR must be an absolute path.')
  })

  it('persists a local connection without exposing its secret reference through localhost HTTP', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const app = createLocalDaemon(library)
    const response = await app.request('/api/v1/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'GPU casa',
        apiFlavor: 'openai-like',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'qwen',
        secretRef: 'keychain:gpu',
      }),
    })
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ label: 'GPU casa' })
    expect(JSON.stringify(await (await app.request('/api/v1/connections')).json())).not.toContain('keychain:gpu')
    expect(
      (await (await app.request('/api/v1/connections')).json()).items,
    ).toHaveLength(1)
  })

  it('imports XML once into managed objects and deduplicates by hash', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const app = createLocalDaemon(library)
    const request = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }),
    }
    const first = await app.request('/api/v1/invoices/xml', request)
    const second = await app.request('/api/v1/invoices/xml', request)
    expect(first.status).toBe(201)
    expect(second.status).toBe(200)
    expect((await second.json()).kind).toBe('duplicate')
  })

  it('associates a shared XML with collections without deleting its local object on detach', async () => {
    const library = new LocalLibrary(mkdtempSync(join(tmpdir(), 'bill-lm-local-')))
    libraries.push(library)
    const app = createLocalDaemon(library, () => ({ ok: true }), () => successAdapter)
    const firstCollection = await app.request('/api/v1/collections', { method: 'POST' })
    const secondCollection = await app.request('/api/v1/collections', { method: 'POST' })
    const firstId = (await firstCollection.json() as { id: string }).id
    const secondId = (await secondCollection.json() as { id: string }).id

    const imported = await app.request(`/api/v1/collections/${firstId}/invoices/xml`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }),
    })
    expect(imported.status).toBe(201)
    const invoiceId = (await imported.json() as { invoiceId: string }).invoiceId
    const duplicateMembership = await app.request(`/api/v1/collections/${firstId}/invoices/xml`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }),
    })
    expect(duplicateMembership.status).toBe(200)
    const sharedMembership = await app.request(`/api/v1/collections/${secondId}/invoices`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invoiceId }),
    })
    expect(sharedMembership.status).toBe(201)
    expect((await (await app.request(`/api/v1/collections/${firstId}`)).json() as { invoices: unknown[] }).invoices).toHaveLength(1)
    expect((await (await app.request(`/api/v1/collections/${secondId}`)).json() as { invoices: unknown[] }).invoices).toHaveLength(1)

    expect((await app.request(`/api/v1/collections/${firstId}/invoices/${invoiceId}`, { method: 'DELETE' })).status).toBe(200)
    expect((await (await app.request('/api/v1/invoices')).json() as { items: unknown[] }).items).toHaveLength(1)
    expect((await (await app.request(`/api/v1/collections/${secondId}`)).json() as { invoices: unknown[] }).invoices).toHaveLength(1)

    const localConnection = await app.request('/api/v1/connections', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'GPU local', apiFlavor: 'openai-like', baseUrl: 'http://127.0.0.1:1234/v1', model: 'modelo' }),
    })
    const scopedAnalysis = await app.request('/api/v1/analysis', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invoiceId, collectionId: secondId, connectionId: (await localConnection.json() as { id: string }).id }),
    })
    expect(scopedAnalysis.status).toBe(202)
    expect((await (await app.request(`/api/v1/collections/${secondId}`)).json() as { runs: Array<{ collectionId: string }> }).runs).toMatchObject([{ collectionId: secondId }])
    const detachedAnalysis = await app.request('/api/v1/analysis', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invoiceId, collectionId: firstId, connectionId: crypto.randomUUID() }),
    })
    expect(detachedAnalysis.status).toBe(409)
  })

  it('returns local collection cards with persisted metadata and membership-only invoice counts', async () => {
    const library = new LocalLibrary(mkdtempSync(join(tmpdir(), 'bill-lm-local-')))
    libraries.push(library)
    const app = createLocalDaemon(library)
    const created = await app.request('/api/v1/collections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Gastos personales', year: 2026 }),
    })
    expect(created.status).toBe(201)
    const collection = await created.json() as { id: string; name: string; year: number; invoiceCount: number }
    expect(collection).toMatchObject({ name: 'Gastos personales', year: 2026, invoiceCount: 0 })

    const imported = await app.request(`/api/v1/collections/${collection.id}/invoices/xml`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }),
    })
    expect(imported.status).toBe(201)
    expect(await (await app.request('/api/v1/collections')).json()).toMatchObject({
      items: [{ id: collection.id, name: 'Gastos personales', year: 2026, invoiceCount: 1 }],
    })
  })

  it('migrates a legacy local library with unscoped runs without losing its records', () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'bill-lm-local-'))
    const database = new Database(join(rootPath, 'library.sqlite'))
    const scopeId = crypto.randomUUID()
    const invoiceId = crypto.randomUUID()
    const runId = crypto.randomUUID()
    database.run('CREATE TABLE local_library_metadata (scope_id TEXT PRIMARY KEY)')
    database.run('CREATE TABLE local_invoices (id TEXT PRIMARY KEY, content_hash TEXT UNIQUE NOT NULL, file_name TEXT NOT NULL, object_path TEXT NOT NULL, created_at TEXT NOT NULL)')
    database.run('CREATE TABLE local_runs (id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, connection_id TEXT NOT NULL, ruleset_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)')
    database.query('INSERT INTO local_library_metadata VALUES (?)').run(scopeId)
    database.query('INSERT INTO local_invoices VALUES (?, ?, ?, ?, ?)').run(invoiceId, 'legacy-hash', 'legado.xml', '.bill-lm/objects/legacy.xml', new Date().toISOString())
    database.query('INSERT INTO local_runs VALUES (?, ?, ?, ?, ?, ?)').run(runId, invoiceId, crypto.randomUUID(), 'legacy-ruleset', 'completed', new Date().toISOString())
    database.close()

    const library = new LocalLibrary(rootPath)
    libraries.push(library)
    expect(library.listInvoices()).toMatchObject([{ id: invoiceId, fileName: 'legado.xml' }])
    expect(library.listRuns()).toMatchObject([{ id: runId, invoiceId, collectionId: null }])
    expect(library.listCollectionInvoices(crypto.randomUUID())).toEqual([])
  })

  it('rejects malformed invoices and exposes the bundled SRI ruleset read-only', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const app = createLocalDaemon(library)
    const malformed = await app.request('/api/v1/invoices/xml', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'factura.xml', xml: '<factura />' }),
    })
    expect(malformed.status).toBe(400)
    const diskBundle = JSON.parse(
      readFileSync(
        join(
          import.meta.dir,
          '../../../../resources/tax-rules/ec/sri/rulesets/ec-sri-2026.3.bundle.json',
        ),
        'utf-8',
      ),
    ) as { rulesetId: string; version: string; jurisdiction: string }
    expect(
      (await (await app.request('/api/v1/rulesets')).json()).items[0],
    ).toMatchObject({
      id: diskBundle.rulesetId,
      version: String(diskBundle.version),
      jurisdiction: diskBundle.jurisdiction,
    })
    expect(
      (await app.request('/api/v1/rulesets', { method: 'POST' })).status,
    ).toBe(404)
  })

  it('serves official-source manifests and the local library summary without disk paths or scope identifiers', async () => {
    const library = new LocalLibrary(mkdtempSync(join(tmpdir(), 'bill-lm-local-')))
    libraries.push(library)
    const app = createLocalDaemon(library)
    const sources = await app.request('/api/v1/official-sources')
    expect(sources.status).toBe(200)
    const source = (await sources.json() as { items: Array<{ id: string; title: string; sectionCount: number }> }).items[0]
    expect(source).toMatchObject({ id: 'ec-sri-lrti', title: 'Ley de Régimen Tributario Interno (LRTI)' })
    expect(source.sectionCount).toBeGreaterThan(0)
    const detail = await app.request(`/api/v1/official-sources/${source.id}`)
    expect(detail.status).toBe(200)
    expect(await detail.json()).toMatchObject({ id: source.id, ruleset: { reviewStatus: 'local-snapshot' } })
    expect((await app.request('/api/v1/official-sources/no-existe')).status).toBe(404)
    const summary = await app.request('/api/v1/library/summary')
    expect(summary.status).toBe(200)
    const serialized = JSON.stringify(await summary.json())
    expect(serialized).not.toContain(library.rootPath)
    expect(serialized).not.toContain('scope_id')
  })

  it('creates a run only after XML and a fresh successful GPU probe', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const app = createLocalDaemon(library, () => ({ ok: true }), () => successAdapter)
    await app.request('/api/v1/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'GPU casa',
        apiFlavor: 'openai-like',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'qwen',
        makeDefault: true,
      }),
    })
    const collection = await app.request('/api/v1/collections', { method: 'POST' })
    const collectionId = (await collection.json() as { id: string }).id
    const invoice = await app.request(`/api/v1/collections/${collectionId}/invoices/xml`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }),
    })
    const analysis = await app.request('/api/v1/analysis', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invoiceId: (await invoice.json()).invoiceId, collectionId, connectionId: (await (await app.request('/api/v1/connections')).json() as { items: Array<{ id: string }> }).items[0]!.id }),
    })
    expect(analysis.status).toBe(202)
    const run = await analysis.json()
    await Bun.sleep(0)
    expect((await (await app.request(`/api/v1/runs/${run.id}/events`)).json()).items)
      .toMatchObject([{ runId: run.id, status: 'queued' }, { runId: run.id, status: 'running' }, { runId: run.id, status: 'completed' }])
    expect(library.getRunResult(run.id)).toMatchObject({ runId: run.id, payload: validPayload })
  })

  it('serves run events and result only through the owning collection', async () => {
    const library = new LocalLibrary(mkdtempSync(join(tmpdir(), 'bill-lm-local-')))
    libraries.push(library)
    const app = createLocalDaemon(library)
    const collectionA = await app.request('/api/v1/collections', { method: 'POST' })
    const collectionB = await app.request('/api/v1/collections', { method: 'POST' })
    const collectionAId = (await collectionA.json() as { id: string }).id
    const collectionBId = (await collectionB.json() as { id: string }).id
    const runA = library.createRun({ invoiceId: crypto.randomUUID(), collectionId: collectionAId, connectionId: crypto.randomUUID(), rulesetId: 'local-ruleset' })
    const runB = library.createRun({ invoiceId: crypto.randomUUID(), collectionId: collectionBId, connectionId: crypto.randomUUID(), rulesetId: 'local-ruleset' })
    library.startRun(runA.id)

    const ownDetail = await app.request(`/api/v1/collections/${collectionAId}/runs/${runA.id}`)
    expect(ownDetail.status).toBe(200)
    const ownBody = await ownDetail.json() as { id: string; collectionId: string; result: null; events: Array<{ runId: string; status: string }> }
    expect(ownBody.id).toBe(runA.id)
    expect(ownBody.collectionId).toBe(collectionAId)
    expect(ownBody.result).toBeNull()
    expect(ownBody.events[0]).toMatchObject({ runId: runA.id, status: 'queued' })

    const foreignDetail = await app.request(`/api/v1/collections/${collectionAId}/runs/${runB.id}`)
    expect(foreignDetail.status).toBe(404)
    expect(await foreignDetail.json()).toEqual({ code: 'RUN_NOT_FOUND' })
  })

  it('uses distinct OpenAI-like and Claude-like wire contracts without leaking secrets', async () => {
    const connection = {
      id: crypto.randomUUID(), label: 'GPU', baseUrl: 'http://gpu.test/v1', model: 'qwen',
      isDefault: false, lastProbedAt: null, lastProbeError: null, createdAt: new Date(), updatedAt: new Date(), secretRef: 'env:LOCAL_GPU_TEST_SECRET',
    }
    process.env.LOCAL_GPU_TEST_SECRET = 'fixture-secret'
    const requests: Array<{ url: URL; init?: RequestInit }> = []
    const fetchFixture = (async (input: URL | RequestInfo, init?: RequestInit) => {
      requests.push({ url: new URL(String(input)), init })
      const isClaude = String(input).includes('claude')
      const body = isClaude
        ? { content: [{ type: 'text', text: JSON.stringify(validPayload) }] }
        : { choices: [{ message: { content: JSON.stringify(validPayload) } }] }
      return new Response(JSON.stringify(String(input).endsWith('/models') ? { data: [] } : body), { status: 200 })
    }) as typeof fetch
    const openai = createLocalLlmAdapter({ ...connection, apiFlavor: 'openai-like' }, fetchFixture)
    await openai.probe({ ...connection, apiFlavor: 'openai-like' })
    await openai.analyze({ connection: { ...connection, apiFlavor: 'openai-like' }, runId: crypto.randomUUID(), prompt: 'JSON', outputSchema: { type: 'object' } })
    const claudeConnection = { ...connection, baseUrl: 'http://claude.test', apiFlavor: 'claude-like' as const }
    const claude = createLocalLlmAdapter(claudeConnection, fetchFixture)
    await claude.probe(claudeConnection)
    await claude.analyze({ connection: claudeConnection, runId: crypto.randomUUID(), prompt: 'JSON', outputSchema: { type: 'object' } })
    expect(requests.map(({ url }) => url.pathname)).toEqual(['/v1/models', '/v1/chat/completions', '/v1/models', '/v1/messages'])
    expect(requests[1].init?.headers).toMatchObject({ authorization: 'Bearer fixture-secret', 'content-type': 'application/json' })
    expect(requests[3].init?.headers).toMatchObject({ 'x-api-key': 'fixture-secret', 'anthropic-version': '2023-06-01' })
    expect(JSON.stringify(requests.map(({ init }) => init?.body))).not.toContain('fixture-secret')
  })

  it('fails a created run with OAuth guidance and no persisted result when adapter output is invalid', async () => {
    const library = new LocalLibrary(mkdtempSync(join(tmpdir(), 'bill-lm-local-')))
    libraries.push(library)
    const app = createLocalDaemon(library, () => ({ ok: true }), () => ({
      probe: async () => ({ ok: true as const }),
      analyze: async () => ({ ok: true as const, payload: { invalid: true } }),
    }))
    const connection = await app.request('/api/v1/connections', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: 'GPU', apiFlavor: 'openai-like', baseUrl: 'http://127.0.0.1:1234/v1', model: 'qwen', makeDefault: true }) })
    expect(connection.status).toBe(201)
    const collection = await app.request('/api/v1/collections', { method: 'POST' })
    const collectionId = (await collection.json() as { id: string }).id
    const invoice = await app.request(`/api/v1/collections/${collectionId}/invoices/xml`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }) })
    const response = await app.request('/api/v1/analysis', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ invoiceId: (await invoice.json()).invoiceId, collectionId, connectionId: (await (await app.request('/api/v1/connections')).json() as { items: Array<{ id: string }> }).items[0]!.id }) })
    expect(response.status).toBe(202)
    const body = await response.json()
    await Bun.sleep(0)
    expect(body).toMatchObject({ status: 'queued' })
    expect(library.getRunResult(body.id)).toBeNull()
    expect(library.listRunEvents(body.id).at(-1)).toMatchObject({ status: 'failed' })
  })

  it('returns a failed probe cause and OAuth guidance without creating a run', async () => {
    const library = new LocalLibrary(mkdtempSync(join(tmpdir(), 'bill-lm-local-')))
    libraries.push(library)
    const app = createLocalDaemon(library, () => ({ ok: false, cause: 'transport', message: 'No se pudo conectar al servidor local.' }))
    await app.request('/api/v1/connections', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: 'GPU', apiFlavor: 'openai-like', baseUrl: 'http://127.0.0.1:1234/v1', model: 'qwen', makeDefault: true }) })
    const collection = await app.request('/api/v1/collections', { method: 'POST' })
    const collectionId = (await collection.json() as { id: string }).id
    const invoice = await app.request(`/api/v1/collections/${collectionId}/invoices/xml`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }) })
    const response = await app.request('/api/v1/analysis', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ invoiceId: (await invoice.json()).invoiceId, collectionId, connectionId: (await (await app.request('/api/v1/connections')).json() as { items: Array<{ id: string }> }).items[0]!.id }) })
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ code: 'GPU_PROBE_FAILED', cause: 'transport', oauthGuidance: { kind: 'oauth-guidance' } })
    expect(library.listRuns()).toHaveLength(0)
  })

  it('binds the daemon to loopback and rejects a raw secret value', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const server = startLocalDaemon(library, 0)
    try {
      expect(
        (await fetch(`http://127.0.0.1:${server.port}/api/v1/rulesets`)).status,
      ).toBe(200)
      const app = createLocalDaemon(library)
      const response = await app.request('/api/v1/connections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label: 'Incorrecta',
          apiFlavor: 'openai-like',
          baseUrl: 'http://127.0.0.1:1234/v1',
          model: 'qwen',
          secretRef: 'api-key-raw',
        }),
      })
      expect(response.status).toBe(400)
    } finally {
      server.stop(true)
    }
  })

  it('persists profiles and activities through the shared use cases with ordered revisions', async () => {
    const library = new LocalLibrary(mkdtempSync(join(tmpdir(), 'bill-lm-local-')))
    libraries.push(library)
    const app = createLocalDaemon(library)
    const activityInput = {
      displayName: 'Servicios de software',
      registeredActivityName: 'Desarrollo de software',
      activityDescription: 'Desarrollo y mantenimiento de software.',
      revenueVatTreatment: 'taxed_nonzero',
    }
    const createdActivity = await app.request('/api/v1/activities', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(activityInput),
    })
    expect(createdActivity.status).toBe(201)
    const activity = await createdActivity.json() as { id: string; activityId: string; revision: number }
    const revisedActivity = await app.request(`/api/v1/activities/${activity.activityId}/revisions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...activityInput, displayName: 'Software local' }),
    })
    expect(revisedActivity.status).toBe(201)
    expect(await revisedActivity.json()).toMatchObject({ activityId: activity.activityId, revision: 2 })

    const profileInput = {
      displayName: 'Biblioteca local',
      hasEmploymentIncome: false,
      hasRuc: true,
      taxRegime: 'general',
      vatFilingFrequency: 'monthly',
      activityRevisionIds: [activity.id],
    }
    const createdProfile = await app.request('/api/v1/profiles', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(profileInput),
    })
    expect(createdProfile.status).toBe(201)
    const profile = await createdProfile.json() as { taxpayerProfileId: string }
    const listed = await (await app.request('/api/v1/profiles')).json() as { items: Array<{ latestRevision: { activityRevisionIds: string[] } }> }
    expect(listed.items).toMatchObject([{ latestRevision: { activityRevisionIds: [activity.id] } }])
    const revisedProfile = await app.request(`/api/v1/profiles/${profile.taxpayerProfileId}/revisions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(profileInput),
    })
    expect(revisedProfile.status).toBe(201)
    expect(await revisedProfile.json()).toMatchObject({ taxpayerProfileId: profile.taxpayerProfileId, revision: 2 })
  })

  it('maps local profile/activity validation and missing aggregates to 400 or 404', async () => {
    const library = new LocalLibrary(mkdtempSync(join(tmpdir(), 'bill-lm-local-')))
    libraries.push(library)
    const app = createLocalDaemon(library)
    const invalidProfile = await app.request('/api/v1/profiles', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        displayName: 'Inválido', hasEmploymentIncome: false, hasRuc: true,
        taxRegime: 'general', vatFilingFrequency: 'monthly',
        activityRevisionIds: [crypto.randomUUID()],
      }),
    })
    expect(invalidProfile.status).toBe(400)
    expect(await invalidProfile.json()).toMatchObject({ code: 'INVALID_ACTIVITY_REVISION' })
    expect(
      (await (await app.request('/api/v1/profiles')).json() as { items: unknown[] }).items,
    ).toHaveLength(0)
    const missingActivity = await app.request(`/api/v1/activities/${crypto.randomUUID()}/revisions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        displayName: 'Ausente', registeredActivityName: 'Ausente', activityDescription: 'Ausente', revenueVatTreatment: 'unknown',
      }),
    })
    expect(missingActivity.status).toBe(404)
    expect(await missingActivity.json()).toMatchObject({ code: 'ACTIVITY_NOT_FOUND' })
  })

  it('persists scoped collection contexts with append-only revisions', async () => {
    const library = new LocalLibrary(mkdtempSync(join(tmpdir(), 'bill-lm-local-')))
    libraries.push(library)
    const app = createLocalDaemon(library)
    const activity = await (await app.request('/api/v1/activities', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        displayName: 'Actividad local', registeredActivityName: 'Actividad local',
        activityDescription: 'Una actividad local válida.', revenueVatTreatment: 'unknown',
      }),
    })).json() as { id: string }
    const profile = await (await app.request('/api/v1/profiles', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        displayName: 'Perfil local', hasEmploymentIncome: false, hasRuc: true,
        taxRegime: 'general', vatFilingFrequency: 'monthly', activityRevisionIds: [activity.id],
      }),
    })).json() as { id: string }

    expect((await (await app.request('/api/v1/collections')).json() as { items: unknown[] }).items).toHaveLength(0)
    const created = await app.request('/api/v1/collections', { method: 'POST' })
    expect(created.status).toBe(201)
    const collection = await created.json() as { id: string; latestRevision: null }
    expect(collection.latestRevision).toBeNull()

    const input = {
      purpose: 'vat_credit', period: { startDate: '2026-01-01', endDate: '2026-01-31' },
      taxpayerProfileRevisionId: profile.id, activityRevisionIds: [activity.id], notes: 'Enero local',
    }
    const first = await app.request(`/api/v1/collections/${collection.id}/revisions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
    })
    expect(first.status).toBe(201)
    expect(await first.json()).toMatchObject({ collectionId: collection.id, revision: 1 })
    const second = await app.request(`/api/v1/collections/${collection.id}/revisions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, notes: 'Revisión local' }),
    })
    expect(second.status).toBe(201)
    expect(await second.json()).toMatchObject({ collectionId: collection.id, revision: 2 })
    const listed = await (await app.request('/api/v1/collections')).json() as { items: Array<{ id: string; latestRevision: { revision: number; notes?: string } }> }
    expect(listed.items).toMatchObject([{ id: collection.id, latestRevision: { revision: 2, notes: 'Revisión local' } }])

    const invalid = await app.request(`/api/v1/collections/${collection.id}/revisions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, taxpayerProfileRevisionId: crypto.randomUUID() }),
    })
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toMatchObject({ code: 'INVALID_COLLECTION_CONTEXT' })
    const duplicateActivityReference = await app.request(`/api/v1/collections/${collection.id}/revisions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, activityRevisionIds: [activity.id, activity.id] }),
    })
    expect(duplicateActivityReference.status).toBe(400)
    expect(await duplicateActivityReference.json()).toMatchObject({ code: 'INVALID_COLLECTION_CONTEXT' })

    const anotherLibrary = new LocalLibrary(mkdtempSync(join(tmpdir(), 'bill-lm-local-')))
    libraries.push(anotherLibrary)
    const anotherApp = createLocalDaemon(anotherLibrary)
    const foreignActivity = await (await anotherApp.request('/api/v1/activities', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        displayName: 'Actividad ajena', registeredActivityName: 'Actividad ajena',
        activityDescription: 'Una actividad de otra biblioteca.', revenueVatTreatment: 'unknown',
      }),
    })).json() as { id: string }
    const foreignProfile = await (await anotherApp.request('/api/v1/profiles', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        displayName: 'Perfil ajeno', hasEmploymentIncome: false, hasRuc: true,
        taxRegime: 'general', vatFilingFrequency: 'monthly', activityRevisionIds: [foreignActivity.id],
      }),
    })).json() as { id: string }
    const crossLibrary = await app.request(`/api/v1/collections/${collection.id}/revisions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        ...input,
        taxpayerProfileRevisionId: foreignProfile.id,
        activityRevisionIds: [foreignActivity.id],
      }),
    })
    expect(crossLibrary.status).toBe(400)
    expect(await crossLibrary.json()).toMatchObject({ code: 'INVALID_COLLECTION_CONTEXT' })
    expect(
      (await (await app.request('/api/v1/collections')).json() as {
        items: Array<{ id: string; latestRevision: { revision: number; notes?: string } }>
      }).items,
    ).toMatchObject([{ id: collection.id, latestRevision: { revision: 2, notes: 'Revisión local' } }])
    const missing = await app.request(`/api/v1/collections/${crypto.randomUUID()}/revisions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
    })
    expect(missing.status).toBe(404)
    expect(await missing.json()).toMatchObject({ code: 'COLLECTION_NOT_FOUND' })

    const rootPath = library.rootPath
    library.close()
    libraries.splice(libraries.indexOf(library), 1)
    const restarted = new LocalLibrary(rootPath)
    libraries.push(restarted)
    expect(
      (await (await createLocalDaemon(restarted).request('/api/v1/collections')).json() as {
        items: Array<{ id: string; latestRevision: { revision: number; notes?: string } }>
      }).items,
    ).toMatchObject([{ id: collection.id, latestRevision: { revision: 2, notes: 'Revisión local' } }])
    const isolated = new LocalLibrary(mkdtempSync(join(tmpdir(), 'bill-lm-local-')))
    libraries.push(isolated)
    expect((await (await createLocalDaemon(isolated).request('/api/v1/collections')).json() as { items: unknown[] }).items).toHaveLength(0)
  })

  it('persists the implicit library identity across restart and isolates another library', async () => {
    const firstRoot = mkdtempSync(join(tmpdir(), 'bill-lm-local-'))
    const first = new LocalLibrary(firstRoot)
    libraries.push(first)
    const firstApp = createLocalDaemon(first)
    const created = await firstApp.request('/api/v1/activities', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        displayName: 'Propia', registeredActivityName: 'Propia', activityDescription: 'Actividad propia', revenueVatTreatment: 'unknown',
      }),
    })
    expect(created.status).toBe(201)
    const persistedScope = first.actorScope().userId
    first.close()
    libraries.splice(libraries.indexOf(first), 1)
    const restarted = new LocalLibrary(firstRoot)
    libraries.push(restarted)
    expect(restarted.actorScope().userId).toBe(persistedScope)
    expect((await (await createLocalDaemon(restarted).request('/api/v1/activities')).json() as { items: unknown[] }).items).toHaveLength(1)

    const isolated = new LocalLibrary(mkdtempSync(join(tmpdir(), 'bill-lm-local-')))
    libraries.push(isolated)
    expect((await (await createLocalDaemon(isolated).request('/api/v1/activities')).json() as { items: unknown[] }).items).toHaveLength(0)
  })

  it('recovers managed temporary objects without losing SQLite state on restart', () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'bill-lm-local-'))
    const first = new LocalLibrary(rootPath)
    libraries.push(first)
    first.createConnection({
      label: 'GPU persistente',
      apiFlavor: 'claude-like',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen',
      makeDefault: false,
    })
    first.close()
    const objectDirectory = join(rootPath, '.bill-lm', 'objects', 'ab')
    mkdirSync(objectDirectory, { recursive: true })
    const temporaryPath = join(objectDirectory, 'incomplete.xml.tmp')
    writeFileSync(temporaryPath, '<incomplete />')
    const restarted = new LocalLibrary(rootPath)
    libraries.push(restarted)
    expect(existsSync(temporaryPath)).toBe(false)
    expect(restarted.listConnections()).toHaveLength(1)
  })
})
