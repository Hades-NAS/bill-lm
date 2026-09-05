import {
  AnalysisExecutionEnvelopeSchema,
  TaxAnalysisResultSchema,
} from '#/schema/tax-analysis'

type ResultRow = {
  billId: string
  purpose: string
  classification: string
  resultSnapshot: unknown
  createdAt: Date
}

export type AnalysisRunHistoryRow = {
  id: string
  status: string
  blockCode: string | null
  blockMessage: string | null
  provider: string | null
  modelId: string | null
  promptVersion: string
  inputSnapshot: unknown
  createdAt: Date
  completedAt: Date | null
  results: Array<ResultRow>
  _count?: { invoices: number }
}

const unavailableSnapshot = {
  status: 'unavailable' as const,
  message: 'El snapshot histórico no pudo validarse.',
}

function parseResultSnapshot(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
    return TaxAnalysisResultSchema.safeParse(snapshot)

  const result = { ...snapshot } as Record<string, unknown>
  if (typeof result.createdAt === 'string') result.createdAt = new Date(result.createdAt)
  return TaxAnalysisResultSchema.safeParse(result)
}

function projectResult(row: ResultRow) {
  const parsed = parseResultSnapshot(row.resultSnapshot)
  if (!parsed.success)
    return {
      billId: row.billId,
      purpose: row.purpose,
      classification: row.classification,
      createdAt: row.createdAt,
      status: 'unavailable' as const,
      message: 'El resultado histórico no pudo validarse.',
    }

  return {
    billId: row.billId,
    purpose: row.purpose,
    classification: row.classification,
    createdAt: row.createdAt,
    status: 'available' as const,
    result: parsed.data,
  }
}

function projectFrozenContext(snapshot: unknown) {
  const parsed = AnalysisExecutionEnvelopeSchema.safeParse(snapshot)
  if (!parsed.success) {
    if (
      snapshot &&
      typeof snapshot === 'object' &&
      !Array.isArray(snapshot) &&
      (snapshot as { blockCode?: unknown }).blockCode
    )
      return {
        status: 'blocked' as const,
        blockCode: (snapshot as { blockCode: string }).blockCode,
      }
    return unavailableSnapshot
  }

  const envelope = parsed.data
  return {
    status: 'available' as const,
    prompt: {
      templateId: envelope.prompt.templateId,
      templateVersion: envelope.prompt.templateVersion,
      templateHash: envelope.prompt.templateHash,
    },
    context: {
      revision: envelope.context.revision,
      purpose: envelope.context.purpose,
      period: envelope.context.period,
    },
    taxpayerProfile: {
      revision: envelope.taxpayerProfile.revision,
      hasRuc: envelope.taxpayerProfile.hasRuc,
      hasEmploymentIncome: envelope.taxpayerProfile.hasEmploymentIncome,
      taxRegime: envelope.taxpayerProfile.taxRegime,
      vatFilingFrequency: envelope.taxpayerProfile.vatFilingFrequency,
    },
    activities: envelope.activities.map((activity) => ({
      revision: activity.revision,
      displayName: activity.displayName,
      registeredActivityCode: activity.registeredActivityCode,
      registeredActivityName: activity.registeredActivityName,
      revenueVatTreatment: activity.revenueVatTreatment,
    })),
    provider: {
      provider: envelope.provider.provider,
      modelId: envelope.provider.modelId,
    },
    ruleset: {
      version: envelope.ruleset.version,
      contentHash: envelope.ruleset.contentHash,
      effectiveFrom: envelope.ruleset.effectiveFrom,
      effectiveTo: envelope.ruleset.effectiveTo,
    },
    officialEvidence: envelope.officialEvidence.map((evidence) => ({
      source: evidence.source,
      articleOrSection: evidence.articleOrSection,
      fragmentContentHash: evidence.fragmentContentHash,
      effectiveFrom: evidence.effectiveFrom,
      effectiveTo: evidence.effectiveTo,
    })),
    userReferences: envelope.userReferences.map((reference) => ({
      id: reference.id,
      name: reference.name,
      contentHash: reference.contentHash,
    })),
    invoices: envelope.invoices.map((invoice) => ({
      billId: invoice.billId,
      contentHash: invoice.contentHash,
      parserVersion: invoice.parserVersion,
    })),
  }
}

export function projectAnalysisRunHistoryItem(row: AnalysisRunHistoryRow) {
  const context = projectFrozenContext(row.inputSnapshot)
  return {
    id: row.id,
    status: row.status,
    blockCode: row.blockCode,
    blockMessage: row.blockMessage,
    provider: row.provider,
    modelId: row.modelId,
    promptVersion: row.promptVersion,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    invoiceCount: row._count?.invoices ?? 0,
    snapshotStatus: context.status,
    purpose: context.status === 'available' ? context.context.purpose : null,
    period: context.status === 'available' ? context.context.period : null,
    results: row.results.map(projectResult),
  }
}

export function projectAnalysisRunDetail(row: AnalysisRunHistoryRow) {
  return {
    ...projectAnalysisRunHistoryItem(row),
    frozenContext: projectFrozenContext(row.inputSnapshot),
  }
}
