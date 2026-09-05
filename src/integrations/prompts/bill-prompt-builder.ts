import { DateTime } from 'luxon'
import { createHash } from 'node:crypto'

import { getServiceLogger } from '../logger.server'

import type { ParsedBill } from '#/schema/bill-analysis'
import type { AnalyzeJobData } from '#/schema/collections'
import type {
  AnalysisExecutionEnvelopeV2,
  TaxPurpose,
} from '#/schema/tax-analysis-v2'

const logger = getServiceLogger('BillPromptBuilder')

const AGENT_INSTRUCTIONS = `
Eres un asistente especializado en analizar facturas y determinar si la factura puede ser deducible, explicando el porqué según el ruleset oficial seleccionado y el material adicional del usuario, si existe.

El output debe ser un JSON con la siguiente estructura (NO CAMPOS EXTRA, NI TEXTO, SOLO LOS CAMPOS A CONTINUACIÓN):
{
  "percentage": number, // Un número entre 0 y 100 que representa el porcentaje de deducibilidad de la factura
  "reason": string, // Una explicación detallada de por qué la factura tiene ese porcentaje de deducibilidad. Máximo 1000 caracteres.
}

No presentes el resultado como un dictamen jurídico. Distingue siempre entre el material oficial publicado y el material adicional autogestionado.
Si la factura no tiene información suficiente para determinar su deducibilidad, asigna un porcentaje bajo y explica claramente la razón en el campo "reason".
`

/**
 * Base prompt template for bill analysis
 * Placeholders: {{BILL_DATA}}, {{INSTRUCTIONS}}
 */
const BASE_PROMPT_TEMPLATE = `
Eres un asistente que ayuda a los usuarios a analizar facturas electrónicas.

Tu tarea es analizar los campos recibidos usando el ruleset oficial publicado para el contexto y el material adicional autogestionado por el usuario, si existe; determina si la factura puede ser deducible y explica el porqué.

A continuación te proporciono la información de la factura con la data necesaria para que puedas analizarla:
{{BILL_DATA}}

{{INSTRUCTIONS}}
`.trim()

/**
 * Default instructions for bill analysis
 */
const DEFAULT_INSTRUCTIONS = `Analiza esta factura con los campos disponibles y las secciones oficiales publicadas para el contexto. El resultado es orientativo y no constituye un dictamen jurídico.`

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
const V2_PURPOSE_INSTRUCTIONS: Record<TaxPurpose, string> = {
  vat_credit:
    'Evalúa exclusivamente el posible crédito tributario de IVA de la factura, su proporcionalidad y la evidencia que falta.',
  business_income_tax:
    'Evalúa exclusivamente la relación entre la factura y las actividades económicas para impuesto a la renta de negocio.',
  personal_expenses:
    'Evalúa exclusivamente si la factura puede corresponder a gastos personales y qué evidencia faltaría para determinarlo.',
}

