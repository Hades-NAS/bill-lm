import { ReviewedTaxRuleSectionSchema } from './contracts'

import type { TaxPurpose, TaxRegime } from '#/schema/tax-analysis'
import type { DraftTaxRuleSection, ReviewedTaxRuleSection } from './contracts'

export type ReviewedSectionMetadata = {
  reviewer: string
  purpose: TaxPurpose
  taxRegime: TaxRegime
  effectiveFrom: string
  effectiveTo: string | null
  reviewedAt: string
  reviewNotes?: string
}

export type AmbiguousSectionResolution = ReviewedSectionMetadata & {
  rationale: string
}

export function buildReviewedSections(
  drafts: Array<DraftTaxRuleSection>,
  metadata: ReviewedSectionMetadata,
  existingIds: Set<string>,
): Array<ReviewedTaxRuleSection> {
  if (drafts.length === 0) {
    throw new Error(
      'No hay borradores para promover. Ejecuta primero rules:sri:split.',
    )
  }

  const ambiguous = drafts.find((draft) => draft.reviewStatus === 'ambiguous')
  if (ambiguous) {
    throw new Error(
      `La sección “${ambiguous.id}” requiere revisión de límites antes de poder promoverse.`,
    )
  }

  const existing = drafts.find((draft) => existingIds.has(draft.id))
  if (existing) {
    throw new Error(
      `Ya existe una sección revisada “${existing.id}”; no se sobrescriben revisiones.`,
    )
  }

  return drafts.map((draft) =>
    ReviewedTaxRuleSectionSchema.parse({
      schemaVersion: '1',
      id: draft.id,
      sourceId: draft.sourceId,
      articleOrSection: draft.articleOrSection,
      sourcePages: draft.sourcePages,
      sourceContentHash: draft.sourceContentHash,
      purposes: [metadata.purpose],
      taxRegimes: [metadata.taxRegime],
      effectiveFrom: metadata.effectiveFrom,
      effectiveTo: metadata.effectiveTo,
      reviewStatus: 'reviewed',
      reviewedBy: metadata.reviewer,
      reviewedAt: metadata.reviewedAt,
      reviewNotes: metadata.reviewNotes,
      markdown: draft.markdown,
    }),
  )
}

export function resolveAmbiguousSection(
  draft: DraftTaxRuleSection,
  resolution: AmbiguousSectionResolution,
  existingIds: Set<string>,
): ReviewedTaxRuleSection {
  if (draft.reviewStatus !== 'ambiguous') {
    throw new Error(
      `La sección “${draft.id}” no está marcada como ambigua; usa promote para un borrador normal.`,
    )
  }

  if (existingIds.has(draft.id)) {
    throw new Error(
      `Ya existe una sección revisada “${draft.id}”; no se sobrescriben revisiones.`,
    )
  }

  return ReviewedTaxRuleSectionSchema.parse({
    schemaVersion: '1',
    id: draft.id,
    sourceId: draft.sourceId,
    articleOrSection: draft.articleOrSection,
    sourcePages: draft.sourcePages,
    sourceContentHash: draft.sourceContentHash,
    purposes: [resolution.purpose],
    taxRegimes: [resolution.taxRegime],
    effectiveFrom: resolution.effectiveFrom,
    effectiveTo: resolution.effectiveTo,
    reviewStatus: 'reviewed',
    reviewedBy: resolution.reviewer,
    reviewedAt: resolution.reviewedAt,
    reviewNotes: resolution.rationale,
    markdown: draft.markdown,
  })
}
