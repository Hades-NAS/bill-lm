import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  checkTaxRuleSource,
  fetchTaxRuleSource,
  TaxRuleAcquisitionError,
} from '../acquisition.server'

const source = { schemaVersion: '1' as const, id: 'ec-sri-lrti', issuer: 'Servicio de Rentas Internas' as const, jurisdiction: 'EC' as const, sourceKind: 'law' as const, discoveryUrl: 'https://www.sri.gob.ec/source.pdf', resolvedUrl: null, mimeType: null, retrievedAt: null, contentHash: null, effectiveFrom: null, effectiveTo: null, reviewStatus: 'draft' as const }

describe('official rule acquisition', () => {
  it('rejects a non-SRI redirect before downloading it', async () => {
    await expect(fetchTaxRuleSource(source, '/tmp', async () => new Response(null, { status: 302, headers: { location: 'https://example.com/file.pdf' } }))).rejects.toBeInstanceOf(TaxRuleAcquisitionError)
  })

  it('rejects a response without PDF magic bytes', async () => {
    await expect(fetchTaxRuleSource(source, '/tmp', async () => new Response('not a pdf', { headers: { 'content-type': 'application/pdf' } }))).rejects.toBeInstanceOf(TaxRuleAcquisitionError)
  })

  it('checks the live official PDF against the observed local hash without writing it', async () => {
    const pdf = Buffer.from('%PDF-1.7\nexample')
    const observedContentHash = `sha256:${createHash('sha256').update(pdf).digest('hex')}`
    const result = await checkTaxRuleSource(
      { ...source, resolvedUrl: source.discoveryUrl },
      observedContentHash,
      async () => new Response(pdf, {
        headers: {
          'content-type': 'application/pdf',
          'content-length': String(pdf.length),
          'last-modified': 'Thu, 01 Jan 2026 00:00:00 GMT',
        },
      }),
    )

    expect(result).toEqual({
      sourceId: source.id,
      status: 'unchanged',
      observedContentHash,
      resolvedUrl: source.discoveryUrl,
    })
  })

  it('stores a verified SRI PDF atomically outside versioned resources', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'bill-lm-tax-rules-'))
    try {
      const result = await fetchTaxRuleSource(source, directory, async () =>
        new Response(Buffer.from('%PDF-1.7\nexample'), {
          headers: { 'content-type': 'application/pdf' },
        }),
      )
      expect(result.path).toMatch(/originals\/ec-sri-lrti-[a-f0-9]{64}\.pdf$/)
      expect(result).not.toHaveProperty('buffer')
      await expect(readFile(result.path)).resolves.toEqual(Buffer.from('%PDF-1.7\nexample'))
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
