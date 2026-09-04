import { describe, expect, it } from 'vitest'

import {
  runTaxRuleBatch,
  summarizeTaxRuleBatch,
  TaxRuleCommandError,
} from '../command-runner'

describe('tax rule command runner', () => {
  it('continues with later sources and reports a safe error per failure', async () => {
    const results = await runTaxRuleBatch(
      [{ id: 'first' }, { id: 'second' }, { id: 'third' }],
      async (source) => {
        if (source.id === 'second') throw new TaxRuleCommandError('El PDF no tiene texto seleccionable.')
        return { processed: source.id }
      },
    )

    expect(results).toEqual([
      { sourceId: 'first', status: 'completed', detail: { processed: 'first' } },
      { sourceId: 'second', status: 'failed', message: 'El PDF no tiene texto seleccionable.' },
      { sourceId: 'third', status: 'completed', detail: { processed: 'third' } },
    ])
    expect(summarizeTaxRuleBatch(results)).toEqual({ total: 3, completed: 2, failed: 1 })
  })

  it('does not expose an unexpected internal error', async () => {
    const [result] = await runTaxRuleBatch([{ id: 'one' }], async () => {
      throw new Error('database password=secret')
    })
    expect(result).toEqual({
      sourceId: 'one',
      status: 'failed',
      message: 'No se pudo procesar la fuente. Revisa que el paso anterior haya terminado y vuelve a intentarlo.',
    })
  })
})
