import {
  MaxTurnsExceededError,
  ModelBehaviorError,
  ModelRefusalError,
  ModelTimeoutError,
  SystemError,
} from '@openai/agents'
import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, it } from 'bun:test'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createLocalLlmAdapter, openAiAgentsFailure } from '../adapters'
import {
  LocalTaxAnalysisAgentOutputType,
  LocalTaxAnalysisOutputJsonSchema,
  localTaxAnalysisAgentOutputTypeForPurpose,
  omitNullOutputFields,
} from '../analysis-output-schema'
import { createLocalDaemon } from '../app'
import { LocalLibrary } from '../library'
import { createLocalDaemonLogger } from '../logger'
import { resolveLocalLibraryPath } from '../main'
import { startLocalDaemon } from '../server'

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

async function configurePersonalExpensesContext(
  app: ReturnType<typeof createLocalDaemon>,
  collectionId: string,
) {
  const profile = (await (
    await app.request('/api/v1/profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Perfil de gastos personales',
        hasEmploymentIncome: true,
        hasRuc: false,
        taxRegime: 'unknown',
        vatFilingFrequency: 'none',
        activityRevisionIds: [],
      }),
    })
  ).json()) as { id: string }
  const context = await app.request(
    `/api/v1/collections/${collectionId}/revisions`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        purpose: 'personal_expenses',
        period: { startDate: '2026-01-01', endDate: '2026-01-31' },
        taxpayerProfileRevisionId: profile.id,
        activityRevisionIds: [],
      }),
    },
  )
  expect(context.status).toBe(201)
}

