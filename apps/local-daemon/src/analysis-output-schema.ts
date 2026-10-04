import { ModelTaxAnalysisPayloadSchema } from '@bill-lm/contracts'
import type { ModelTaxAnalysisPayload } from '@bill-lm/contracts'
import type { JsonSchemaDefinition } from '@openai/agents'
import { z } from 'zod'

type JsonSchema = Record<string, unknown>

function isRecord(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nullable(schema: JsonSchema): JsonSchema {
  if (typeof schema.type === 'string')
    return { ...schema, type: [schema.type, 'null'] }
  return { anyOf: [schema, { type: 'null' }] }
}

/**
 * OpenAI Structured Outputs requires every object property to be required
 * under strict mode. The source contract has purpose-specific optional
 * fields, so they are emitted as null and removed before Zod validation.
 */
function strictLocalTaxAnalysisSchema(source: unknown): JsonSchema {
  if (!isRecord(source) || !Array.isArray(source.oneOf))
    throw new Error('El contrato tributario no pudo convertirse a JSON Schema.')

  const variants = source.oneOf.filter(isRecord)
  const propertyNames = new Set<string>()
  const requiredByVariant = variants.map(
    (variant) =>
      new Set(
        Array.isArray(variant.required)
          ? variant.required.filter(
              (item): item is string => typeof item === 'string',
            )
          : [],
      ),
  )
  const propertiesByVariant = variants.map((variant) =>
    isRecord(variant.properties) ? variant.properties : {},
  )
  for (const properties of propertiesByVariant)
    Object.keys(properties).forEach((name) => propertyNames.add(name))

  const properties: JsonSchema = {}
  for (const name of propertyNames) {
    const candidates = propertiesByVariant
      .map((variant) => variant[name])
      .filter(isRecord)
    const constants = candidates
      .map((candidate) => candidate.const)
      .filter((value): value is string => typeof value === 'string')
    const base =
      constants.length > 0
        ? { type: 'string', enum: constants }
        : candidates[0]!
    const requiredEverywhere = requiredByVariant.every((required) =>
      required.has(name),
    )
    properties[name] = requiredEverywhere ? base : nullable(base)
  }

  return {
    type: 'object',
    properties,
    required: [...propertyNames],
    additionalProperties: false,
  }
}

export const LocalTaxAnalysisOutputJsonSchema = strictLocalTaxAnalysisSchema(
  z.toJSONSchema(ModelTaxAnalysisPayloadSchema),
)

/**
 * The Agents SDK needs an object at the schema root. Keeping the tax-purpose
 * union beneath `payload` preserves each branch's strict fields instead of
 * flattening every branch into one model-facing object. Optional branch fields
 * use null sentinels because strict Structured Outputs requires all fields.
 */
function strictVariantSchema(source: JsonSchema): JsonSchema {
  const properties = isRecord(source.properties) ? source.properties : {}
  const required = new Set(
    Array.isArray(source.required)
      ? source.required.filter(
          (item): item is string => typeof item === 'string',
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

function strictLocalTaxAnalysisAgentSchema(
  source: unknown,
  purpose?: ModelTaxAnalysisPayload['purpose'],
): JsonSchema {
  if (!isRecord(source) || !Array.isArray(source.oneOf))
    throw new Error(
      'El contrato tributario no pudo convertirse al esquema de Agents.',
    )

  const variants = source.oneOf.filter(isRecord).filter((variant) => {
    if (!purpose) return true
    const properties = isRecord(variant.properties) ? variant.properties : {}
    const purposeProperty = isRecord(properties.purpose)
      ? properties.purpose
      : {}
    return purposeProperty.const === purpose
  })
  if (variants.length === 0)
    throw new Error('El propósito tributario no tiene un esquema de salida.')

  return {
    type: 'object',
    properties: {
      payload: {
        anyOf: variants.map(strictVariantSchema),
      },
    },
    required: ['payload'],
    additionalProperties: false,
  }
}

export const LocalTaxAnalysisAgentOutputType: JsonSchemaDefinition = {
  type: 'json_schema' as const,
  name: 'local_tax_analysis',
  strict: true,
  schema: strictLocalTaxAnalysisAgentSchema(
    z.toJSONSchema(ModelTaxAnalysisPayloadSchema),
  ) as JsonSchemaDefinition['schema'],
}

/**
 * Narrows structured output to the collection purpose before the model runs.
 * A model therefore cannot choose VAT/business output for a personal-expense
 * collection that deliberately has no economic activity identifiers.
 */
export function localTaxAnalysisAgentOutputTypeForPurpose(
  purpose: ModelTaxAnalysisPayload['purpose'],
): JsonSchemaDefinition {
  return {
    type: 'json_schema' as const,
    name: `local_tax_analysis_${purpose}`,
    strict: true,
    schema: strictLocalTaxAnalysisAgentSchema(
      z.toJSONSchema(ModelTaxAnalysisPayloadSchema),
      purpose,
    ) as JsonSchemaDefinition['schema'],
  }
}

/** Converts strict-output null sentinels back to Zod's optional properties. */
export function omitNullOutputFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(omitNullOutputFields)
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, field]) => field !== null)
      .map(([key, field]) => [key, omitNullOutputFields(field)]),
  )
}
