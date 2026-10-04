import {
  CollectionContextRevisionInputSchema,
  CreateLocalCollectionInputSchema,
  CreateLocalConnectionSchema,
  UpdateLocalConnectionSchema,
  EconomicActivityRevisionInputSchema,
  LocalConnectionResponseSchema,
  LocalCollectionInvoiceInputSchema,
  LocalCollectionInvoiceMembershipSchema,
  LocalCollectionRunDetailSchema,
  LocalInvoiceDetailSchema,
  LocalRunDetailSchema,
  LocalRunSummarySchema,
  LocalCollectionDetailSchema,
  LocalCollectionSummarySchema,
  TaxpayerProfileRevisionInputSchema,
  UpdateLocalCollectionInputSchema,
} from '@bill-lm/contracts'

import type {
  CollectionContextRevisionInput,
  CreateLocalCollectionInput,
  CreateLocalConnection,
  UpdateLocalConnection,
  EconomicActivityRevisionInput,
  LocalConnectionResponse,
  LocalCollectionDetail,
  LocalCollectionSummary,
  LocalCollectionInvoiceMembership,
  LocalCollectionRunDetail,
  LocalInvoiceDetail,
  LocalRunDetail,
  LocalRunSummary,
  TaxpayerProfileRevisionInput,
  UpdateLocalCollectionInput,
} from '@bill-lm/contracts'

const apiPrefix = '/api/v1'

export type LocalRuleset = {
  id: string
  version: string
  jurisdiction: string
  effectiveFrom: string
  effectiveTo: string | null
  sourceCount: number
}

export type LocalOfficialSource = {
  id: string
  title: string
  issuer: string
  jurisdiction: string
  sourceKind: string
  officialUrl: string | null
  resolvedUrl: string | null
  contentHash: string | null
  effectiveFrom: string | null
  effectiveTo: string | null
  reviewStatus: string
  sectionCount: number
}

export type LocalOfficialSourceDetail = LocalOfficialSource & {
  fragments: Array<{
    id: string
    articleOrSection: string
    effectiveFrom: string | null
    effectiveTo: string | null
    purposes: Array<string>
    taxRegimes: Array<string>
    reviewStatus: string
    contentMarkdown: string | null
    sourcePages: Array<number>
  }>
  ruleset: { id: string; version: string; jurisdiction: string; reviewStatus: 'local-snapshot' }
}

export type LocalLibrarySummary = {
  invoiceCount: number
  collectionCount: number
  profileCount: number
  activityCount: number
  runCount: number
  ruleset: Pick<LocalRuleset, 'id' | 'version' | 'effectiveFrom' | 'effectiveTo'> | null
}

export type LocalEconomicActivity = {
  id: string
  latestRevision: EconomicActivityRevisionInput & {
    id: string
    activityId: string
    revision: number
    createdAt: string
  }
}

export type LocalTaxpayerProfile = {
  id: string
  latestRevision: TaxpayerProfileRevisionInput & {
    id: string
    taxpayerProfileId: string
    revision: number
    createdAt: string
  }
}

export type LocalCollectionContext = LocalCollectionSummary

export type LocalCollectionXmlImportResult =
  | { kind: 'imported' | 'duplicate'; invoiceId?: string; membership?: LocalCollectionInvoiceMembership }
  | { kind: 'invalid-xml'; message: string }

export class LocalDaemonClient {
  constructor(private readonly baseUrl = '') {}

  async listActivities(): Promise<Array<LocalEconomicActivity>> {
    const response = await this.request(`${apiPrefix}/activities`)
    return ((await response.json()) as { items: Array<LocalEconomicActivity> }).items
  }

  async createActivity(input: EconomicActivityRevisionInput) {
    const response = await this.request(`${apiPrefix}/activities`, {
      method: 'POST',
      body: JSON.stringify(EconomicActivityRevisionInputSchema.parse(input)),
    })
    return (await response.json()) as LocalEconomicActivity['latestRevision']
  }

  async reviseActivity(id: string, input: EconomicActivityRevisionInput) {
    const response = await this.request(`${apiPrefix}/activities/${id}/revisions`, {
      method: 'POST',
      body: JSON.stringify(EconomicActivityRevisionInputSchema.parse(input)),
    })
    return (await response.json()) as LocalEconomicActivity['latestRevision']
  }

  async listProfiles(): Promise<Array<LocalTaxpayerProfile>> {
    const response = await this.request(`${apiPrefix}/profiles`)
    return ((await response.json()) as { items: Array<LocalTaxpayerProfile> }).items
  }

  async createProfile(input: TaxpayerProfileRevisionInput) {
    const response = await this.request(`${apiPrefix}/profiles`, {
      method: 'POST',
      body: JSON.stringify(TaxpayerProfileRevisionInputSchema.parse(input)),
    })
    return (await response.json()) as LocalTaxpayerProfile['latestRevision']
  }

