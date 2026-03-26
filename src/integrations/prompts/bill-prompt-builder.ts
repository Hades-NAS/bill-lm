import { DateTime } from 'luxon'

import { getServiceLogger } from '../logger.server'

import type { ParsedBill } from '#/schema/bill-analysis'
import type { AnalyzeJobData } from '#/schema/collections'

const logger = getServiceLogger('BillPromptBuilder')

const AGENT_INSTRUCTIONS = `
Eres un asistente inteligente especializado en analizar facturas y determinar si la factura es objeto para deducibilidad o no, y explicar el por qué en cada caso, basado en las NORMATIVAS VIGENTES del SRI.

Tu tarea es analizar los campos recibidos y en base a las NORMATIVAS VIGENTES del SRI, determinar si la factura es objeto para deducibilidad o no, y explicar el por qué en cada caso.

Estas son las NORMATIVAS VIGENTES del SRI para determinar la deducibilidad de una factura:

Gastos Personales Deductibles en Ecuador 2026
Los gastos personales deducibles incluyen: salud (consultas, medicamentos, seguros, exámenes y veterinaria), educación (matrículas, útiles, cursos y eventos), vivienda (arriendo, alícuotas, intereses hipotecarios, servicios básicos e impuestos), alimentación (compras en supermercados, restaurantes), vestimenta (ropa y calzado) y turismo nacional (hospedajes y paquetes turísticos dentro del país) Contapp.
También puedes incluir:
Alimentación y salud de mascotas, intereses por préstamos quirografarios y sueldos/beneficios de empleados que no estén vinculados a actividades económicas.

El output debe ser un JSON con la siguiente estructura (NO CAMPOS EXTRA, NI TEXTO, SOLO LOS CAMPOS A CONTINUACIÓN):
{
  "percentage": number, // Un número entre 0 y 100 que representa el porcentaje de deducibilidad de la factura
  "reason": string, // Una explicación detallada de por qué la factura tiene ese porcentaje de deducibilidad. Máximo 1000 caracteres.
}

Recuerda que el porcentaje de deducibilidad debe basarse en las NORMATIVAS VIGENTES del SRI y en los campos recibidos de la factura.
Si la factura no tiene información suficiente para determinar su deducibilidad, asigna un porcentaje bajo y explica claramente la razón en el campo "reason".
`

/**
 * Base prompt template for bill analysis
 * Placeholders: {{BILL_DATA}}, {{INSTRUCTIONS}}
 */
const BASE_PROMPT_TEMPLATE = `
Eres un asistente que ayuda a los usuarios a analizar facturas electrónicas.

Tu tarea es analizar los campos recibidos y en base a las NORMATIVAS VIGENTES del SRI, determinar si la factura es objeto para deducibilidad o no, y explicar el por qué en cada caso.

A continuación te proporciono la información de la factura con la data necesaria para que puedas analizarla:
{{BILL_DATA}}

{{INSTRUCTIONS}}
`.trim()

/**
 * Default instructions for bill analysis
 */
const DEFAULT_INSTRUCTIONS = `Se debe analizar esta factura basándose en los campos disponibles de la factura, las NORMATIVAS VIGENTES del SRI para este tipo de facturas.

Gastos Personales Deductibles en Ecuador 2026:
Los gastos personales deductibles incluyen: salud (consultas, medicamentos, seguros, exámenes y veterinaria), educación (matrículas, útiles, cursos y eventos), vivienda (arriendo, alícuotas, intereses hipotecarios, servicios básicos e impuestos), alimentación (compras en supermercados, restaurantes), vestimenta (ropa y calzado) y turismo nacional (hospedajes y paquetes turísticos dentro del país).

También puedes incluir: Alimentación y salud de mascotas, intereses por préstamos quirografarios y sueldos/beneficios de empleados que no estén vinculados a actividades económicas.`

/**
 * Professional-specific instructions suffix
 */
const PROFESSIONAL_INSTRUCTIONS_SUFFIX = `

Adicionalmente a las condiciones generales, se deben considerar las siguientes instrucciones específicas para facturas de tipo PROFESSIONAL:
{{CUSTOM_INSTRUCTIONS}}

Estas instrucciones específicas son una extensión de las condiciones generales, pero no deben cumplirse ambas, ya que una factura puede ser un consumo personal (NORMATIVAS VIGENTES del SRI) o un gasto profesional (instrucciones específicas), y con que cumpla una de las dos condiciones, la factura ya sería deducible.`

/**
 * BillPromptBuilder
 *
 * Centralizes prompt construction for bill analysis.
 * Supports versioning, templating, and custom instructions.
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
   * @param jobData - Job data containing collection info and instructions
   * @param parsedBill - Parsed bill data
   * @returns Generated prompt string
   */
  build(jobData: AnalyzeJobData, parsedBill: ParsedBill): string {
    const { instructions } = jobData.data
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
    const finalInstructions = this.buildInstructions(billType, instructions)

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
   * Build instructions based on bill type and custom instructions
   * @private
   */
  private buildInstructions(
    billType: string,
    customInstructions?: string,
  ): string {
    let instructions = DEFAULT_INSTRUCTIONS

    // Add professional-specific instructions if applicable
    if (
      billType === 'PROFESSIONAL' &&
      customInstructions &&
      customInstructions.trim()
    ) {
      instructions += PROFESSIONAL_INSTRUCTIONS_SUFFIX.replace(
        '{{CUSTOM_INSTRUCTIONS}}',
        customInstructions,
      )
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
