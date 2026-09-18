import z from 'zod'

import {
  RevenueVatTreatmentSchema,
  TaxPurposeSchema,
  TaxRegimeSchema,
  TaxPeriodSchema,
  VatFilingFrequencySchema,
} from '@bill-lm/contracts'
import type {
  CollectionContextRevisionInput,
  TaxpayerProfileContext,
} from '@bill-lm/contracts'

import { ParsedBillSchema } from '#/schema/bill-analysis'

export * from '@bill-lm/contracts'

export const TAX_ANALYSIS_SCHEMA_VERSION = 'v2' as const

const IdSchema = z.string().uuid()
const CivilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha civil YYYY-MM-DD')

export const TaxRuleReviewStatusSchema = z.enum([
  'draft',
  'reviewed',
  'active',
  'retired',
])

export const TaxRuleSetSelectorSchema = z.object({
  purpose: TaxPurposeSchema,
  period: TaxPeriodSchema,
  taxRegime: TaxRegimeSchema,
  vatFilingFrequency: VatFilingFrequencySchema,
})
export type TaxRuleSetSelector = z.infer<typeof TaxRuleSetSelectorSchema>

export function collectionContextBlocks(
  context: CollectionContextRevisionInput,
  profile: TaxpayerProfileContext,
): Array<AnalysisBlock> {
  const blocks: Array<AnalysisBlock> = []
  const requiresActivities =
    context.purpose === 'vat_credit' ||
    context.purpose === 'business_income_tax'
  if (requiresActivities && !profile.hasRuc)
    blocks.push({
      code: 'MISSING_TAXPAYER_PROFILE',
      message: 'Este propósito requiere un perfil con RUC.',
      actionLabel: 'Revisar perfil',
      actionPath: '/profiles',
    })
  if (requiresActivities && context.activityRevisionIds.length === 0)
    blocks.push({
      code: 'MISSING_ECONOMIC_ACTIVITY',
      message: 'Selecciona al menos una actividad económica.',
      actionLabel: 'Configurar actividades',
      actionPath: '/profiles',
    })
  if (
    context.purpose === 'personal_expenses' &&
    context.activityRevisionIds.length > 0
  )
    blocks.push({
      code: 'UNRESOLVED_ANALYSIS_CONFIGURATION',
      message: 'Los gastos personales no usan actividades económicas.',
      actionLabel: 'Ajustar contexto',
      actionPath: '/collections',
    })
  if (context.purpose === 'vat_credit' && profile.taxRegime === 'unknown')
    blocks.push({
      code: 'UNRESOLVED_TAX_REGIME',
      message: 'Resuelve el régimen tributario antes de analizar IVA.',
      actionLabel: 'Revisar perfil',
      actionPath: '/profiles',
    })
  if (
    context.purpose === 'vat_credit' &&
    profile.vatFilingFrequency === 'unknown'
  )
    blocks.push({
      code: 'UNRESOLVED_VAT_FREQUENCY',
      message: 'Resuelve la periodicidad de IVA antes de analizar.',
      actionLabel: 'Revisar perfil',
      actionPath: '/profiles',
    })
  return blocks
}

export const InvoiceAnalysisSnapshotSchema = z.object({
  id: IdSchema,
  contentHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
  number: z.string().min(1).max(255),
  billType: z.enum(['PERSONAL', 'PROFESSIONAL', 'OTHER']),
  totalAmount: z.number().nonnegative(),
})
export type InvoiceAnalysisSnapshot = z.infer<
  typeof InvoiceAnalysisSnapshotSchema
>

export const AnalysisBlockCodeSchema = z.enum([
  'MISSING_PROVIDER_CONNECTION',
  'UNRESOLVED_ANALYSIS_CONFIGURATION',
  'MISSING_TAXPAYER_PROFILE',
  'MISSING_ECONOMIC_ACTIVITY',
  'UNRESOLVED_TAX_REGIME',
  'UNRESOLVED_VAT_FREQUENCY',
  'MISSING_APPLICABLE_RULESET',
  'MISSING_COLLECTION_CONTEXT',
  'OUTSIDE_COLLECTION_PERIOD',
  'NO_ELIGIBLE_INVOICES',
  'NO_APPLICABLE_OFFICIAL_EVIDENCE',
  'ANALYSIS_CONTEXT_EXCEEDS_BUDGET',
  'STALE_PROVIDER_CONNECTION',
])
export type AnalysisBlockCode = z.infer<typeof AnalysisBlockCodeSchema>

export const AnalysisBlockSchema = z.object({
  code: AnalysisBlockCodeSchema,
  message: z.string().min(1).max(500),
  actionLabel: z.string().min(1).max(120),
  actionPath: z.string().startsWith('/'),
})
export type AnalysisBlock = z.infer<typeof AnalysisBlockSchema>

const SnapshotHashSchema = z.string().regex(/^[a-f0-9]{64}$/i)