  async reviseProfile(id: string, input: TaxpayerProfileRevisionInput) {
    const response = await this.request(`${apiPrefix}/profiles/${id}/revisions`, {
      method: 'POST',
      body: JSON.stringify(TaxpayerProfileRevisionInputSchema.parse(input)),
    })
    return (await response.json()) as LocalTaxpayerProfile['latestRevision']
  }

  async listCollections(): Promise<Array<LocalCollectionContext>> {
    const response = await this.request(`${apiPrefix}/collections`)
    const body = (await response.json()) as { items: Array<unknown> }
    return body.items.map((item) => {
      const legacy = item as Partial<LocalCollectionContext>
      return LocalCollectionSummarySchema.parse({
        ...legacy,
        // A viewer upgraded ahead of its daemon still keeps legacy collections readable.
        name: legacy.name ?? 'Colección local sin nombre',
        year: legacy.year ?? new Date().getFullYear(),
        invoiceCount: legacy.invoiceCount ?? 0,
      })
    })
  }

  async createCollection(input: CreateLocalCollectionInput): Promise<LocalCollectionContext> {
    const response = await this.request(`${apiPrefix}/collections`, {
      method: 'POST',
      body: JSON.stringify(CreateLocalCollectionInputSchema.parse(input)),
    })
    return LocalCollectionSummarySchema.parse(await response.json())
  }

  async reviseCollection(id: string, input: CollectionContextRevisionInput) {
    const response = await this.request(`${apiPrefix}/collections/${id}/revisions`, {
      method: 'POST',
      body: JSON.stringify(CollectionContextRevisionInputSchema.parse(input)),
    })
    return (await response.json()) as NonNullable<LocalCollectionContext['latestRevision']>
  }

  async updateCollection(id: string, input: UpdateLocalCollectionInput): Promise<LocalCollectionContext> {
    const response = await this.request(`${apiPrefix}/collections/${id}`, {
      method: 'PATCH', body: JSON.stringify(UpdateLocalCollectionInputSchema.parse(input)),
    })
    return LocalCollectionSummarySchema.parse(await response.json())
  }

  async getCollectionDetail(id: string): Promise<LocalCollectionDetail> {
    const response = await this.request(`${apiPrefix}/collections/${id}`)
    return LocalCollectionDetailSchema.parse(await response.json())
  }

  async getCollectionRunDetail(collectionId: string, runId: string): Promise<LocalCollectionRunDetail> {
    const response = await this.request(`${apiPrefix}/collections/${collectionId}/runs/${runId}`)
    return LocalCollectionRunDetailSchema.parse(await response.json())
  }

  async listCollectionRuns(collectionId: string, filter: { status?: string; unread?: boolean } = {}): Promise<Array<LocalRunSummary>> {
    const query = new URLSearchParams()
    if (filter.status) query.set('status', filter.status)
    if (filter.unread !== undefined) query.set('unread', String(filter.unread))
    const response = await this.request(`${apiPrefix}/collections/${collectionId}/runs${query.size ? `?${query}` : ''}`)
    return ((await response.json()) as { items: Array<unknown> }).items.map((item) => LocalRunSummarySchema.parse(item))
  }

  async getRunDetail(runId: string): Promise<LocalRunDetail> {
    return LocalRunDetailSchema.parse(await (await this.request(`${apiPrefix}/runs/${runId}`)).json())
  }

  async getCollectionInvoice(collectionId: string, invoiceId: string): Promise<LocalInvoiceDetail> {
    return LocalInvoiceDetailSchema.parse(await (await this.request(`${apiPrefix}/collections/${collectionId}/invoices/${invoiceId}`)).json())
  }

  async markRunRead(runId: string) { return (await (await this.request(`${apiPrefix}/runs/${runId}/read`, { method: 'PATCH' })).json()) as { changed: number } }
  async markAllRunsRead() { return (await (await this.request(`${apiPrefix}/runs/read-all`, { method: 'PATCH' })).json()) as { changed: number } }
  async clearEligibleRuns() { return (await (await this.request(`${apiPrefix}/runs/clear-eligible`, { method: 'POST' })).json()) as { changed: number } }

