import z from 'zod'

export const TAX_ANALYSIS_SCHEMA_VERSION = 'v2' as const

const IdSchema = z.string().uuid()
const CivilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha civil YYYY-MM-DD')
const OptionalTextSchema = z.string().trim().max(4_000).optional()

export const TaxPurposeSchema = z.enum([
  'vat_credit',
  'business_income_tax',
  'personal_expenses',
])
export type TaxPurpose = z.infer<typeof TaxPurposeSchema>

export const RevenueVatTreatmentSchema = z.enum([
  'taxed_nonzero',
  'zero_with_credit',
  'zero_without_credit',
  'mixed',
  'export',
  'unknown',
  'other',
])
export type RevenueVatTreatment = z.infer<typeof RevenueVatTreatmentSchema>

export const EconomicActivityRevisionInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    registeredActivityCode: z.string().trim().max(100).optional(),
    registeredActivityName: z.string().trim().min(1).max(500),
    activityDescription: z.string().trim().min(1).max(4_000),
    necessaryPurchases: OptionalTextSchema,
    revenueVatTreatment: RevenueVatTreatmentSchema,
    revenueVatTreatmentOther: OptionalTextSchema,
    mixedUseDescription: OptionalTextSchema,
    additionalFacts: OptionalTextSchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.revenueVatTreatment === 'other' &&
      !value.revenueVatTreatmentOther
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['revenueVatTreatmentOther'],
        message: 'Describe el tratamiento de IVA cuando seleccionas “otro”.',
      })
    }
  })
export type EconomicActivityRevisionInput = z.infer<
  typeof EconomicActivityRevisionInputSchema
>

export const EconomicActivityRevisionSchema =
  EconomicActivityRevisionInputSchema.extend({
    id: IdSchema,
    activityId: IdSchema,
    revision: z.number().int().positive(),
    createdAt: z.date(),
  })
export type EconomicActivityRevision = z.infer<
  typeof EconomicActivityRevisionSchema
>

export const TaxpayerProfileRevisionInputSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  personalIdNumber: z.string().trim().regex(/^\d{10}$/).optional(),
  professionalIdNumber: z.string().trim().regex(/^\d{13}$/).optional(),
  activityRevisionIds: z.array(IdSchema).min(1).max(20),
  additionalFacts: OptionalTextSchema,
})
export type TaxpayerProfileRevisionInput = z.infer<
  typeof TaxpayerProfileRevisionInputSchema
>

export const TaxpayerProfileRevisionSchema =
  TaxpayerProfileRevisionInputSchema.extend({
    id: IdSchema,
    taxpayerProfileId: IdSchema,
    revision: z.number().int().positive(),
    createdAt: z.date(),
  })
export type TaxpayerProfileRevision = z.infer<
  typeof TaxpayerProfileRevisionSchema
>

export const TaxPeriodSchema = z
  .object({
    startDate: CivilDateSchema,
    endDate: CivilDateSchema,
  })
  .refine((period) => period.startDate <= period.endDate, {
    path: ['endDate'],
    message: 'La fecha final debe ser igual o posterior a la fecha inicial.',
  })
export type TaxPeriod = z.infer<typeof TaxPeriodSchema>

export const CollectionContextRevisionInputSchema = z.object({
  purpose: TaxPurposeSchema,
  period: TaxPeriodSchema,
  taxpayerProfileRevisionId: IdSchema,
  activityRevisionIds: z.array(IdSchema).min(1).max(20),
  notes: OptionalTextSchema,
})
export type CollectionContextRevisionInput = z.infer<
  typeof CollectionContextRevisionInputSchema
>

export const CollectionContextRevisionSchema =
  CollectionContextRevisionInputSchema.extend({
    id: IdSchema,
    collectionId: IdSchema,
    revision: z.number().int().positive(),
    createdAt: z.date(),
  })
export type CollectionContextRevision = z.infer<
  typeof CollectionContextRevisionSchema
>

export const InvoiceAnalysisSnapshotSchema = z.object({
  id: IdSchema,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
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
  'MISSING_COLLECTION_CONTEXT',
  'OUTSIDE_COLLECTION_PERIOD',
  'NO_ELIGIBLE_INVOICES',
])
export type AnalysisBlockCode = z.infer<typeof AnalysisBlockCodeSchema>

export const AnalysisBlockSchema = z.object({
  code: AnalysisBlockCodeSchema,
  message: z.string().min(1).max(500),
  actionLabel: z.string().min(1).max(120),
  actionPath: z.string().startsWith('/'),
})
export type AnalysisBlock = z.infer<typeof AnalysisBlockSchema>

export const AnalysisRunInputSnapshotSchema = z.object({
  schemaVersion: z.literal(TAX_ANALYSIS_SCHEMA_VERSION),
  collectionContextRevisionId: IdSchema,
  taxpayerProfileRevisionId: IdSchema,
  activityRevisionIds: z.array(IdSchema).min(1),
  providerConnection: z.object({
    id: IdSchema,
    provider: z.enum(['OPENAI', 'CLAUDE']),
    modelId: z.string().min(1).max(255),
  }),
  promptVersion: z.string().min(1).max(100),
})
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

export const TaxAnalysisClassificationSchema = z.enum([
  'eligible',
  'ineligible',
  'needs_review',
])
export type TaxAnalysisClassification = z.infer<
  typeof TaxAnalysisClassificationSchema
>

export const TaxAnalysisResultV2Schema = z.object({
  schemaVersion: z.literal(TAX_ANALYSIS_SCHEMA_VERSION),
  runId: IdSchema,
  invoiceId: IdSchema,
  purpose: TaxPurposeSchema,
  classification: TaxAnalysisClassificationSchema,
  deductiblePercentage: z.number().min(0).max(100),
  reasoning: z.string().trim().min(1).max(10_000),
  uncertainties: z.array(z.string().trim().min(1).max(1_000)).max(20),
  createdAt: z.date(),
})
export type TaxAnalysisResultV2 = z.infer<typeof TaxAnalysisResultV2Schema>
