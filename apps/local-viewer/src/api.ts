import {
  CollectionContextRevisionInputSchema,
  CreateLocalConnectionSchema,
  EconomicActivityRevisionInputSchema,
  LocalConnectionSchema,
  TaxpayerProfileRevisionInputSchema,
} from '@bill-lm/contracts'

import type {
  CollectionContextRevisionInput,
  CreateLocalConnection,
  EconomicActivityRevisionInput,
  LocalConnection,
  TaxpayerProfileRevisionInput,
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

export type LocalCollectionContext = {
  id: string
  latestRevision: (CollectionContextRevisionInput & {
    id: string
    collectionId: string
    revision: number
    createdAt: string
  }) | null
}

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
    return ((await response.json()) as { items: Array<LocalCollectionContext> }).items
  }

  async createCollection(): Promise<LocalCollectionContext> {
    const response = await this.request(`${apiPrefix}/collections`, {
      method: 'POST',
    })
    return (await response.json()) as LocalCollectionContext
  }

  async reviseCollection(id: string, input: CollectionContextRevisionInput) {
    const response = await this.request(`${apiPrefix}/collections/${id}/revisions`, {
      method: 'POST',
      body: JSON.stringify(CollectionContextRevisionInputSchema.parse(input)),
    })
    return (await response.json()) as NonNullable<LocalCollectionContext['latestRevision']>
  }

  async listConnections(): Promise<Array<LocalConnection>> {
    const response = await this.request(`${apiPrefix}/connections`)
    const body = (await response.json()) as { items: Array<unknown> }
    return body.items.map((item) => LocalConnectionSchema.parse(item))
  }

  async createConnection(input: CreateLocalConnection) {
    const response = await this.request(`${apiPrefix}/connections`, {
      method: 'POST',
      body: JSON.stringify(CreateLocalConnectionSchema.parse(input)),
    })
    return LocalConnectionSchema.parse(await response.json())
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

  async listRuns() {
    const response = await this.request(`${apiPrefix}/runs`)
    return (await response.json()) as {
      items: Array<{ id: string; status: string; createdAt: string }>
    }
  }

  async analyze(invoiceId: string) {
    const response = await this.request(`${apiPrefix}/analysis`, {
      method: 'POST',
      body: JSON.stringify({ invoiceId }),
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

  private async request(path: string, init?: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    })
    if (!response.ok) throw new Error(await response.text())
    return response
  }
}
