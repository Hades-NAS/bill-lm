import type { JsonSchemaDefinition } from '@openai/agents'
import { z } from 'zod'

import { ModelTaxAnalysisPayloadSchema } from '#/schema/tax-analysis'

type JsonSchema = Record<string, unknown>

function isRecord(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nullable(schema: JsonSchema): JsonSchema {
  if (typeof schema.type === 'string')
    return { ...schema, type: [schema.type, 'null'] }
  return { anyOf: [schema, { type: 'null' }] }
}

function strictVariantSchema(source: JsonSchema): JsonSchema {
  const properties = isRecord(source.properties) ? source.properties : {}
  const required = new Set(
    Array.isArray(source.required)
      ? source.required.filter(
          (field): field is string => typeof field === 'string',
        )
      : [],
  )
  return {
    ...source,
    properties: Object.fromEntries(
      Object.entries(properties).map(([name, schema]) => [
        name,
        required.has(name) ? schema : nullable(isRecord(schema) ? schema : {}),
      ]),
    ),
    required: Object.keys(properties),
    additionalProperties: false,
  }
}

function strictAnalysisAgentSchema(source: unknown): JsonSchema {
  if (!isRecord(source) || !Array.isArray(source.oneOf))
    throw new Error(
      'El contrato tributario no pudo convertirse al esquema de Agents.',
    )

  return {
    type: 'object',
    properties: {
      payload: {
        anyOf: source.oneOf.filter(isRecord).map(strictVariantSchema),
      },
    },
    required: ['payload'],
    additionalProperties: false,
  }
}

/**
 * A strict object root is required by Structured Outputs. Nesting the purpose
 * union prevents the model from mixing fields from unrelated tax purposes.
 */
export const TaxAnalysisAgentOutputType: JsonSchemaDefinition = {
  type: 'json_schema',
  name: 'tax_analysis',
  strict: true,
  schema: strictAnalysisAgentSchema(
    z.toJSONSchema(ModelTaxAnalysisPayloadSchema),
  ) as JsonSchemaDefinition['schema'],
}
