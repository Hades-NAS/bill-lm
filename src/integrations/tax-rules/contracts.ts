import { createHash } from 'node:crypto'
import z from 'zod'

import {
  TaxPurposeSchema,
  TaxRegimeSchema,
  TaxRuleReviewStatusSchema,
} from '#/schema/tax-analysis-v2'

const CivilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha civil YYYY-MM-DD.')
const Sha256Schema = z.string().regex(/^sha256:[a-f0-9]{64}$/)
const RuleIdSchema = z.string().regex(/^ec\.sri\.[a-z0-9.-]+$/)

export const TaxRuleSourceManifestSchema = z
  .object({
    schemaVersion: z.literal('1'),
    id: z.string().regex(/^ec-sri-[a-z0-9-]+$/),
    // Optional only to preserve compatibility with already published bundles.
    // All source manifests authored from now on must declare a readable title.
    title: z.string().trim().min(1).max(500).optional(),
    issuer: z.literal('Servicio de Rentas Internas'),
    jurisdiction: z.literal('EC'),
    sourceKind: z.enum(['law', 'regulation', 'guide', 'form_guide']),
    discoveryUrl: z.string().url(),
    resolvedUrl: z.string().url().nullable(),
    mimeType: z.literal('application/pdf').nullable(),
    retrievedAt: z.string().datetime().nullable(),
    contentHash: Sha256Schema.nullable(),
    effectiveFrom: CivilDateSchema.nullable(),
    effectiveTo: CivilDateSchema.nullable(),
    reviewStatus: TaxRuleReviewStatusSchema,
  })
  .superRefine((source, ctx) => {
    if (source.reviewStatus !== 'draft' && !source.contentHash)
      ctx.addIssue({
        code: 'custom',
        path: ['contentHash'],
        message: 'Una fuente revisada debe tener hash de contenido.',
      })
  })
export type TaxRuleSourceManifest = z.infer<typeof TaxRuleSourceManifestSchema>

export const ReviewedTaxRuleSectionSchema = z.object({
  schemaVersion: z.literal('1'),
  id: z.string().regex(/^ec-sri-[a-z0-9-]+$/),
  sourceId: TaxRuleSourceManifestSchema.shape.id,
  articleOrSection: z.string().trim().min(1).max(255),
  sourcePages: z.array(z.number().int().positive()).min(1),
  sourceContentHash: Sha256Schema,
  purposes: z.array(TaxPurposeSchema).min(1),
  taxRegimes: z.array(TaxRegimeSchema).min(1),
  effectiveFrom: CivilDateSchema,
  effectiveTo: CivilDateSchema.nullable(),
  reviewStatus: z.literal('reviewed'),
  reviewedBy: z.string().trim().min(1).max(255),
  reviewedAt: z.string().datetime(),
  reviewNotes: z.string().trim().min(1).max(2_000).optional(),
  markdown: z.string().trim().min(1),
})
export type ReviewedTaxRuleSection = z.infer<
  typeof ReviewedTaxRuleSectionSchema
>

export const DraftTaxRuleSectionSchema = z.object({
  schemaVersion: z.literal('1'),
  id: z.string().regex(/^ec-sri-[a-z0-9-]+$/),
  sourceId: TaxRuleSourceManifestSchema.shape.id,
  articleOrSection: z.string().trim().min(1).max(255),
  sourcePages: z.array(z.number().int().positive()).min(1),
  sourceStartOffset: z.number().int().nonnegative(),
  sourceEndOffset: z.number().int().positive(),
  sourceContentHash: Sha256Schema,
  splitterVersion: z.literal('1'),
  reviewStatus: z.enum(['draft', 'ambiguous']),
  markdown: z.string().trim().min(1),
})
export type DraftTaxRuleSection = z.infer<typeof DraftTaxRuleSectionSchema>

export const TaxRuleSchema = z.object({
  id: RuleIdSchema,
  version: z.number().int().positive(),
  purpose: TaxPurposeSchema,
  kind: z.enum(['requirement', 'exception', 'evidence', 'classification']),
  summary: z.string().trim().min(1).max(2_000),
  sourceSectionIds: z.array(ReviewedTaxRuleSectionSchema.shape.id).min(1),
  conditions: z.array(z.string().trim().min(1).max(255)).max(30),
  uncertainties: z.array(z.string().trim().min(1).max(255)).max(30),
})
export type TaxRule = z.infer<typeof TaxRuleSchema>

const BundlePayloadSchema = z.object({
  schemaVersion: z.literal('1'),
  rulesetId: z.string().regex(/^ec-sri-\d{4}\.\d+$/),
  version: z.number().int().positive(),
  jurisdiction: z.literal('EC'),
  effectiveFrom: CivilDateSchema,
  effectiveTo: CivilDateSchema.nullable(),
  sourceManifests: z.array(TaxRuleSourceManifestSchema).min(1),
  sections: z.array(ReviewedTaxRuleSectionSchema).min(1),
  // A first publication may distribute reviewed source fragments before a
  // separate semantic-rule curation pass exists. It must never invent rules.
  rules: z.array(TaxRuleSchema),
  promptContractVersion: z.string().trim().min(1).max(100),
  createdAt: z.string().datetime(),
  createdBy: z.string().trim().min(1).max(255),
})

export const TaxRuleBundleSchema = BundlePayloadSchema.extend({
  bundleHash: Sha256Schema,
})
export type TaxRuleBundle = z.infer<typeof TaxRuleBundleSchema>

export function canonicalizeTaxRuleValue(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value))
    return `[${value.map(canonicalizeTaxRuleValue).join(',')}]`

  const object = value as Record<string, unknown>
  return `{${Object.keys(object)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalizeTaxRuleValue(object[key])}`,
    )
    .join(',')}}`
}

export function hashTaxRuleBundlePayload(
  payload: z.input<typeof BundlePayloadSchema>,
) {
  const parsed = BundlePayloadSchema.parse(payload)
  return `sha256:${createHash('sha256')
    .update(canonicalizeTaxRuleValue(parsed))
    .digest('hex')}`
}

export function buildTaxRuleBundle(
  payload: z.input<typeof BundlePayloadSchema>,
) {
  const parsed = BundlePayloadSchema.parse(payload)
  return TaxRuleBundleSchema.parse({
    ...parsed,
    bundleHash: hashTaxRuleBundlePayload(parsed),
  })
}
