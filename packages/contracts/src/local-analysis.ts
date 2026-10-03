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

/** Query input for the safe, operational local-run list. */
export const LocalRunListFilterSchema = z.object({
  collectionId: IdSchema.optional(),
  status: LocalAnalysisRunStatusSchema.optional(),
  unread: z.boolean().optional(),
}).strict()
export type LocalRunListFilter = z.infer<typeof LocalRunListFilterSchema>

const LocalRunPeriodSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict()

const LocalRunTimingSchema = z.object({
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  terminalAt: z.string().datetime().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
}).strict()

/**
 * Browser-safe run projection. It deliberately excludes the execution snapshot,
 * XML, object paths, hashes, connection URLs and secret references.
 */
export const LocalRunSummarySchema = z.object({
  id: IdSchema,
  invoiceId: IdSchema,
  collectionId: IdSchema.nullable(),
  collectionName: z.string().nullable(),
  fileName: z.string().nullable(),
  status: LocalAnalysisRunStatusSchema,
  readAt: z.string().datetime().nullable(),
  provider: z.string().nullable(),
  apiFlavor: z.string().nullable(),
  model: z.string().nullable(),
  purpose: LocalTaxAnalysisPurposeSchema.nullable(),
  period: LocalRunPeriodSchema.nullable(),
  contextRevision: z.number().int().positive().nullable(),
  ruleset: z.object({ id: z.string(), version: z.string() }).strict().nullable(),
  timing: LocalRunTimingSchema,
  error: z.string().nullable(),
  progress: z.number().int().min(0).max(100).nullable(),
  eventCount: z.number().int().nonnegative(),
}).strict()
export type LocalRunSummary = z.infer<typeof LocalRunSummarySchema>

/** Safe, collection-owned operational detail; raw snapshots remain daemon-only. */
export const LocalRunDetailSchema = LocalRunSummarySchema.extend({
  events: z.array(LocalAnalysisRunEventSchema),
}).strict()
export type LocalRunDetail = z.infer<typeof LocalRunDetailSchema>

/** @deprecated Use LocalRunDetailSchema. The public detail never includes snapshots. */
export const LocalCollectionRunDetailSchema = LocalRunDetailSchema
export type LocalCollectionRunDetail = LocalRunDetail
