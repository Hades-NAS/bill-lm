import {
  ModelTaxAnalysisPayloadSchema,
  TaxAnalysisResultSchema,
} from '#/schema/tax-analysis'

import type {
  AnalysisExecutionEnvelope,
  ModelTaxAnalysisPayload,
  TaxAnalysisResult,
  TaxPurpose,
} from '#/schema/tax-analysis'

export const TAX_ANALYSIS_ADVISORY_NOTICE =
  'Resultado orientativo; no constituye un dictamen jurídico ni una determinación del SRI.' as const

export class TaxAnalysisResultValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaxAnalysisResultValidationError'
  }
}

export function normalizeTaxAnalysisResult(input: {
  payload: unknown
  purpose: TaxPurpose
  runId: string
  invoiceId: string
  allowedActivityRevisionIds: Array<string>
  references: TaxAnalysisReferences
  createdAt?: Date
}): TaxAnalysisResult {
  const payload = ModelTaxAnalysisPayloadSchema.safeParse(input.payload)
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

  const result = TaxAnalysisResultSchema.safeParse({
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
  payload: ModelTaxAnalysisPayload,
  allowedActivityRevisionIds: Array<string>,
) {
  if (payload.purpose === 'personal_expenses') return
  const allowed = new Set(allowedActivityRevisionIds)
  if (
    payload.relatedActivityRevisionIds.some(
      (revisionId) => !allowed.has(revisionId),
    )
  )
    throw new TaxAnalysisResultValidationError(
      'El proveedor relacionó una actividad que no forma parte del contexto fijado.',
    )
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
  envelope: AnalysisExecutionEnvelope,
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
