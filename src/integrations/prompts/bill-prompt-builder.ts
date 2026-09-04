import { DateTime } from 'luxon'

import { getServiceLogger } from '../logger.server'

import type { ParsedBill } from '#/schema/bill-analysis'
import type { AnalyzeJobData } from '#/schema/collections'

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
