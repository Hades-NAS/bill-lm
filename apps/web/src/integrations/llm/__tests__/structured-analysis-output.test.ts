import { expect, it } from 'vitest'

import { TaxAnalysisAgentOutputType } from '../structured-analysis-output'

it('preserves the three strict tax-purpose variants under an object root for Agents', () => {
  const payload = TaxAnalysisAgentOutputType.schema.properties.payload as {
    anyOf: Array<{
      additionalProperties: boolean
      properties: Record<string, unknown>
      required: string[]
    }>
  }

  expect(TaxAnalysisAgentOutputType).toMatchObject({
    type: 'json_schema',
    name: 'tax_analysis',
    strict: true,
    schema: { type: 'object', required: ['payload'], additionalProperties: false },
  })
  expect(payload.anyOf).toHaveLength(3)
  for (const variant of payload.anyOf) {
    expect(variant.additionalProperties).toBe(false)
    expect(variant.required).toEqual(Object.keys(variant.properties))
  }
})
