import { createHash } from 'node:crypto'

import {
  AnalysisExecutionEnvelopeV2Schema,
  type AnalysisOfficialEvidence,
  type AnalysisExecutionEnvelopeV2,
  type TaxRuleSetSelector,
} from '#/schema/tax-analysis-v2'

export const ANALYSIS_EVIDENCE_CHARACTER_BUDGET = 120_000

export function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex')
}

export function assertExecutionEnvelopeBudget(
  envelope: AnalysisExecutionEnvelopeV2,
  budget = ANALYSIS_EVIDENCE_CHARACTER_BUDGET,
) {
  const characters =
    envelope.officialEvidence.reduce(
      (total, evidence) => total + evidence.markdown.length,
      0,
    ) +
    envelope.userReferences.reduce(
      (total, reference) => total + reference.normalizedMarkdown.length,
      0,
    )
  if (characters > budget)
    throw new AnalysisExecutionEnvelopeBudgetError(characters, budget)
  return characters
}

export class AnalysisExecutionEnvelopeBudgetError extends Error {
  readonly code = 'ANALYSIS_CONTEXT_EXCEEDS_BUDGET'

  constructor(
    readonly characters: number,
    readonly budget: number,
  ) {
    super(
      `El material normativo seleccionado (${characters.toLocaleString('es-EC')} caracteres) supera el límite de ${budget.toLocaleString('es-EC')}. Publica un ruleset más acotado antes de analizar.`,
    )
  }
}

export function parseAnalysisExecutionEnvelope(
  snapshot: unknown,
): AnalysisExecutionEnvelopeV2 {
  return AnalysisExecutionEnvelopeV2Schema.parse(snapshot)
}

export function selectApplicableOfficialEvidence(
  selector: TaxRuleSetSelector,
  candidates: Array<AnalysisOfficialEvidence>,
) {
  return candidates
    .filter(
      (candidate) =>
        candidate.effectiveFrom <= selector.period.startDate &&
        (!candidate.effectiveTo ||
          candidate.effectiveTo >= selector.period.endDate) &&
        candidate.purposes.includes(selector.purpose) &&
        candidate.taxRegimes.includes(selector.taxRegime),
    )
    .sort(
      (left, right) =>
        left.source.id.localeCompare(right.source.id) ||
        left.articleOrSection.localeCompare(right.articleOrSection) ||
        left.fragmentId.localeCompare(right.fragmentId),
    )
}
