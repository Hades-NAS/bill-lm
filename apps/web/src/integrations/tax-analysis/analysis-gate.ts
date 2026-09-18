import {
  collectionContextBlocks
  
  
} from '#/schema/tax-analysis'

import {
  AnalysisExecutionEnvelopeBudgetError,
  assertExecutionEnvelopeBudget,
  selectApplicableOfficialEvidence,
} from './execution-envelope.server'

import type {AnalysisBlockCode, AnalysisExecutionEnvelope} from '#/schema/tax-analysis';


export class AnalysisPrerequisiteError extends Error {
  constructor(
    readonly code: AnalysisBlockCode,
    message: string,
  ) {
    super(message)
    this.name = 'AnalysisPrerequisiteError'
  }
}

/**
 * Re-validates the immutable input immediately before it is queued and again
 * immediately before a worker can spend credentials or model tokens.
 */
export function assertAnalysisEnvelopeCanExecute(
  envelope: AnalysisExecutionEnvelope,
) {
  const blocks = collectionContextBlocks(
    {
      purpose: envelope.context.purpose,
      period: envelope.context.period,
      taxpayerProfileRevisionId: envelope.taxpayerProfile.revisionId,
      activityRevisionIds: envelope.activities.map(
        (activity) => activity.revisionId,
      ),
      notes: envelope.context.notes ?? undefined,
    },
    {
      hasRuc: envelope.taxpayerProfile.hasRuc,
      taxRegime: envelope.taxpayerProfile.taxRegime,
      vatFilingFrequency: envelope.taxpayerProfile.vatFilingFrequency,
    },
  )
  if (blocks.length) {
    throw new AnalysisPrerequisiteError(
      blocks[0].code,
      blocks.map((block) => block.message).join(' '),
    )
  }

  if (envelope.invoices.length === 0)
    throw new AnalysisPrerequisiteError(
      'NO_ELIGIBLE_INVOICES',
      'No hay facturas elegibles en la ejecución preparada.',
    )

  const evidence = selectApplicableOfficialEvidence(
    {
      purpose: envelope.context.purpose,
      period: envelope.context.period,
      taxRegime: envelope.taxpayerProfile.taxRegime,
      vatFilingFrequency: envelope.taxpayerProfile.vatFilingFrequency,
    },
    envelope.officialEvidence,
  )
  if (!evidence.length)
    throw new AnalysisPrerequisiteError(
      'NO_APPLICABLE_OFFICIAL_EVIDENCE',
      'El ruleset activo no contiene evidencia oficial aplicable para este contexto.',
    )

  try {
    assertExecutionEnvelopeBudget(envelope)
  } catch (error) {
    if (error instanceof AnalysisExecutionEnvelopeBudgetError)
      throw new AnalysisPrerequisiteError(error.code, error.message)
    throw error
  }
}

export function assertFrozenProviderConnection<
  T extends { id: string; provider: string; modelId: string },
>(
  envelope: AnalysisExecutionEnvelope,
  connection: T | null,
): asserts connection is T {
  if (!connection)
    throw new AnalysisPrerequisiteError(
      'MISSING_PROVIDER_CONNECTION',
      'La conexión usada para preparar este análisis ya no está activa.',
    )

  if (
    connection.id !== envelope.provider.id ||
    connection.provider !== envelope.provider.provider ||
    connection.modelId !== envelope.provider.modelId
  )
    throw new AnalysisPrerequisiteError(
      'STALE_PROVIDER_CONNECTION',
      'La conexión o el modelo cambió después de preparar este análisis. Configura el contexto nuevamente antes de reintentar.',
    )
}

export function assertEnvelopeMatchesAnalysisRun(
  envelope: AnalysisExecutionEnvelope,
  run: {
    collectionId: string
    collectionContextRevisionId: string | null
    taxpayerProfileRevisionId: string | null
    ruleSetId: string | null
    providerConnectionId: string | null
    provider: string | null
    modelId: string | null
  },
  queuedCollectionId: string,
) {
  const matches =
    run.collectionId === queuedCollectionId &&
    run.collectionContextRevisionId ===
      envelope.context.collectionContextRevisionId &&
    run.taxpayerProfileRevisionId === envelope.taxpayerProfile.revisionId &&
    run.ruleSetId === envelope.ruleset.id &&
    run.providerConnectionId === envelope.provider.id &&
    run.provider === envelope.provider.provider &&
    run.modelId === envelope.provider.modelId

  if (!matches)
    throw new AnalysisPrerequisiteError(
      'UNRESOLVED_ANALYSIS_CONFIGURATION',
      'El contexto preparado no coincide con la ejecución en cola. Configúralo nuevamente antes de reintentar.',
    )
}
