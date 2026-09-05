import {
  ModelTaxAnalysisPayloadV2Schema,
  TaxAnalysisResultV2Schema,
} from '#/schema/tax-analysis-v2'

import type { AnalyzeBillOutput } from '#/schema/bill-analysis'
import type {
  AnalysisExecutionEnvelopeV2,
  ModelTaxAnalysisPayloadV2,
  TaxAnalysisResultV2,
  TaxPurpose,
} from '#/schema/tax-analysis-v2'

export const TAX_ANALYSIS_ADVISORY_NOTICE =
  'Resultado orientativo; no constituye un dictamen jurídico ni una determinación del SRI.' as const

export class TaxAnalysisResultValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaxAnalysisResultValidationError'
  }
}

export function normalizeTaxAnalysisResultV2(input: {
  payload: unknown
  purpose: TaxPurpose
  runId: string
  invoiceId: string
  allowedActivityRevisionIds: Array<string>
  references: TaxAnalysisReferences
  createdAt?: Date
}): TaxAnalysisResultV2 {
  const payload = ModelTaxAnalysisPayloadV2Schema.safeParse(input.payload)
  if (!payload.success)
    throw new TaxAnalysisResultValidationError(
      'El proveedor devolvió un resultado tributario con un formato no válido.',
    )

  if (payload.data.purpose !== input.purpose)
    throw new TaxAnalysisResultValidationError(
      'El proveedor devolvió un resultado para un propósito distinto al análisis.',
    )

  assertActivityReferencesBelongToEnvelope(
    payload.data,
    input.allowedActivityRevisionIds,
  )

  const result = TaxAnalysisResultV2Schema.safeParse({
    ...payload.data,
    schemaVersion: 'v2',
    runId: input.runId,
    invoiceId: input.invoiceId,
    advisoryNotice: TAX_ANALYSIS_ADVISORY_NOTICE,
    references: input.references,
    createdAt: input.createdAt ?? new Date(),
  })
  if (!result.success)
    throw new TaxAnalysisResultValidationError(
      'No fue posible normalizar el resultado tributario del proveedor.',
    )
  return result.data
}

function assertActivityReferencesBelongToEnvelope(
  payload: ModelTaxAnalysisPayloadV2,
  allowedActivityRevisionIds: Array<string>,
) {
  if (payload.purpose === 'personal_expenses') return
  const allowed = new Set(allowedActivityRevisionIds)
  if (
    payload.relatedActivityRevisionIds.some((revisionId) => !allowed.has(revisionId))
  )
    throw new TaxAnalysisResultValidationError(
      'El proveedor relacionó una actividad que no forma parte del contexto fijado.',
    )
}

/**
 * Transitional compatibility projection. It is intentionally derived from a
 * validated V2 result and is never used as the canonical persisted snapshot.
 */
export function projectTaxAnalysisResultToLegacy(
  result: TaxAnalysisResultV2,
): AnalyzeBillOutput | null {
  if (result.classification === 'needs_review') return null
  const percentage = legacyPercentage(result)
  return { percentage, reason: result.reasoning }
}

export type TaxAnalysisReferences = {
  official: Array<{
    sourceId: string
    sourceContentHash: string
    fragmentId: string
    fragmentContentHash: string
    articleOrSection: string
  }>
  user: Array<{ id: string; name: string; contentHash: string }>
}

export function referencesFromExecutionEnvelope(
  envelope: AnalysisExecutionEnvelopeV2,
): TaxAnalysisReferences {
  return {
    official: envelope.officialEvidence.map((evidence) => ({
      sourceId: evidence.source.id,
      sourceContentHash: evidence.source.contentHash,
      fragmentId: evidence.fragmentId,
      fragmentContentHash: evidence.fragmentContentHash,
      articleOrSection: evidence.articleOrSection,
    })),
    user: envelope.userReferences.map((reference) => ({
      id: reference.id,
      name: reference.name,
      contentHash: reference.contentHash,
    })),
  }
}

function legacyPercentage(result: TaxAnalysisResultV2): number {
  if (result.classification === 'ineligible') return 0
  if (result.purpose === 'vat_credit')
    return result.creditablePercentage ?? (result.classification === 'eligible' ? 100 : 0)
  if (result.purpose === 'business_income_tax')
    return result.businessUsePercentage ?? (result.classification === 'eligible' ? 100 : 0)
  return result.classification === 'eligible' ? 100 : 0
}