const V2_OUTPUT_SHAPES: Record<TaxPurpose, Record<string, unknown>> = {
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

export const BILL_ANALYSIS_V2_PROMPT_METADATA = {
  templateId: 'bill-analysis-v2' as const,
  templateVersion: '2' as const,
  templateHash: createHash('sha256')
    .update(
      JSON.stringify({
        purposeInstructions: V2_PURPOSE_INSTRUCTIONS,
        outputShapes: V2_OUTPUT_SHAPES,
        inputProjection: [
          'schemaVersion', 'purpose', 'period', 'contextNotes',
          'taxpayerProfile', 'activities', 'invoice',
          'officialEvidence', 'selfManagedReferences',
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
  private version = 'v1'

  private logger = logger

  constructor() {}

  /**
   * Build a prompt for bill analysis
   *
   * @param jobData - Job data containing collection information
   * @param parsedBill - Parsed bill data
   * @returns Generated prompt string
   */
  build(
    jobData: AnalyzeJobData,
    parsedBill: ParsedBill,
    fiscalReferences: Array<{ name: string; markdown: string }> = [],
    officialReferences: Array<{ name: string; markdown: string }> = [],
  ): string {
    void jobData
    const { billType, vendorName, details, totals } = parsedBill

    // Structure bill data for prompt
    const billDataForPrompt = {
      version: this.version,
      vendor: vendorName,
      itemCount: details.length,
      itemDescriptions: details.map((d) => d.description),
      totals: {
        grossAmount: totals.amount,
        netAmount: totals.net,
        taxes: totals.taxes,
        tip: totals.tip,
      },
      billType,
    }

    // Build final instructions
    const finalInstructions = this.buildInstructions(
      fiscalReferences,
      officialReferences,
    )

    // Replace placeholders
    const prompt = BASE_PROMPT_TEMPLATE.replace(
      '{{BILL_DATA}}',
      JSON.stringify(billDataForPrompt, null, 2),
    ).replace('{{INSTRUCTIONS}}', finalInstructions)

    this.logger.debug('Prompt built', {
      version: this.version,
      billType,
      instructionsLength: finalInstructions.length,
      promptLength: prompt.length,
    })

    return prompt
  }

  /**
   * Builds the purpose-aware V2 prompt from one immutable execution envelope.
   * It deliberately does not query or accept live references, taxpayer IDs, or
   * provider credentials. Production adapters keep using build until F3-04.
   */
  buildV2(envelope: AnalysisExecutionEnvelopeV2, billId: string): string {
    const invoice = envelope.invoices.find((entry) => entry.billId === billId)
    if (!invoice)
      throw new Error('La factura solicitada no forma parte del contexto fijado.')

    const analysisInput = {
      schemaVersion: 'v2',
      prompt: BILL_ANALYSIS_V2_PROMPT_METADATA,
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
      V2_PURPOSE_INSTRUCTIONS[envelope.context.purpose],
      'Usa únicamente el contexto fijado a continuación. No completes hechos con suposiciones ni trates el resultado como dictamen jurídico.',
      'El material oficial publicado tiene prioridad. El material autogestionado solo aporta contexto y no sustituye una fuente oficial.',
      'Devuelve exclusivamente un objeto JSON válido, sin Markdown ni campos extra, con esta forma:',
      JSON.stringify(V2_OUTPUT_SHAPES[envelope.context.purpose], null, 2),
      'Contexto fijado:',
      JSON.stringify(analysisInput, null, 2),
    ].join('\n\n')

    this.logger.debug('V2 prompt built from frozen execution envelope', {
      version: 'v2',
      purpose: envelope.context.purpose,
      billId,
      promptLength: prompt.length,
    })

    return prompt
  }

  /**
   * Build instructions from the bill type and reference material.
   * @private
   */
  private buildInstructions(
    fiscalReferences: Array<{ name: string; markdown: string }> = [],
    officialReferences: Array<{ name: string; markdown: string }> = [],
  ): string {
    let instructions = DEFAULT_INSTRUCTIONS

    if (officialReferences.length > 0) {
      instructions += `\n\nSecciones de fuente oficial publicadas para este análisis:\n${officialReferences
        .map(
          (reference) => `\n--- ${reference.name} ---\n${reference.markdown}`,
        )
        .join('\n')}`
    }

    if (fiscalReferences.length > 0) {
      instructions += `\n\nMaterial de referencia autogestionado (no es una fuente oficial ni una validación jurídica):\n${fiscalReferences
        .map(
          (reference) => `\n--- ${reference.name} ---\n${reference.markdown}`,
        )
        .join('\n')}`
    }

    return instructions
  }

  /**
   * Get version of this builder
   */
  getVersion(): string {
    return this.version
  }

  /**
   * Get metadata about this builder
   */
  getMetadata() {
    return {
      version: this.version,
      template: 'bill-analysis-v1',
      createdAt: DateTime.now().toJSDate(),
    }
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