export const AnalysisOfficialEvidenceSchema = z.object({
  ruleSetFragmentId: IdSchema,
  fragmentId: IdSchema,
  fragmentContentHash: z.string().min(1),
  source: z.object({
    id: IdSchema,
    title: z.string().min(1),
    issuer: z.string().min(1),
    officialUrl: z.string().url(),
    contentHash: z.string().min(1),
  }),
  articleOrSection: z.string().min(1),
  purposes: z.array(TaxPurposeSchema),
  taxRegimes: z.array(TaxRegimeSchema),
  effectiveFrom: CivilDateSchema,
  effectiveTo: CivilDateSchema.nullable(),
  markdown: z.string().min(1),
})
export type AnalysisOfficialEvidence = z.infer<
  typeof AnalysisOfficialEvidenceSchema
>

export const AnalysisExecutionEnvelopeSchema = z
  .object({
  schemaVersion: z.literal(TAX_ANALYSIS_SCHEMA_VERSION),
  envelopeVersion: z.literal('1'),
  execution: z
    .object({
      mode: z.enum(['real', 'smoke']),
    })
    .default({ mode: 'real' }),
  prompt: z.object({
    templateId: z.literal('bill-analysis'),
    templateVersion: z.literal('2'),
    templateHash: SnapshotHashSchema,
  }),
  context: z.object({
    collectionContextRevisionId: IdSchema,
    revision: z.number().int().positive(),
    purpose: TaxPurposeSchema,
    period: TaxPeriodSchema,
    notes: z.string().nullable(),
  }),
  taxpayerProfile: z.object({
    revisionId: IdSchema,
    revision: z.number().int().positive(),
    hasRuc: z.boolean(),
    hasEmploymentIncome: z.boolean(),
    taxRegime: TaxRegimeSchema,
    vatFilingFrequency: VatFilingFrequencySchema,
    additionalFacts: z.string().nullable(),
  }),
  activities: z.array(
    z.object({
      revisionId: IdSchema,
      revision: z.number().int().positive(),
      displayName: z.string().min(1),
      registeredActivityCode: z.string().nullable(),
      registeredActivityName: z.string().min(1),
      activityDescription: z.string().min(1),
      necessaryPurchases: z.string().nullable(),
      revenueVatTreatment: RevenueVatTreatmentSchema,
      additionalFacts: z.string().nullable(),
    }),
  ),
  provider: z.object({
    id: IdSchema,
    provider: z.enum(['OPENAI', 'CLAUDE']),
    modelId: z.string().min(1).max(255),
  }),
  ruleset: z.object({
    id: IdSchema,
    version: z.number().int().positive(),
    contentHash: z.string().min(1),
    effectiveFrom: CivilDateSchema,
    effectiveTo: CivilDateSchema.nullable(),
  }),
  officialEvidence: z.array(AnalysisOfficialEvidenceSchema).min(1),
    invoices: z
    .array(
      z.object({
        billId: IdSchema,
        contentHash: SnapshotHashSchema,
        parserVersion: z.literal('xml-v1'),
        normalized: ParsedBillSchema,
      }),
    )
      .min(1),
  })
  .strict()
export type AnalysisExecutionEnvelope = z.infer<
  typeof AnalysisExecutionEnvelopeSchema
>

export const AnalysisRunInputSnapshotSchema = z.union([
  AnalysisExecutionEnvelopeSchema,
  z.object({
    schemaVersion: z.literal(TAX_ANALYSIS_SCHEMA_VERSION),
    blockCode: z.string().min(1),
  }),
])
export type AnalysisRunInputSnapshot = z.infer<
  typeof AnalysisRunInputSnapshotSchema
>

export const AnalysisRunStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'blocked',
])
export type AnalysisRunStatus = z.infer<typeof AnalysisRunStatusSchema>

export const AnalysisRunSchema = z.object({
  id: IdSchema,
  collectionId: IdSchema,
  status: AnalysisRunStatusSchema,
  inputSnapshot: AnalysisRunInputSnapshotSchema,
  idempotencyKey: z.string().min(1).max(255),
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
})
export type AnalysisRun = z.infer<typeof AnalysisRunSchema>

export const AnalysisRunHistoryCursorSchema = z.object({
  createdAt: z.coerce.date(),
  id: IdSchema,
})

export const ListAnalysisRunHistoryRequestSchema = z.object({
  collectionId: IdSchema,
  cursor: AnalysisRunHistoryCursorSchema.optional(),
  limit: z.number().int().min(1).max(50).default(20),
})
export type ListAnalysisRunHistoryRequest = z.infer<
  typeof ListAnalysisRunHistoryRequestSchema
>

export const GetAnalysisRunDetailRequestSchema = z.object({
  collectionId: IdSchema,
  runId: IdSchema,
})
export type GetAnalysisRunDetailRequest = z.infer<
  typeof GetAnalysisRunDetailRequestSchema
>

export const TaxAnalysisClassificationSchema = z.enum([
  'eligible',
  'ineligible',
  'needs_review',
])
export type TaxAnalysisClassification = z.infer<
  typeof TaxAnalysisClassificationSchema
>

