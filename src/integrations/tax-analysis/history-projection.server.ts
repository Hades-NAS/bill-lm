import {
  AnalysisExecutionEnvelopeSchema,
  TaxAnalysisResultSchema,
} from '#/schema/tax-analysis'

import type { TaxAnalysisResult } from '#/schema/tax-analysis'

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
  if (typeof result.createdAt === 'string')
    result.createdAt = new Date(result.createdAt)
  return TaxAnalysisResultSchema.safeParse(result)
}

/**
 * Projects an analysis result for the authenticated collection history.
 *
 * The persisted contract carries identifiers and hashes needed for audit and
 * reproducibility. They are intentionally not part of the browser response:
 * the drawer only needs the human-readable conclusion and provenance.
 */
function projectSafeSpecializedResult(result: TaxAnalysisResult) {
  const base = {
    purpose: result.purpose,
    classification: result.classification,
    reasoning: result.reasoning,
    uncertainties: result.uncertainties,
    advisoryNotice: result.advisoryNotice,
    references: {
      official: result.references.official.map(({ articleOrSection }) => ({
        articleOrSection,
      })),
    },
  }

  switch (result.purpose) {
    case 'vat_credit':
      return {
        ...base,
        purpose: 'vat_credit' as const,
        invoiceVatAmount: result.invoiceVatAmount,
        potentialCreditableVatAmount: result.potentialCreditableVatAmount,
        creditablePercentage: result.creditablePercentage,
        creditType: result.creditType,
        proportionalityRequired: result.proportionalityRequired,
        missingEvidence: result.missingEvidence,
      }
    case 'business_income_tax':
      return {
        ...base,
        purpose: 'business_income_tax' as const,
        businessUsePercentage: result.businessUsePercentage,
        potentialExpenseAmount: result.potentialExpenseAmount,
        mixedUseDetected: result.mixedUseDetected,
        substantiationIssues: result.substantiationIssues,
        missingEvidence: result.missingEvidence,
      }
    case 'personal_expenses':
      return {
        ...base,
        purpose: 'personal_expenses' as const,
        personalExpenseCategory: result.personalExpenseCategory,
        potentialEligibleAmount: result.potentialEligibleAmount,
        beneficiaryRelationship: result.beneficiaryRelationship,
        missingEvidence: result.missingEvidence,
      }
  }
}

function projectResult(row: ResultRow) {
  const parsed = parseResultSnapshot(row.resultSnapshot)
  if (!parsed.success)
    return {
      purpose: row.purpose,
      classification: row.classification,
      createdAt: row.createdAt,
      status: 'unavailable' as const,
      message: 'El resultado histórico no pudo validarse.',
    }

  return {
    purpose: row.purpose,
    classification: row.classification,
    createdAt: row.createdAt,
    status: 'available' as const,
    result: projectSafeSpecializedResult(parsed.data),
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
    execution: envelope.execution,
    prompt: {
      templateId: envelope.prompt.templateId,
      templateVersion: envelope.prompt.templateVersion,
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
      effectiveFrom: envelope.ruleset.effectiveFrom,
      effectiveTo: envelope.ruleset.effectiveTo,
    },
    officialEvidence: envelope.officialEvidence.map((evidence) => ({
      source: {
        title: evidence.source.title,
        issuer: evidence.source.issuer,
        officialUrl: evidence.source.officialUrl,
      },
      articleOrSection: evidence.articleOrSection,
      effectiveFrom: evidence.effectiveFrom,
      effectiveTo: evidence.effectiveTo,
    })),
    invoiceCount: envelope.invoices.length,
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
    executionMode:
      context.status === 'available' ? context.execution.mode : null,
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
