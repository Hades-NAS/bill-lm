import { z } from 'zod'

const IdSchema = z.string().uuid()
export const LocalAnalysisRunStatusSchema = z.enum(['queued', 'running', 'completed', 'failed', 'blocked'])
export type LocalAnalysisRunStatus = z.infer<typeof LocalAnalysisRunStatusSchema>
export const LocalTaxAnalysisClassificationSchema = z.enum(['eligible', 'ineligible', 'needs_review'])
export const LocalTaxAnalysisPurposeSchema = z.enum(['vat_credit', 'business_income_tax', 'personal_expenses'])

const ModelTaxAnalysisPayloadBaseSchema = z.object({
  purpose: LocalTaxAnalysisPurposeSchema,
  classification: LocalTaxAnalysisClassificationSchema,
  reasoning: z.string().trim().min(1).max(10_000),
  uncertainties: z.array(z.string().trim().min(1).max(1_000)).max(20),
}).strict()

/** GPU adapters may return only these model-owned fields. */
export const ModelTaxAnalysisPayloadSchema = z.discriminatedUnion('purpose', [
  ModelTaxAnalysisPayloadBaseSchema.extend({ purpose: z.literal('vat_credit'), relatedActivityRevisionIds: z.array(IdSchema).min(1).max(20), invoiceVatAmount: z.number().nonnegative(), potentialCreditableVatAmount: z.number().nonnegative().optional(), creditablePercentage: z.number().min(0).max(100).optional(), creditType: z.enum(['total', 'partial', 'none', 'undetermined']), proportionalityRequired: z.boolean(), missingEvidence: z.array(z.string().trim().min(1).max(1_000)).max(20) }).strict(),
  ModelTaxAnalysisPayloadBaseSchema.extend({ purpose: z.literal('business_income_tax'), relatedActivityRevisionIds: z.array(IdSchema).min(1).max(20), businessUsePercentage: z.number().min(0).max(100).optional(), potentialExpenseAmount: z.number().nonnegative().optional(), mixedUseDetected: z.boolean(), substantiationIssues: z.array(z.string().trim().min(1).max(1_000)).max(20), missingEvidence: z.array(z.string().trim().min(1).max(1_000)).max(20) }).strict(),
  ModelTaxAnalysisPayloadBaseSchema.extend({ purpose: z.literal('personal_expenses'), personalExpenseCategory: z.string().trim().min(1).max(120).optional(), potentialEligibleAmount: z.number().nonnegative().optional(), beneficiaryRelationship: z.string().trim().min(1).max(500).optional(), missingEvidence: z.array(z.string().trim().min(1).max(1_000)).max(20) }).strict(),
])
export type ModelTaxAnalysisPayload = z.infer<typeof ModelTaxAnalysisPayloadSchema>

/** A local event emitted while a collection-scoped analysis run progresses. */
export const LocalAnalysisRunEventSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  status: LocalAnalysisRunStatusSchema,
  message: z.string().trim().min(1).max(1_000),
  createdAt: z.string().datetime(),
})
export type LocalAnalysisRunEvent = z.infer<typeof LocalAnalysisRunEventSchema>

/** Model output persisted by the local daemon, without connection or secret metadata. */
export const LocalAnalysisRunResultSchema = z.object({
  id: IdSchema,
  runId: IdSchema,
  invoiceId: IdSchema,
  purpose: LocalTaxAnalysisPurposeSchema,
  classification: LocalTaxAnalysisClassificationSchema,
  payload: ModelTaxAnalysisPayloadSchema,
  createdAt: z.string().datetime(),
})
export type LocalAnalysisRunResult = z.infer<typeof LocalAnalysisRunResultSchema>

/** Safe, immutable inputs captured when a local execution is queued. */
export const LocalAnalysisRunSnapshotSchema = z.object({
  invoice: z.unknown(),
  collectionContext: z.unknown().nullable(),
  taxpayerProfile: z.unknown().nullable(),
  activities: z.array(z.unknown()),
  connection: z.object({ id: IdSchema, label: z.string(), apiFlavor: z.string(), baseUrl: z.string(), model: z.string() }),
  ruleset: z.object({ id: z.string(), version: z.string(), jurisdiction: z.string() }),
})
export type LocalAnalysisRunSnapshot = z.infer<typeof LocalAnalysisRunSnapshotSchema>

/** Detail is intentionally collection-scoped so one collection cannot read another's run. */
export const LocalCollectionRunDetailSchema = z.object({
  id: IdSchema,
  invoiceId: IdSchema,
  collectionId: IdSchema,
  status: LocalAnalysisRunStatusSchema,
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullish().transform((value) => value ?? null),
  snapshot: LocalAnalysisRunSnapshotSchema.nullish().transform((value) => value ?? null),
  events: z.array(LocalAnalysisRunEventSchema),
  result: LocalAnalysisRunResultSchema.nullable(),
})
export type LocalCollectionRunDetail = z.infer<typeof LocalCollectionRunDetailSchema>