const TaxAnalysisResultBaseSchema = z.object({
  schemaVersion: z.literal(TAX_ANALYSIS_SCHEMA_VERSION),
  runId: IdSchema,
  invoiceId: IdSchema,
  purpose: TaxPurposeSchema,
  classification: TaxAnalysisClassificationSchema,
  reasoning: z.string().trim().min(1).max(10_000),
  uncertainties: z.array(z.string().trim().min(1).max(1_000)).max(20),
  advisoryNotice: z.literal(
    'Resultado orientativo; no constituye un dictamen jurídico ni una determinación del SRI.',
  ),
  references: z.object({
    official: z
      .array(
        z.object({
          sourceId: IdSchema,
          sourceContentHash: z.string().min(1),
          fragmentId: IdSchema,
          fragmentContentHash: z.string().min(1),
          articleOrSection: z.string().min(1),
        }),
      )
      .min(1),
  }),
  createdAt: z.date(),
})
export const TaxAnalysisResultSchema = z.discriminatedUnion('purpose', [
  TaxAnalysisResultBaseSchema.extend({
    purpose: z.literal('vat_credit'),
    relatedActivityRevisionIds: z.array(IdSchema).min(1).max(20),
    invoiceVatAmount: z.number().nonnegative(),
    potentialCreditableVatAmount: z.number().nonnegative().optional(),
    creditablePercentage: z.number().min(0).max(100).optional(),
    creditType: z.enum(['total', 'partial', 'none', 'undetermined']),
    proportionalityRequired: z.boolean(),
    missingEvidence: z.array(z.string().trim().min(1).max(1_000)).max(20),
  }),
  TaxAnalysisResultBaseSchema.extend({
    purpose: z.literal('business_income_tax'),
    relatedActivityRevisionIds: z.array(IdSchema).min(1).max(20),
    businessUsePercentage: z.number().min(0).max(100).optional(),
    potentialExpenseAmount: z.number().nonnegative().optional(),
    mixedUseDetected: z.boolean(),
    substantiationIssues: z.array(z.string().trim().min(1).max(1_000)).max(20),
    missingEvidence: z.array(z.string().trim().min(1).max(1_000)).max(20),
  }),
  TaxAnalysisResultBaseSchema.extend({
    purpose: z.literal('personal_expenses'),
    personalExpenseCategory: z.string().trim().min(1).max(120).optional(),
    potentialEligibleAmount: z.number().nonnegative().optional(),
    beneficiaryRelationship: z.string().trim().min(1).max(500).optional(),
    missingEvidence: z.array(z.string().trim().min(1).max(1_000)).max(20),
  }),
])
export type TaxAnalysisResult = z.infer<typeof TaxAnalysisResultSchema>

const ModelTaxAnalysisPayloadBaseSchema = z
  .object({
    purpose: TaxPurposeSchema,
    classification: TaxAnalysisClassificationSchema,
    reasoning: z.string().trim().min(1).max(10_000),
    uncertainties: z.array(z.string().trim().min(1).max(1_000)).max(20),
  })
  .strict()

/**
 * The fields an LLM is allowed to return for an analysis result.
 *
 * schemaVersion, runId, invoiceId, and createdAt are owned by the server and
 * are attached only when a final result is persisted.
 */
export const ModelTaxAnalysisPayloadSchema = z.discriminatedUnion('purpose', [
  ModelTaxAnalysisPayloadBaseSchema.extend({
    purpose: z.literal('vat_credit'),
    relatedActivityRevisionIds: z.array(IdSchema).min(1).max(20),
    invoiceVatAmount: z.number().nonnegative(),
    potentialCreditableVatAmount: z.number().nonnegative().optional(),
    creditablePercentage: z.number().min(0).max(100).optional(),
    creditType: z.enum(['total', 'partial', 'none', 'undetermined']),
    proportionalityRequired: z.boolean(),
    missingEvidence: z.array(z.string().trim().min(1).max(1_000)).max(20),
  }).strict(),
  ModelTaxAnalysisPayloadBaseSchema.extend({
    purpose: z.literal('business_income_tax'),
    relatedActivityRevisionIds: z.array(IdSchema).min(1).max(20),
    businessUsePercentage: z.number().min(0).max(100).optional(),
    potentialExpenseAmount: z.number().nonnegative().optional(),
    mixedUseDetected: z.boolean(),
    substantiationIssues: z.array(z.string().trim().min(1).max(1_000)).max(20),
    missingEvidence: z.array(z.string().trim().min(1).max(1_000)).max(20),
  }).strict(),
  ModelTaxAnalysisPayloadBaseSchema.extend({
    purpose: z.literal('personal_expenses'),
    personalExpenseCategory: z.string().trim().min(1).max(120).optional(),
    potentialEligibleAmount: z.number().nonnegative().optional(),
    beneficiaryRelationship: z.string().trim().min(1).max(500).optional(),
    missingEvidence: z.array(z.string().trim().min(1).max(1_000)).max(20),
  }).strict(),
])
export type ModelTaxAnalysisPayload = z.infer<
  typeof ModelTaxAnalysisPayloadSchema
>
