import { describe, expect, it } from 'vitest'

import {
  runTaxRuleBatch,
  runTaxRulePipeline,
  summarizeTaxRuleBatch,
  TaxRuleCommandError,
} from '../command-runner'

describe('tax rule command runner', () => {
  it('continues with later sources and reports a safe error per failure', async () => {
    const results = await runTaxRuleBatch(
      [{ id: 'first' }, { id: 'second' }, { id: 'third' }],
      async (source) => {
        if (source.id === 'second')
          throw new TaxRuleCommandError('El PDF no tiene texto seleccionable.')
        return { processed: source.id }
      },
    )

    expect(results).toEqual([
      {
        sourceId: 'first',
        status: 'completed',
        detail: { processed: 'first' },
      },
      {
        sourceId: 'second',
        status: 'failed',
        message: 'El PDF no tiene texto seleccionable.',
      },
      {
        sourceId: 'third',
        status: 'completed',
        detail: { processed: 'third' },
      },
    ])
    expect(summarizeTaxRuleBatch(results)).toEqual({
      total: 3,
      completed: 2,
      failed: 1,
    })
  })

  it('does not expose an unexpected internal error', async () => {
    const [result] = await runTaxRuleBatch([{ id: 'one' }], async () => {
      throw new Error('database password=secret')
    })
    expect(result).toEqual({
      sourceId: 'one',
      status: 'failed',
      message:
        'No se pudo procesar la fuente. Revisa que el paso anterior haya terminado y vuelve a intentarlo.',
    })
  })

  it('runs every stage per source, stops only the failed source, and preserves progress', async () => {
    const calls: Array<string> = []
    const results = await runTaxRulePipeline(
      [{ id: 'first' }, { id: 'second' }],
      [
        {
          name: 'check',
          run: async (source) => {
            calls.push(`check:${source.id}`)
            return 'checked'
          },
        },
        {
          name: 'fetch',
          run: async (source) => {
            calls.push(`fetch:${source.id}`)
            if (source.id === 'first')
              throw new TaxRuleCommandError(
                'No se pudo descargar la fuente oficial.',
              )
            return 'fetched'
          },
        },
      ],
    )

    expect(calls).toEqual([
      'check:first',
      'fetch:first',
      'check:second',
      'fetch:second',
    ])
    expect(results).toEqual([
      {
        sourceId: 'first',
        status: 'failed',
        detail: {
          failedStage: 'fetch',
          stages: [{ name: 'check', status: 'completed', detail: 'checked' }],
        },
        message: 'No se pudo descargar la fuente oficial.',
      },
      {
        sourceId: 'second',
        status: 'completed',
        detail: {
          stages: [
            { name: 'check', status: 'completed', detail: 'checked' },
            { name: 'fetch', status: 'completed', detail: 'fetched' },
          ],
        },
      },
    ])
  })
})