  async importCollectionXml(collectionId: string, file: File): Promise<LocalCollectionXmlImportResult> {
    const response = await fetch(`${this.baseUrl}${apiPrefix}/collections/${collectionId}/invoices/xml`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, xml: await file.text() }),
    })
    const body = await response.json().catch(() => null) as {
      kind?: unknown
      invoiceId?: unknown
      membership?: unknown
      message?: unknown
    }
    if (response.status === 400 && body?.kind === 'invalid-xml')
      return { kind: 'invalid-xml', message: typeof body.message === 'string' ? body.message : 'No se pudo leer el XML.' }
    if (!response.ok) throw new Error(typeof body?.message === 'string' ? body.message : `HTTP ${response.status}`)
    if (body?.kind !== 'imported' && body?.kind !== 'duplicate') throw new Error('Respuesta de importación local no reconocida.')
    return {
      kind: body.kind,
      invoiceId: typeof body.invoiceId === 'string' ? body.invoiceId : undefined,
      membership: body.membership ? LocalCollectionInvoiceMembershipSchema.parse(body.membership) : undefined,
    }
  }

  async attachInvoice(collectionId: string, invoiceId: string): Promise<LocalCollectionInvoiceMembership> {
    const response = await this.request(`${apiPrefix}/collections/${collectionId}/invoices`, {
      method: 'POST',
      body: JSON.stringify(LocalCollectionInvoiceInputSchema.parse({ invoiceId })),
    })
    return LocalCollectionInvoiceMembershipSchema.parse(await response.json())
  }

  async detachInvoice(collectionId: string, invoiceId: string): Promise<LocalCollectionInvoiceMembership> {
    const response = await this.request(`${apiPrefix}/collections/${collectionId}/invoices/${invoiceId}`, {
      method: 'DELETE',
    })
    return LocalCollectionInvoiceMembershipSchema.parse(await response.json())
  }

  async listConnections(): Promise<Array<LocalConnectionResponse>> {
    const response = await this.request(`${apiPrefix}/connections`)
    const body = (await response.json()) as { items: Array<unknown> }
    return body.items.map((item) => LocalConnectionResponseSchema.parse(item))
  }

  async createConnection(input: CreateLocalConnection) {
    const response = await this.request(`${apiPrefix}/connections`, {
      method: 'POST',
      body: JSON.stringify(CreateLocalConnectionSchema.parse(input)),
    })
    return LocalConnectionResponseSchema.parse(await response.json())
  }

  async updateConnection(id: string, input: UpdateLocalConnection) {
    const response = await this.request(`${apiPrefix}/connections/${id}`, {
      method: 'PATCH', body: JSON.stringify(UpdateLocalConnectionSchema.parse(input)),
    })
    return LocalConnectionResponseSchema.parse(await response.json())
  }

  async deleteConnection(id: string) {
    await this.request(`${apiPrefix}/connections/${id}`, { method: 'DELETE' })
  }

  async importXml(file: File) {
    const response = await this.request(`${apiPrefix}/invoices/xml`, {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, xml: await file.text() }),
    })
    return (await response.json()) as {
      kind?: 'imported' | 'duplicate' | 'invalid-xml'
      invoiceId?: string
      code?: string
      message?: string
    }
  }

  async probeConnection(id: string) {
    const response = await this.request(
      `${apiPrefix}/connections/${id}/probe`,
      {
        method: 'POST',
      },
    )
    return (await response.json()) as { ok: boolean; message?: string }
  }

  async listRulesets(): Promise<Array<LocalRuleset>> {
    const response = await this.request(`${apiPrefix}/rulesets`)
    return ((await response.json()) as { items: Array<LocalRuleset> }).items
  }

  async listOfficialSources(): Promise<Array<LocalOfficialSource>> {
    const response = await this.request(`${apiPrefix}/official-sources`)
    return ((await response.json()) as { items: Array<LocalOfficialSource> }).items
  }

  async getOfficialSource(id: string): Promise<LocalOfficialSourceDetail> {
    const response = await this.request(`${apiPrefix}/official-sources/${id}`)
    return (await response.json()) as LocalOfficialSourceDetail
  }

  async getLibrarySummary(): Promise<LocalLibrarySummary> {
    const response = await this.request(`${apiPrefix}/library/summary`)
    return (await response.json()) as LocalLibrarySummary
  }

  async listRuns() {
    const response = await this.request(`${apiPrefix}/runs`)
    return ((await response.json()) as { items: Array<unknown> }).items.map((item) => LocalRunSummarySchema.parse(item))
  }

  async analyze(input: { collectionId: string; connectionId: string; invoiceId: string }) {
    const response = await this.request(`${apiPrefix}/analysis`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return (await response.json()) as { id: string; status: string }
  }

  async listInvoices() {
    const response = await this.request(`${apiPrefix}/invoices`)
    return (await response.json()) as {
      items: Array<{ id: string; fileName: string; createdAt: string }>
    }
  }

  async listRunEvents(runId: string) {
    const response = await this.request(`${apiPrefix}/runs/${runId}/events`)
    return (await response.json()) as {
      items: Array<{ status: string; message: string }>
    }
  }

  async getRunResult(runId: string) {
    const response = await this.request(`${apiPrefix}/runs/${runId}/result`)
    return (await response.json()) as {
      id: string
      runId: string
      invoiceId: string
      purpose: string
      classification: string
      payload: { reasoning?: string; uncertainties?: string[] }
      createdAt: string
    }
  }

  private async request(path: string, init?: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    })
    if (!response.ok) throw new Error(await response.text())
    return response
  }
}