describe('local daemon', () => {
  it('resolves a deterministic user-local library path and accepts only absolute overrides', () => {
    expect(
      resolveLocalLibraryPath({ XDG_DATA_HOME: '/tmp/bill-lm-data' }),
    ).toBe('/tmp/bill-lm-data/bill-lm')
    expect(resolveLocalLibraryPath({ HOME: '/Users/example' })).toBe(
      '/Users/example/.local/share/bill-lm',
    )
    expect(
      resolveLocalLibraryPath({
        BILL_LM_LOCAL_LIBRARY_DIR: '/Volumes/data/bills',
      }),
    ).toBe('/Volumes/data/bills')
    expect(() =>
      resolveLocalLibraryPath({ BILL_LM_LOCAL_LIBRARY_DIR: 'bills' }),
    ).toThrow('BILL_LM_LOCAL_LIBRARY_DIR must be an absolute path.')
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
    expect(
      JSON.stringify(await (await app.request('/api/v1/connections')).json()),
    ).not.toContain('keychain:gpu')
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
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const app = createLocalDaemon(
      library,
      () => ({ ok: true }),
      () => successAdapter,
    )
    const firstCollection = await app.request('/api/v1/collections', {
      method: 'POST',
    })
    const secondCollection = await app.request('/api/v1/collections', {
      method: 'POST',
    })
    const firstId = ((await firstCollection.json()) as { id: string }).id
    const secondId = ((await secondCollection.json()) as { id: string }).id

    const imported = await app.request(
      `/api/v1/collections/${firstId}/invoices/xml`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }),
      },
    )
    expect(imported.status).toBe(201)
    const invoiceId = ((await imported.json()) as { invoiceId: string })
      .invoiceId
    const duplicateMembership = await app.request(
      `/api/v1/collections/${firstId}/invoices/xml`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }),
      },
    )
    expect(duplicateMembership.status).toBe(200)
    const sharedMembership = await app.request(
      `/api/v1/collections/${secondId}/invoices`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      },
    )
    expect(sharedMembership.status).toBe(201)
    expect(
      (
        (await (
          await app.request(`/api/v1/collections/${firstId}`)
        ).json()) as { invoices: unknown[] }
      ).invoices,
    ).toHaveLength(1)
    expect(
      (
        (await (
          await app.request(`/api/v1/collections/${secondId}`)
        ).json()) as { invoices: unknown[] }
      ).invoices,
    ).toHaveLength(1)

    expect(
      (
        await app.request(
          `/api/v1/collections/${firstId}/invoices/${invoiceId}`,
          { method: 'DELETE' },
        )
      ).status,
    ).toBe(200)
    expect(
      (
        (await (await app.request('/api/v1/invoices')).json()) as {
          items: unknown[]
        }
      ).items,
    ).toHaveLength(1)
    expect(
      (
        (await (
          await app.request(`/api/v1/collections/${secondId}`)
        ).json()) as { invoices: unknown[] }
      ).invoices,
    ).toHaveLength(1)

    const localConnection = await app.request('/api/v1/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'GPU local',
        apiFlavor: 'openai-like',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'modelo',
      }),
    })
    await configurePersonalExpensesContext(app, secondId)
    const scopedAnalysis = await app.request('/api/v1/analysis', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        invoiceId,
        collectionId: secondId,
        connectionId: ((await localConnection.json()) as { id: string }).id,
      }),
    })
    expect(scopedAnalysis.status).toBe(202)
    expect(
      (
        (await (
          await app.request(`/api/v1/collections/${secondId}`)
        ).json()) as { runs: Array<{ collectionId: string }> }
      ).runs,
    ).toMatchObject([{ collectionId: secondId }])
    const detachedAnalysis = await app.request('/api/v1/analysis', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        invoiceId,
        collectionId: firstId,
        connectionId: crypto.randomUUID(),
      }),
    })
    expect(detachedAnalysis.status).toBe(409)
  })

  it('returns local collection cards with persisted metadata and membership-only invoice counts', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const app = createLocalDaemon(library)
    const created = await app.request('/api/v1/collections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Gastos personales', year: 2026 }),
    })
    expect(created.status).toBe(201)
    const collection = (await created.json()) as {
      id: string
      name: string
      year: number
      invoiceCount: number
    }
    expect(collection).toMatchObject({
      name: 'Gastos personales',
      year: 2026,
      invoiceCount: 0,
    })

    const imported = await app.request(
      `/api/v1/collections/${collection.id}/invoices/xml`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }),
      },
    )
    expect(imported.status).toBe(201)
    expect(
      await (await app.request('/api/v1/collections')).json(),
    ).toMatchObject({
      items: [
        {
          id: collection.id,
          name: 'Gastos personales',
          year: 2026,
          invoiceCount: 1,
        },
      ],
    })
  })

  it('migrates a legacy local library with unscoped runs without losing its records', () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'bill-lm-local-'))
    const database = new Database(join(rootPath, 'library.sqlite'))
    const scopeId = crypto.randomUUID()
    const invoiceId = crypto.randomUUID()
    const runId = crypto.randomUUID()
    database.run(
      'CREATE TABLE local_library_metadata (scope_id TEXT PRIMARY KEY)',
    )
    database.run(
      'CREATE TABLE local_invoices (id TEXT PRIMARY KEY, content_hash TEXT UNIQUE NOT NULL, file_name TEXT NOT NULL, object_path TEXT NOT NULL, created_at TEXT NOT NULL)',
    )
    database.run(
      'CREATE TABLE local_runs (id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, connection_id TEXT NOT NULL, ruleset_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)',
    )
    database.query('INSERT INTO local_library_metadata VALUES (?)').run(scopeId)
    database
      .query('INSERT INTO local_invoices VALUES (?, ?, ?, ?, ?)')
      .run(
        invoiceId,
        'legacy-hash',
        'legado.xml',
        '.bill-lm/objects/legacy.xml',
        new Date().toISOString(),
      )
    database
      .query('INSERT INTO local_runs VALUES (?, ?, ?, ?, ?, ?)')
      .run(
        runId,
        invoiceId,
        crypto.randomUUID(),
        'legacy-ruleset',
        'completed',
        new Date().toISOString(),
      )
    database.close()

    const library = new LocalLibrary(rootPath)
    libraries.push(library)
    expect(library.listInvoices()).toMatchObject([
      { id: invoiceId, fileName: 'legado.xml' },
    ])
    expect(library.listRuns()).toMatchObject([
      { id: runId, invoiceId, collectionId: null },
    ])
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
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const app = createLocalDaemon(library)
    const sources = await app.request('/api/v1/official-sources')
    expect(sources.status).toBe(200)
    const source = (
      (await sources.json()) as {
        items: Array<{ id: string; title: string; sectionCount: number }>
      }
    ).items[0]
    expect(source).toMatchObject({
      id: 'ec-sri-lrti',
      title: 'Ley de Régimen Tributario Interno (LRTI)',
    })
    expect(source.sectionCount).toBeGreaterThan(0)
    const detail = await app.request(`/api/v1/official-sources/${source.id}`)
    expect(detail.status).toBe(200)
    expect(await detail.json()).toMatchObject({
      id: source.id,
      ruleset: { reviewStatus: 'local-snapshot' },
    })
    expect(
      (await app.request('/api/v1/official-sources/no-existe')).status,
    ).toBe(404)
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
    const app = createLocalDaemon(
      library,
      () => ({ ok: true }),
      () => successAdapter,
    )
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
    const collection = await app.request('/api/v1/collections', {
      method: 'POST',
    })
    const collectionId = ((await collection.json()) as { id: string }).id
    await configurePersonalExpensesContext(app, collectionId)
    const invoice = await app.request(
      `/api/v1/collections/${collectionId}/invoices/xml`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }),
      },
    )
    const analysis = await app.request('/api/v1/analysis', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        invoiceId: (await invoice.json()).invoiceId,
        collectionId,
        connectionId: (
          (await (await app.request('/api/v1/connections')).json()) as {
            items: Array<{ id: string }>
          }
        ).items[0].id,
      }),
    })
    expect(analysis.status).toBe(202)
    const run = await analysis.json()
    await Bun.sleep(0)
    expect(
      (await (await app.request(`/api/v1/runs/${run.id}/events`)).json()).items,
    ).toMatchObject([
      { runId: run.id, status: 'queued' },
      { runId: run.id, status: 'running' },
      { runId: run.id, status: 'completed' },
    ])
    expect(library.getRunResult(run.id)).toMatchObject({
      runId: run.id,
      payload: validPayload,
    })
    expect(
      (await (await app.request(`/api/v1/collections/${collectionId}`)).json())
        .invoices,
    ).toMatchObject([
      {
        latestAnalysis: {
          runId: run.id,
          classification: 'needs_review',
          payload: validPayload,
        },
      },
    ])
  })

  it('queues a collection once and the daemon processes its invoices sequentially after a failure', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    let attempts = 0
    const prompts: string[] = []
    const app = createLocalDaemon(
      library,
      () => ({ ok: true }),
      () => ({
        probe: async () => ({ ok: true as const }),
        analyze: async (input) => {
          prompts.push(input.prompt)
          attempts += 1
          return attempts === 1
            ? {
                ok: false as const,
                cause: 'invalid-output' as const,
                message: 'Salida inválida.',
              }
            : { ok: true as const, payload: validPayload }
        },
      }),
    )
    const connection = await app.request('/api/v1/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'GPU',
        apiFlavor: 'openai-like',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'qwen',
      }),
    })
    const collection = await app.request('/api/v1/collections', {
      method: 'POST',
    })
    const collectionId = ((await collection.json()) as { id: string }).id
    await configurePersonalExpensesContext(app, collectionId)
    await app.request(`/api/v1/collections/${collectionId}/invoices/xml`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'primera.xml', xml: validSriInvoice }),
    })
    await app.request(`/api/v1/collections/${collectionId}/invoices/xml`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fileName: 'segunda.xml',
        xml: validSriInvoice.replace(
          '<numeroAutorizacion>123',
          '<numeroAutorizacion>124',
        ),
      }),
    })

    const response = await app.request(
      `/api/v1/collections/${collectionId}/analysis`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          connectionId: ((await connection.json()) as { id: string }).id,
        }),
      },
    )
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({
      batchId: expect.any(String),
      status: 'queued',
      invoiceCount: 2,
      queuedAt: expect.any(String),
    })

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const runs = library.listRuns({ collectionId })
      if (
        runs.length === 2 &&
        runs.every(
          (run) => run.status === 'completed' || run.status === 'failed',
        )
      )
        break
      await Bun.sleep(10)
    }
    const runs = library.listRuns({ collectionId })
    expect(attempts).toBe(2)
    expect(prompts).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'redacta en español todos los valores textuales visibles del JSON de salida',
        ),
      ]),
    )
    expect(runs).toHaveLength(2)
    expect(runs.map((run) => run.status).sort()).toEqual([
      'completed',
      'failed',
    ])
    expect(runs.map((run) => run.batch?.id)).toEqual([
      expect.any(String),
      expect.any(String),
    ])
    expect(runs[0]?.batch).toMatchObject({
      invoiceCount: 2,
      finishedCount: 2,
      status: 'completed',
    })
    expect(runs[0]?.batch?.id).toBe(runs[1]?.batch?.id)
  })

  it('blocks a collection without context before probing or dispatching to Local-GPU', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    let probes = 0
    const app = createLocalDaemon(
      library,
      () => {
        probes += 1
        return { ok: true }
      },
      () => successAdapter,
    )
    const connection = await app.request('/api/v1/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'GPU',
        apiFlavor: 'openai-like',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'qwen',
      }),
    })
    const collection = await app.request('/api/v1/collections', {
      method: 'POST',
    })
    const collectionId = ((await collection.json()) as { id: string }).id
    const invoice = await app.request(
      `/api/v1/collections/${collectionId}/invoices/xml`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }),
      },
    )
    const response = await app.request('/api/v1/analysis', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        invoiceId: ((await invoice.json()) as { invoiceId: string }).invoiceId,
        collectionId,
        connectionId: ((await connection.json()) as { id: string }).id,
      }),
    })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      code: 'MISSING_COLLECTION_CONTEXT',
    })
    expect(probes).toBe(0)
    expect(library.listRuns()).toHaveLength(0)
  })

  it('logs the analysis lifecycle safely and persists a safe adapter failure cause', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const lines: string[] = []
    const logger = createLocalDaemonLogger('debug', (line) => lines.push(line))
    const app = createLocalDaemon(
      library,
      () => ({ ok: true }),
      () => ({
        probe: async () => ({ ok: true as const }),
        analyze: async () => ({
          ok: false as const,
          cause: 'http' as const,
          message: 'El servidor local respondió 503.',
        }),
      }),
      logger,
    )
    const connection = await app.request('/api/v1/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'GPU local',
        apiFlavor: 'openai-like',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'modelo',
        makeDefault: true,
      }),
    })
    const collection = await app.request('/api/v1/collections', {
      method: 'POST',
    })
    const collectionId = ((await collection.json()) as { id: string }).id
    await configurePersonalExpensesContext(app, collectionId)
    const invoice = await app.request(
      `/api/v1/collections/${collectionId}/invoices/xml`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }),
      },
    )
    const analysis = await app.request('/api/v1/analysis', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        invoiceId: ((await invoice.json()) as { invoiceId: string }).invoiceId,
        collectionId,
        connectionId: ((await connection.json()) as { id: string }).id,
      }),
    })
    const run = (await analysis.json()) as { id: string }
    await Bun.sleep(0)

    const events = (
      (await (await app.request(`/api/v1/runs/${run.id}/events`)).json()) as {
        items: Array<{ message: string }>
      }
    ).items
    expect(events.at(-1)?.message).toBe('El servidor local respondió 503.')
    expect(lines.map((line) => JSON.parse(line).event)).toEqual(
      expect.arrayContaining([
        'analysis.request.received',
        'analysis.request.validated',
        'analysis.connection.probe-succeeded',
        'analysis.run.queued',
        'analysis.run.started',
        'analysis.run.dispatching',
        'analysis.run.failed',
      ]),
    )
    expect(
      JSON.parse(
        lines.find((line) => JSON.parse(line).event === 'analysis.run.failed')!,
      ).httpStatus,
    ).toBe(503)
    expect(lines.join('\n')).not.toContain(validSriInvoice)
    expect(lines.join('\n')).not.toContain('env:')
  })

  it('logs only allowlisted Agents failure diagnostics', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const lines: string[] = []
    const app = createLocalDaemon(
      library,
      () => ({ ok: true }),
      () => ({
        probe: async () => ({ ok: true as const }),
        analyze: async () => ({
          ok: false as const,
          cause: 'invalid-output' as const,
          message: 'El modelo local devolvió una salida estructurada inválida.',
          agentsErrorKind: 'model-timeout' as const,
          agentsTimeoutMs: 1234,
        }),
      }),
      createLocalDaemonLogger('debug', (line) => lines.push(line)),
    )
    const connection = await app.request('/api/v1/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'GPU local',
        apiFlavor: 'openai-like',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'modelo',
        makeDefault: true,
      }),
    })
    const collection = await app.request('/api/v1/collections', {
      method: 'POST',
    })
    const collectionId = ((await collection.json()) as { id: string }).id
    await configurePersonalExpensesContext(app, collectionId)
    const invoice = await app.request(
      `/api/v1/collections/${collectionId}/invoices/xml`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }),
      },
    )
    await app.request('/api/v1/analysis', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        invoiceId: ((await invoice.json()) as { invoiceId: string }).invoiceId,
        collectionId,
        connectionId: ((await connection.json()) as { id: string }).id,
      }),
    })
    await Bun.sleep(0)

    const failed = JSON.parse(
      lines.find((line) => JSON.parse(line).event === 'analysis.run.failed')!,
    )
    expect(failed).toMatchObject({
      agentsErrorKind: 'model-timeout',
      agentsTimeoutMs: 1234,
    })
    for (const unsafeKey of ['message', 'refusal', 'stack', 'state', 'output'])
      expect(failed).not.toHaveProperty(unsafeKey)
    expect(JSON.stringify(failed)).not.toContain(validSriInvoice)
  })

  it('serves operational run events only through the owning collection', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const app = createLocalDaemon(library)
    const collectionA = await app.request('/api/v1/collections', {
      method: 'POST',
    })
    const collectionB = await app.request('/api/v1/collections', {
      method: 'POST',
    })
    const collectionAId = ((await collectionA.json()) as { id: string }).id
    const collectionBId = ((await collectionB.json()) as { id: string }).id
    const runA = library.createRun({
      invoiceId: crypto.randomUUID(),
      collectionId: collectionAId,
      connectionId: crypto.randomUUID(),
      rulesetId: 'local-ruleset',
    })
    const runB = library.createRun({
      invoiceId: crypto.randomUUID(),
      collectionId: collectionBId,
      connectionId: crypto.randomUUID(),
      rulesetId: 'local-ruleset',
    })
    library.startRun(runA.id)

    const ownDetail = await app.request(
      `/api/v1/collections/${collectionAId}/runs/${runA.id}`,
    )
    expect(ownDetail.status).toBe(200)
    const ownBody = (await ownDetail.json()) as {
      id: string
      collectionId: string
      events: Array<{ runId: string; status: string }>
    }
    expect(ownBody.id).toBe(runA.id)
    expect(ownBody.collectionId).toBe(collectionAId)
    expect(ownBody).not.toHaveProperty('result')
    expect(ownBody.events[0]).toMatchObject({
      runId: runA.id,
      status: 'queued',
    })

    const foreignDetail = await app.request(
      `/api/v1/collections/${collectionAId}/runs/${runB.id}`,
    )
    expect(foreignDetail.status).toBe(404)
    expect(await foreignDetail.json()).toEqual({ code: 'RUN_NOT_FOUND' })
  })

  it('projects frozen run metadata without exposing snapshots and keeps collection ownership', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const app = createLocalDaemon(library)
    const collectionAId = (
      (await (
        await app.request('/api/v1/collections', { method: 'POST' })
      ).json()) as { id: string }
    ).id
    const collectionBId = (
      (await (
        await app.request('/api/v1/collections', { method: 'POST' })
      ).json()) as { id: string }
    ).id
    const run = library.createRun({
      invoiceId: crypto.randomUUID(),
      collectionId: collectionAId,
      connectionId: crypto.randomUUID(),
      rulesetId: 'ruleset-now',
      snapshot: {
        invoice: {
          xml: '<factura>privada</factura>',
          contentHash: 'no-publicar',
          objectPath: '/privado.xml',
        },
        collectionContext: {
          id: 'frozen-context',
          revision: 4,
          purpose: 'personal_expenses',
          period: { startDate: '2026-01-01', endDate: '2026-01-31' },
        },
        connection: {
          id: crypto.randomUUID(),
          label: 'GPU congelada',
          apiFlavor: 'openai-like',
          baseUrl: 'http://private-host/v1',
          model: 'qwen-frozen',
          secretRef: 'env:PRIVATE',
        },
        ruleset: {
          id: 'ruleset-frozen',
          version: '2026.3',
          jurisdiction: 'EC',
        },
      },
    })
    library.startRun(run.id)
    library.failRun(
      run.id,
      'La ejecución congelada falló en http://private-host/v1 env:PRIVATE /tmp/privado.',
    )

    const listed = await app.request(
      `/api/v1/collections/${collectionAId}/runs`,
    )
    expect(listed.status).toBe(200)
    const body = (await listed.json()) as {
      items: Array<Record<string, unknown>>
    }
    expect(body.items[0]).toMatchObject({
      id: run.id,
      provider: 'GPU congelada',
      model: 'qwen-frozen',
      purpose: 'personal_expenses',
      contextRevision: 4,
    })
    expect(JSON.stringify(body)).not.toContain('private-host')
    expect(JSON.stringify(body)).not.toContain('PRIVATE')
    expect(JSON.stringify(body)).not.toContain('no-publicar')
    expect(JSON.stringify(body)).not.toContain('<factura>')
    expect(
      (await app.request(`/api/v1/collections/${collectionBId}/runs/${run.id}`))
        .status,
    ).toBe(404)
    expect(
      (await app.request('/api/v1/runs?status=failed&unread=true')).status,
    ).toBe(200)
  })

  it('makes run read and clear mutations idempotent without hiding active runs', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const app = createLocalDaemon(library)
    const failed = library.createRun({
      invoiceId: crypto.randomUUID(),
      connectionId: crypto.randomUUID(),
      rulesetId: 'local-ruleset',
    })
    library.failRun(failed.id, 'Falló.')
    const queued = library.createRun({
      invoiceId: crypto.randomUUID(),
      connectionId: crypto.randomUUID(),
      rulesetId: 'local-ruleset',
    })

    expect(
      await (
        await app.request(`/api/v1/runs/${failed.id}/read`, { method: 'PATCH' })
      ).json(),
    ).toEqual({ changed: 1 })
    expect(
      await (
        await app.request(`/api/v1/runs/${failed.id}/read`, { method: 'PATCH' })
      ).json(),
    ).toEqual({ changed: 0 })
    const clear = await app.request('/api/v1/runs/clear-eligible', {
      method: 'POST',
    })
    expect(await clear.json()).toEqual({ changed: 0 })
    const changed = await app.request('/api/v1/runs/read-all', {
      method: 'PATCH',
    })
    expect(await changed.json()).toEqual({ changed: 1 })
    const visible = await app.request('/api/v1/runs?status=queued')
    expect(
      ((await visible.json()) as { items: Array<{ id: string }> }).items,
    ).toMatchObject([{ id: queued.id }])
    expect(
      await (await app.request(`/api/v1/runs/${failed.id}`)).json(),
    ).toMatchObject({ id: failed.id, status: 'failed' })
  })

  it('persists nullable collection descriptions and serves parsed invoice detail before analysis', async () => {
    const root = mkdtempSync(join(tmpdir(), 'bill-lm-local-'))
    const first = new LocalLibrary(root)
    const app = createLocalDaemon(first)
    const created = await app.request('/api/v1/collections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '2026 personal',
        year: 2026,
        description: null,
      }),
    })
    const collectionId = ((await created.json()) as { id: string }).id
    const patched = await app.request(`/api/v1/collections/${collectionId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'Comprobantes personales' }),
    })
    expect(await patched.json()).toMatchObject({
      description: 'Comprobantes personales',
    })
    const imported = await app.request(
      `/api/v1/collections/${collectionId}/invoices/xml`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }),
      },
    )
    const invoiceId = ((await imported.json()) as { invoiceId: string })
      .invoiceId
    const invoice = await app.request(
      `/api/v1/collections/${collectionId}/invoices/${invoiceId}`,
    )
    expect(await invoice.json()).toMatchObject({
      fileName: 'factura.xml',
      seller: { name: 'Proveedor' },
      buyer: { name: 'Comprador' },
      totals: {
        subtotal: '10.00',
        tax: '0.00',
        total: '10.00',
        currency: 'DOLAR',
      },
      taxes: [{ code: '2', rate: '0', taxableBase: '10.00', amount: '0.00' }],
      latestAnalysis: null,
    })
    first.close()
    const restarted = new LocalLibrary(root)
    libraries.push(restarted)
    expect(restarted.getCollectionMetadata(collectionId)).toMatchObject({
      description: 'Comprobantes personales',
    })
  })

  it('invalidates a stored probe after an execution-affecting connection edit', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const app = createLocalDaemon(library)
    const connection = await app.request('/api/v1/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'GPU',
        apiFlavor: 'openai-like',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'modelo',
        makeDefault: true,
      }),
    })
    const id = ((await connection.json()) as { id: string }).id
    library.recordProbe(id, { ok: true })
    const changed = await app.request(`/api/v1/connections/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'modelo-nuevo' }),
    })
    expect(await changed.json()).toMatchObject({
      lastProbedAt: null,
      lastProbeError: null,
    })
  })

  it('does not persist a deferred probe after its connection is edited or deleted', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    let resolveProbe!: (value: { ok: boolean }) => void
    const app = createLocalDaemon(
      library,
      () =>
        new Promise((resolve) => {
          resolveProbe = resolve
        }),
    )
    const created = await app.request('/api/v1/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'GPU',
        apiFlavor: 'openai-like',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'modelo',
        makeDefault: true,
      }),
    })
    const id = ((await created.json()) as { id: string }).id
    const pending = app.request(`/api/v1/connections/${id}/probe`, {
      method: 'POST',
    })
    await app.request(`/api/v1/connections/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        baseUrl: 'http://127.0.0.1:5678/v1',
        model: 'modelo-nuevo',
      }),
    })
    resolveProbe({ ok: true })
    expect((await pending).status).toBe(409)
    expect(library.getConnection(id)).toMatchObject({
      lastProbedAt: null,
      lastProbeError: null,
      baseUrl: 'http://127.0.0.1:5678/v1',
      model: 'modelo-nuevo',
    })
    const deleted = await app.request(`/api/v1/connections/${id}`, {
      method: 'DELETE',
    })
    expect(deleted.status).toBe(204)
    expect(library.recordProbe(id, { ok: true })).toBeFalse()
  })

  it('uses distinct OpenAI-like and Claude-like wire contracts without leaking secrets', async () => {
    const connection = {
      id: crypto.randomUUID(),
      label: 'GPU',
      baseUrl: 'http://gpu.test/v1',
      model: 'qwen',
      isDefault: false,
      lastProbedAt: null,
      lastProbeError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      secretRef: 'env:LOCAL_GPU_TEST_SECRET',
    }
    process.env.LOCAL_GPU_TEST_SECRET = 'fixture-secret'
    const requests: Array<{ url: URL; init?: RequestInit }> = []
    const fetchFixture = (async (
      input: URL | RequestInfo,
      init?: RequestInit,
    ) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      requests.push({ url, init })
      const isClaude = url.hostname === 'claude.test'
      const body = isClaude
        ? { content: [{ type: 'text', text: JSON.stringify(validPayload) }] }
        : {
            choices: [
              {
                message: { content: JSON.stringify({ payload: validPayload }) },
              },
            ],
          }
      return new Response(
        JSON.stringify(url.pathname.endsWith('/models') ? { data: [] } : body),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      )
    }) as typeof fetch
    const openai = createLocalLlmAdapter(
      { ...connection, apiFlavor: 'openai-like' },
      fetchFixture,
    )
    await openai.probe({ ...connection, apiFlavor: 'openai-like' })
    const openaiResult = await openai.analyze({
      connection: { ...connection, apiFlavor: 'openai-like' },
      runId: crypto.randomUUID(),
      prompt: 'JSON',
      outputSchema: { type: 'object' },
      purpose: 'personal_expenses',
    })
    const claudeConnection = {
      ...connection,
      baseUrl: 'http://claude.test',
      apiFlavor: 'claude-like' as const,
    }
    const claude = createLocalLlmAdapter(claudeConnection, fetchFixture)
    await claude.probe(claudeConnection)
    const claudeResult = await claude.analyze({
      connection: claudeConnection,
      runId: crypto.randomUUID(),
      prompt: 'JSON',
      outputSchema: { type: 'object' },
    })
    expect(openaiResult).toEqual({ ok: true, payload: validPayload })
    expect(claudeResult).toEqual({ ok: true, payload: validPayload })
    expect(requests.map(({ url }) => url.pathname)).toEqual([
      '/v1/models',
      '/v1/chat/completions',
      '/v1/models',
      '/v1/messages',
    ])
    expect(
      Object.fromEntries(new Headers(requests[1].init?.headers).entries()),
    ).toMatchObject({
      authorization: 'Bearer fixture-secret',
      'content-type': 'application/json',
    })
    expect(requests[3].init?.headers).toMatchObject({
      'x-api-key': 'fixture-secret',
      'anthropic-version': '2023-06-01',
    })
    expect(JSON.parse(String(requests[1].init?.body))).toMatchObject({
      max_tokens: 20_480,
      metadata: { enable_thinking: 'false' },
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'local_tax_analysis_personal_expenses',
          strict: true,
          schema: {
            type: 'object',
            properties: { payload: expect.any(Object) },
            required: ['payload'],
            additionalProperties: false,
          },
        },
      },
    })
    expect(
      JSON.stringify(requests.map(({ init }) => init?.body)),
    ).not.toContain('fixture-secret')
  })

  it('rejects Markdown-wrapped output through the Agents structured-output boundary without logging it', async () => {
    const connection = {
      id: crypto.randomUUID(),
      label: 'GPU',
      baseUrl: 'http://gpu.test/v1',
      model: 'qwen',
      apiFlavor: 'openai-like' as const,
      isDefault: false,
      lastProbedAt: null,
      lastProbeError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const adapter = createLocalLlmAdapter(
      connection,
      (async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: `El resultado estructurado es:\n\n\`\`\`json\n${JSON.stringify(validPayload)}\n\`\`\``,
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )) as unknown as typeof fetch,
    )

    const result = await adapter.analyze({
      connection,
      runId: crypto.randomUUID(),
      prompt: 'No registrar este prompt.',
      outputSchema: { type: 'object' },
    })

    expect(result).toEqual({
      ok: false,
      cause: 'invalid-output',
      message: 'El modelo local devolvió una salida estructurada inválida.',
      agentsErrorKind: 'model-behavior',
    })
  })

  it('rejects a reasoning-only OpenAI-like response through the Agents structured-output boundary', async () => {
    const connection = {
      id: crypto.randomUUID(),
      label: 'GPU',
      baseUrl: 'http://gpu.test/v1',
      model: 'qwen',
      apiFlavor: 'openai-like' as const,
      isDefault: false,
      lastProbedAt: null,
      lastProbeError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const adapter = createLocalLlmAdapter(
      connection,
      (async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  reasoning_content: 'No registrar este razonamiento.',
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )) as unknown as typeof fetch,
    )

    const result = await adapter.analyze({
      connection,
      runId: crypto.randomUUID(),
      prompt: 'No registrar este prompt.',
      outputSchema: { type: 'object' },
    })

    expect(result).toEqual({
      ok: false,
      cause: 'invalid-output',
      message: 'El modelo local devolvió una salida estructurada inválida.',
      agentsErrorKind: 'max-turns',
    })
  })

  it('reports a safe failure when Agents receives non-JSON output', async () => {
    const connection = {
      id: crypto.randomUUID(),
      label: 'GPU',
      baseUrl: 'http://gpu.test/v1',
      model: 'qwen',
      apiFlavor: 'openai-like' as const,
      isDefault: false,
      lastProbedAt: null,
      lastProbeError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const adapter = createLocalLlmAdapter(
      connection,
      (async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: 'stop',
                message: { content: 'No registrar este texto del modelo.' },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )) as unknown as typeof fetch,
    )

    const result = await adapter.analyze({
      connection,
      runId: crypto.randomUUID(),
      prompt: 'No registrar este prompt.',
      outputSchema: { type: 'object' },
    })

    expect(result).toEqual({
      ok: false,
      cause: 'invalid-output',
      message: 'El modelo local devolvió una salida estructurada inválida.',
      agentsErrorKind: 'model-behavior',
    })
    expect(JSON.stringify(result)).not.toContain(
      'No registrar este texto del modelo.',
    )
  })

  it('classifies official Agents errors without returning their untrusted details', () => {
    const secret = 'NO_REGISTRAR_PROMPT_XML_REFUSAL_CAUSA'
    const cases: Array<[unknown, Record<string, unknown>]> = [
      [new ModelBehaviorError(secret), { agentsErrorKind: 'model-behavior' }],
      [
        new ModelRefusalError(secret, {} as never),
        { agentsErrorKind: 'model-refusal' },
      ],
      [new MaxTurnsExceededError(secret), { agentsErrorKind: 'max-turns' }],
      [
        new ModelTimeoutError({ timeoutMs: 1234, cause: new Error(secret) }),
        { agentsErrorKind: 'model-timeout', agentsTimeoutMs: 1234 },
      ],
      [new SystemError(secret), { agentsErrorKind: 'system' }],
      [new Error(secret), { agentsErrorKind: 'other' }],
    ]
    for (const [error, diagnosis] of cases) {
      const result = openAiAgentsFailure(error)
      expect(result).toEqual({
        ok: false,
        cause: 'invalid-output',
        message: 'El modelo local devolvió una salida estructurada inválida.',
        ...diagnosis,
      })
      expect(JSON.stringify(result)).not.toContain(secret)
    }
    for (const timeoutMs of [0, -1, Number.NaN, 1.5, 3_600_001]) {
      const result = openAiAgentsFailure(
        new ModelTimeoutError({ timeoutMs, cause: new Error(secret) }),
      )
      expect(result).toEqual({
        ok: false,
        cause: 'invalid-output',
        message: 'El modelo local devolvió una salida estructurada inválida.',
        agentsErrorKind: 'model-timeout',
      })
    }
  })

  it('derives strict structured output from the local Zod contract without widening its limits', () => {
    const properties = LocalTaxAnalysisOutputJsonSchema.properties as Record<
      string,
      Record<string, unknown>
    >
    expect(LocalTaxAnalysisOutputJsonSchema).toMatchObject({
      type: 'object',
      additionalProperties: false,
    })
    expect(LocalTaxAnalysisOutputJsonSchema.required).toEqual(
      expect.arrayContaining([
        'purpose',
        'classification',
        'reasoning',
        'creditablePercentage',
      ]),
    )
    expect(properties.purpose).toEqual({
      type: 'string',
      enum: ['vat_credit', 'business_income_tax', 'personal_expenses'],
    })
    expect(properties.creditablePercentage).toMatchObject({
      type: ['number', 'null'],
      minimum: 0,
      maximum: 100,
    })
    expect(properties.relatedActivityRevisionIds).toMatchObject({
      type: ['array', 'null'],
      minItems: 1,
      maxItems: 20,
    })
    expect(
      omitNullOutputFields({
        purpose: 'personal_expenses',
        potentialEligibleAmount: null,
        missingEvidence: ['Falta respaldo'],
      }),
    ).toEqual({
      purpose: 'personal_expenses',
      missingEvidence: ['Falta respaldo'],
    })

    const agentPayload = LocalTaxAnalysisAgentOutputType.schema.properties
      .payload as {
      anyOf: Array<{
        properties: Record<string, unknown>
        required: string[]
        additionalProperties: boolean
      }>
    }
    expect(LocalTaxAnalysisAgentOutputType).toMatchObject({
      type: 'json_schema',
      name: 'local_tax_analysis',
      strict: true,
      schema: {
        type: 'object',
        required: ['payload'],
        additionalProperties: false,
      },
    })
    expect(agentPayload.anyOf).toHaveLength(3)
    for (const variant of agentPayload.anyOf) {
      expect(variant.additionalProperties).toBe(false)
      expect(variant.required).toEqual(Object.keys(variant.properties))
    }
    const personalPayload = localTaxAnalysisAgentOutputTypeForPurpose(
      'personal_expenses',
    ).schema.properties.payload as {
      anyOf: Array<{ properties: Record<string, unknown> }>
    }
    expect(personalPayload.anyOf).toHaveLength(1)
    expect(personalPayload.anyOf[0]?.properties).not.toHaveProperty(
      'relatedActivityRevisionIds',
    )
  })

  it('fails a created run with OAuth guidance and no persisted result when adapter output is invalid', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const app = createLocalDaemon(
      library,
      () => ({ ok: true }),
      () => ({
        probe: async () => ({ ok: true as const }),
        analyze: async () => ({
          ok: true as const,
          payload: { invalid: true },
        }),
      }),
    )
    const connection = await app.request('/api/v1/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'GPU',
        apiFlavor: 'openai-like',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'qwen',
        makeDefault: true,
      }),
    })
    expect(connection.status).toBe(201)
    const collection = await app.request('/api/v1/collections', {
      method: 'POST',
    })
    const collectionId = ((await collection.json()) as { id: string }).id
    await configurePersonalExpensesContext(app, collectionId)
    const invoice = await app.request(
      `/api/v1/collections/${collectionId}/invoices/xml`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }),
      },
    )
    const response = await app.request('/api/v1/analysis', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        invoiceId: (await invoice.json()).invoiceId,
        collectionId,
        connectionId: (
          (await (await app.request('/api/v1/connections')).json()) as {
            items: Array<{ id: string }>
          }
        ).items[0].id,
      }),
    })
    expect(response.status).toBe(202)
    const body = await response.json()
    await Bun.sleep(0)
    expect(body).toMatchObject({ status: 'queued' })
    expect(library.getRunResult(body.id)).toBeNull()
    expect(library.listRunEvents(body.id).at(-1)).toMatchObject({
      status: 'failed',
    })
  })

  it('logs only safe Zod rule metadata when structured model output is semantically invalid', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const logs: string[] = []
    const app = createLocalDaemon(
      library,
      () => ({ ok: true }),
      () => ({
        probe: async () => ({ ok: true as const }),
        analyze: async () => ({
          ok: true as const,
          payload: {
            ...validPayload,
            reasoning: '',
            missingEvidence: ['No registrar este valor del modelo.'],
          },
        }),
      }),
      createLocalDaemonLogger('debug', (line) => logs.push(line)),
    )
    await app.request('/api/v1/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'GPU',
        apiFlavor: 'openai-like',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'qwen',
        makeDefault: true,
      }),
    })
    const collection = await app.request('/api/v1/collections', {
      method: 'POST',
    })
    const collectionId = ((await collection.json()) as { id: string }).id
    await configurePersonalExpensesContext(app, collectionId)
    const invoice = await app.request(
      `/api/v1/collections/${collectionId}/invoices/xml`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }),
      },
    )
    const connectionId = (
      (await (await app.request('/api/v1/connections')).json()) as {
        items: Array<{ id: string }>
      }
    ).items[0].id
    await app.request('/api/v1/analysis', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        invoiceId: (await invoice.json()).invoiceId,
        collectionId,
        connectionId,
      }),
    })
    await Bun.sleep(0)

    const invalidOutput = logs
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((entry) => entry.event === 'analysis.run.invalid-output')
    expect(invalidOutput).toMatchObject({
      issueCount: 1,
      schemaIssuePaths: 'reasoning',
      schemaIssueCodes: 'too_small',
    })
    expect(JSON.stringify(invalidOutput)).not.toContain(
      'No registrar este valor del modelo.',
    )
  })

  it('returns a failed probe cause and OAuth guidance without creating a run', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const app = createLocalDaemon(library, () => ({
      ok: false,
      cause: 'transport',
      message: 'No se pudo conectar al servidor local.',
    }))
    await app.request('/api/v1/connections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'GPU',
        apiFlavor: 'openai-like',
        baseUrl: 'http://127.0.0.1:1234/v1',
        model: 'qwen',
        makeDefault: true,
      }),
    })
    const collection = await app.request('/api/v1/collections', {
      method: 'POST',
    })
    const collectionId = ((await collection.json()) as { id: string }).id
    await configurePersonalExpensesContext(app, collectionId)
    const invoice = await app.request(
      `/api/v1/collections/${collectionId}/invoices/xml`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: 'factura.xml', xml: validSriInvoice }),
      },
    )
    const response = await app.request('/api/v1/analysis', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        invoiceId: (await invoice.json()).invoiceId,
        collectionId,
        connectionId: (
          (await (await app.request('/api/v1/connections')).json()) as {
            items: Array<{ id: string }>
          }
        ).items[0].id,
      }),
    })
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      code: 'GPU_PROBE_FAILED',
      cause: 'transport',
      oauthGuidance: { kind: 'oauth-guidance' },
    })
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
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const app = createLocalDaemon(library)
    const activityInput = {
      displayName: 'Servicios de software',
      registeredActivityName: 'Desarrollo de software',
      activityDescription: 'Desarrollo y mantenimiento de software.',
      revenueVatTreatment: 'taxed_nonzero',
    }
    const createdActivity = await app.request('/api/v1/activities', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(activityInput),
    })
    expect(createdActivity.status).toBe(201)
    const activity = (await createdActivity.json()) as {
      id: string
      activityId: string
      revision: number
    }
    const revisedActivity = await app.request(
      `/api/v1/activities/${activity.activityId}/revisions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...activityInput,
          displayName: 'Software local',
        }),
      },
    )
    expect(revisedActivity.status).toBe(201)
    expect(await revisedActivity.json()).toMatchObject({
      activityId: activity.activityId,
      revision: 2,
    })

    const profileInput = {
      displayName: 'Biblioteca local',
      hasEmploymentIncome: false,
      hasRuc: true,
      taxRegime: 'general',
      vatFilingFrequency: 'monthly',
      activityRevisionIds: [activity.id],
    }
    const createdProfile = await app.request('/api/v1/profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(profileInput),
    })
    expect(createdProfile.status).toBe(201)
    const profile = (await createdProfile.json()) as {
      taxpayerProfileId: string
    }
    const listed = (await (await app.request('/api/v1/profiles')).json()) as {
      items: Array<{ latestRevision: { activityRevisionIds: string[] } }>
    }
    expect(listed.items).toMatchObject([
      { latestRevision: { activityRevisionIds: [activity.id] } },
    ])
    const revisedProfile = await app.request(
      `/api/v1/profiles/${profile.taxpayerProfileId}/revisions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(profileInput),
      },
    )
    expect(revisedProfile.status).toBe(201)
    expect(await revisedProfile.json()).toMatchObject({
      taxpayerProfileId: profile.taxpayerProfileId,
      revision: 2,
    })
  })

  it('maps local profile/activity validation and missing aggregates to 400 or 404', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const app = createLocalDaemon(library)
    const invalidProfile = await app.request('/api/v1/profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Inválido',
        hasEmploymentIncome: false,
        hasRuc: true,
        taxRegime: 'general',
        vatFilingFrequency: 'monthly',
        activityRevisionIds: [crypto.randomUUID()],
      }),
    })
    expect(invalidProfile.status).toBe(400)
    expect(await invalidProfile.json()).toMatchObject({
      code: 'INVALID_ACTIVITY_REVISION',
    })
    expect(
      (
        (await (await app.request('/api/v1/profiles')).json()) as {
          items: unknown[]
        }
      ).items,
    ).toHaveLength(0)
    const missingActivity = await app.request(
      `/api/v1/activities/${crypto.randomUUID()}/revisions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Ausente',
          registeredActivityName: 'Ausente',
          activityDescription: 'Ausente',
          revenueVatTreatment: 'unknown',
        }),
      },
    )
    expect(missingActivity.status).toBe(404)
    expect(await missingActivity.json()).toMatchObject({
      code: 'ACTIVITY_NOT_FOUND',
    })
  })

  it('persists scoped collection contexts with append-only revisions', async () => {
    const library = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(library)
    const app = createLocalDaemon(library)
    const activity = (await (
      await app.request('/api/v1/activities', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Actividad local',
          registeredActivityName: 'Actividad local',
          activityDescription: 'Una actividad local válida.',
          revenueVatTreatment: 'unknown',
        }),
      })
    ).json()) as { id: string }
    const profile = (await (
      await app.request('/api/v1/profiles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Perfil local',
          hasEmploymentIncome: false,
          hasRuc: true,
          taxRegime: 'general',
          vatFilingFrequency: 'monthly',
          activityRevisionIds: [activity.id],
        }),
      })
    ).json()) as { id: string }

    expect(
      (
        (await (await app.request('/api/v1/collections')).json()) as {
          items: unknown[]
        }
      ).items,
    ).toHaveLength(0)
    const created = await app.request('/api/v1/collections', { method: 'POST' })
    expect(created.status).toBe(201)
    const collection = (await created.json()) as {
      id: string
      latestRevision: null
    }
    expect(collection.latestRevision).toBeNull()

    const input = {
      purpose: 'vat_credit',
      period: { startDate: '2026-01-01', endDate: '2026-01-31' },
      taxpayerProfileRevisionId: profile.id,
      activityRevisionIds: [activity.id],
      notes: 'Enero local',
    }
    const first = await app.request(
      `/api/v1/collections/${collection.id}/revisions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    )
    expect(first.status).toBe(201)
    expect(await first.json()).toMatchObject({
      collectionId: collection.id,
      revision: 1,
    })
    const second = await app.request(
      `/api/v1/collections/${collection.id}/revisions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...input, notes: 'Revisión local' }),
      },
    )
    expect(second.status).toBe(201)
    expect(await second.json()).toMatchObject({
      collectionId: collection.id,
      revision: 2,
    })
    const listed = (await (
      await app.request('/api/v1/collections')
    ).json()) as {
      items: Array<{
        id: string
        latestRevision: { revision: number; notes?: string }
      }>
    }
    expect(listed.items).toMatchObject([
      {
        id: collection.id,
        latestRevision: { revision: 2, notes: 'Revisión local' },
      },
    ])

    const invalid = await app.request(
      `/api/v1/collections/${collection.id}/revisions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...input,
          taxpayerProfileRevisionId: crypto.randomUUID(),
        }),
      },
    )
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toMatchObject({
      code: 'INVALID_COLLECTION_CONTEXT',
    })
    const duplicateActivityReference = await app.request(
      `/api/v1/collections/${collection.id}/revisions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...input,
          activityRevisionIds: [activity.id, activity.id],
        }),
      },
    )
    expect(duplicateActivityReference.status).toBe(400)
    expect(await duplicateActivityReference.json()).toMatchObject({
      code: 'INVALID_COLLECTION_CONTEXT',
    })

    const anotherLibrary = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(anotherLibrary)
    const anotherApp = createLocalDaemon(anotherLibrary)
    const foreignActivity = (await (
      await anotherApp.request('/api/v1/activities', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Actividad ajena',
          registeredActivityName: 'Actividad ajena',
          activityDescription: 'Una actividad de otra biblioteca.',
          revenueVatTreatment: 'unknown',
        }),
      })
    ).json()) as { id: string }
    const foreignProfile = (await (
      await anotherApp.request('/api/v1/profiles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Perfil ajeno',
          hasEmploymentIncome: false,
          hasRuc: true,
          taxRegime: 'general',
          vatFilingFrequency: 'monthly',
          activityRevisionIds: [foreignActivity.id],
        }),
      })
    ).json()) as { id: string }
    const crossLibrary = await app.request(
      `/api/v1/collections/${collection.id}/revisions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...input,
          taxpayerProfileRevisionId: foreignProfile.id,
          activityRevisionIds: [foreignActivity.id],
        }),
      },
    )
    expect(crossLibrary.status).toBe(400)
    expect(await crossLibrary.json()).toMatchObject({
      code: 'INVALID_COLLECTION_CONTEXT',
    })
    expect(
      (
        (await (await app.request('/api/v1/collections')).json()) as {
          items: Array<{
            id: string
            latestRevision: { revision: number; notes?: string }
          }>
        }
      ).items,
    ).toMatchObject([
      {
        id: collection.id,
        latestRevision: { revision: 2, notes: 'Revisión local' },
      },
    ])
    const missing = await app.request(
      `/api/v1/collections/${crypto.randomUUID()}/revisions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    )
    expect(missing.status).toBe(404)
    expect(await missing.json()).toMatchObject({ code: 'COLLECTION_NOT_FOUND' })

    const rootPath = library.rootPath
    library.close()
    libraries.splice(libraries.indexOf(library), 1)
    const restarted = new LocalLibrary(rootPath)
    libraries.push(restarted)
    expect(
      (
        (await (
          await createLocalDaemon(restarted).request('/api/v1/collections')
        ).json()) as {
          items: Array<{
            id: string
            latestRevision: { revision: number; notes?: string }
          }>
        }
      ).items,
    ).toMatchObject([
      {
        id: collection.id,
        latestRevision: { revision: 2, notes: 'Revisión local' },
      },
    ])
    const isolated = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(isolated)
    expect(
      (
        (await (
          await createLocalDaemon(isolated).request('/api/v1/collections')
        ).json()) as { items: unknown[] }
      ).items,
    ).toHaveLength(0)
  })

  it('persists the implicit library identity across restart and isolates another library', async () => {
    const firstRoot = mkdtempSync(join(tmpdir(), 'bill-lm-local-'))
    const first = new LocalLibrary(firstRoot)
    libraries.push(first)
    const firstApp = createLocalDaemon(first)
    const created = await firstApp.request('/api/v1/activities', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Propia',
        registeredActivityName: 'Propia',
        activityDescription: 'Actividad propia',
        revenueVatTreatment: 'unknown',
      }),
    })
    expect(created.status).toBe(201)
    const persistedScope = first.actorScope().userId
    first.close()
    libraries.splice(libraries.indexOf(first), 1)
    const restarted = new LocalLibrary(firstRoot)
    libraries.push(restarted)
    expect(restarted.actorScope().userId).toBe(persistedScope)
    expect(
      (
        (await (
          await createLocalDaemon(restarted).request('/api/v1/activities')
        ).json()) as { items: unknown[] }
      ).items,
    ).toHaveLength(1)

    const isolated = new LocalLibrary(
      mkdtempSync(join(tmpdir(), 'bill-lm-local-')),
    )
    libraries.push(isolated)
    expect(
      (
        (await (
          await createLocalDaemon(isolated).request('/api/v1/activities')
        ).json()) as { items: unknown[] }
      ).items,
    ).toHaveLength(0)
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
