import { createHash } from 'node:crypto'

import { getServiceLogger } from '../logger.server'

import type {
  AnalysisExecutionEnvelope,
  TaxPurpose,
} from '#/schema/tax-analysis'
import { TAX_ANALYSIS_SCHEMA_VERSION } from '#/schema/tax-analysis'

const logger = getServiceLogger('BillPromptBuilder')

const AGENT_INSTRUCTIONS = `
Eres un asistente de análisis tributario orientativo para Ecuador. Usa únicamente
el contexto fijado que recibe cada solicitud. La evidencia oficial publicada tiene
prioridad sobre el material autogestionado. No inventes hechos, no incluyas texto
fuera del JSON solicitado y no presentes el resultado como dictamen jurídico ni
como una determinación del SRI.
`

/**
 * BillPromptBuilder
 *
 * Centralizes prompt construction for bill analysis and reference material.
 *
 * Usage:
 * ```
 * const builder = new BillPromptBuilder()
 * const prompt = builder.build(jobData, parsedBill)
 * ```
 */
const PURPOSE_INSTRUCTIONS: Record<TaxPurpose, string> = {
  vat_credit:
    'Evalúa exclusivamente el posible crédito tributario de IVA de la factura, su proporcionalidad y la evidencia que falta.',
  business_income_tax:
    'Evalúa exclusivamente la relación entre la factura y las actividades económicas para impuesto a la renta de negocio.',
  personal_expenses:
    'Evalúa exclusivamente si la factura puede corresponder a gastos personales y qué evidencia faltaría para determinarlo.',
}

const OUTPUT_SHAPES: Record<TaxPurpose, Record<string, unknown>> = {
  vat_credit: {
    purpose: 'vat_credit',
    classification: 'eligible | ineligible | needs_review',
    reasoning: 'string',
    uncertainties: ['string'],
    relatedActivityRevisionIds: ['uuid'],
    invoiceVatAmount: 0,
    potentialCreditableVatAmount: 0,
    creditablePercentage: 0,
    creditType: 'total | partial | none | undetermined',
    proportionalityRequired: false,
    missingEvidence: ['string'],
  },
  business_income_tax: {
    purpose: 'business_income_tax',
    classification: 'eligible | ineligible | needs_review',
    reasoning: 'string',
    uncertainties: ['string'],
    relatedActivityRevisionIds: ['uuid'],
    businessUsePercentage: 0,
    potentialExpenseAmount: 0,
    mixedUseDetected: false,
    substantiationIssues: ['string'],
    missingEvidence: ['string'],
  },
  personal_expenses: {
    purpose: 'personal_expenses',
    classification: 'eligible | ineligible | needs_review',
    reasoning: 'string',
    uncertainties: ['string'],
    personalExpenseCategory: 'string',
    potentialEligibleAmount: 0,
    beneficiaryRelationship: 'string',
    missingEvidence: ['string'],
  },
}

export const BILL_ANALYSIS_PROMPT_METADATA = {
  templateId: 'bill-analysis' as const,
  templateVersion: '2' as const,
  templateHash: createHash('sha256')
    .update(
      JSON.stringify({
        purposeInstructions: PURPOSE_INSTRUCTIONS,
        outputShapes: OUTPUT_SHAPES,
        inputProjection: [
          'schemaVersion',
          'purpose',
          'period',
          'contextNotes',
          'taxpayerProfile',
          'activities',
          'invoice',
          'officialEvidence',
          'selfManagedReferences',
        ],
        instructions: [
          'Use only frozen context.',
          'Do not invent facts or give legal advice.',
          'Official evidence has priority over self-managed material.',
          'Return only the declared JSON shape without extra fields.',
        ],
      }),
    )
    .digest('hex'),
}

export class BillPromptBuilder {
  private logger = logger
  /** Builds the purpose-aware prompt from one immutable execution envelope. */
  build(envelope: AnalysisExecutionEnvelope, billId: string): string {
    const invoice = envelope.invoices.find((entry) => entry.billId === billId)
    if (!invoice)
      throw new Error(
        'La factura solicitada no forma parte del contexto fijado.',
      )

    const analysisInput = {
      schemaVersion: TAX_ANALYSIS_SCHEMA_VERSION,
      prompt: BILL_ANALYSIS_PROMPT_METADATA,
      purpose: envelope.context.purpose,
      period: envelope.context.period,
      contextNotes: envelope.context.notes,
      taxpayerProfile: {
        hasRuc: envelope.taxpayerProfile.hasRuc,
        hasEmploymentIncome: envelope.taxpayerProfile.hasEmploymentIncome,
        taxRegime: envelope.taxpayerProfile.taxRegime,
        vatFilingFrequency: envelope.taxpayerProfile.vatFilingFrequency,
        additionalFacts: envelope.taxpayerProfile.additionalFacts,
      },
      activities: envelope.activities.map((activity) => ({
        revisionId: activity.revisionId,
        displayName: activity.displayName,
        registeredActivityCode: activity.registeredActivityCode,
        registeredActivityName: activity.registeredActivityName,
        activityDescription: activity.activityDescription,
        necessaryPurchases: activity.necessaryPurchases,
        revenueVatTreatment: activity.revenueVatTreatment,
        additionalFacts: activity.additionalFacts,
      })),
      invoice: {
        vendorName: invoice.normalized.vendorName,
        details: invoice.normalized.details,
        totals: invoice.normalized.totals,
        billType: invoice.normalized.billType,
      },
      officialEvidence: envelope.officialEvidence.map((evidence) => ({
        source: {
          title: evidence.source.title,
          issuer: evidence.source.issuer,
          officialUrl: evidence.source.officialUrl,
        },
        articleOrSection: evidence.articleOrSection,
        effectiveFrom: evidence.effectiveFrom,
        effectiveTo: evidence.effectiveTo,
        markdown: evidence.markdown,
      })),
      selfManagedReferences: envelope.userReferences.map((reference) => ({
        name: reference.name,
        normalizedMarkdown: reference.normalizedMarkdown,
      })),
    }

    const prompt = [
      'Eres un asistente de análisis tributario orientativo para Ecuador.',
      PURPOSE_INSTRUCTIONS[envelope.context.purpose],
      'Usa únicamente el contexto fijado a continuación. No completes hechos con suposiciones ni trates el resultado como dictamen jurídico.',
      'El material oficial publicado tiene prioridad. El material autogestionado solo aporta contexto y no sustituye una fuente oficial.',
      'Devuelve exclusivamente un objeto JSON válido, sin Markdown ni campos extra, con esta forma:',
      JSON.stringify(OUTPUT_SHAPES[envelope.context.purpose], null, 2),
      'Contexto fijado:',
      JSON.stringify(analysisInput, null, 2),
    ].join('\n\n')

    this.logger.debug('Prompt built from frozen execution envelope', {
      version: envelope.prompt.templateVersion,
      purpose: envelope.context.purpose,
      billId,
      promptLength: prompt.length,
    })

    return prompt
  }

  getAgentInstructions(): string {
    return AGENT_INSTRUCTIONS
  }
}

/**
 * Factory function to create a BillPromptBuilder instance
 */
export function createBillPromptBuilder(): BillPromptBuilder {
  return new BillPromptBuilder()
}
