import { z } from 'zod'

const IdSchema = z.string().uuid()
export const LocalAnalysisRunStatusSchema = z.enum(['queued', 'running', 'completed', 'failed', 'blocked'])
export type LocalAnalysisRunStatus = z.infer<typeof LocalAnalysisRunStatusSchema>
export const LocalTaxAnalysisClassificationSchema = z.enum(['eligible', 'ineligible', 'needs_review'])

const ModelTaxAnalysisPayloadBaseSchema = z.object({
  purpose: z.enum(['vat_credit', 'business_income_tax', 'personal_expenses']),
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
