import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'

import {
  assertFiscalReferenceLimit,
  assertFiscalReferenceSource,
  canAnalyzeWithRequirements,
  fiscalReferenceContentHash,
  FiscalReferenceInputError,
  normalizeFiscalReferenceMarkdown,
  pdfBufferToNormalizedMarkdown,
  withStorageCleanupOnFailure,
} from '../normalizer.server'

describe('normalizeFiscalReferenceMarkdown', () => {
  it('cleans line endings and adds a neutral self-managed heading', () => {
    expect(
      normalizeFiscalReferenceMarkdown('  Regla A  \r\n\r\n\r\nRegla B  '),
    ).toBe('# Referencia fiscal autogestionada\n\nRegla A\n\nRegla B\n')
  })

  it('rejects a reference without extractable text', () => {
    expect(() => normalizeFiscalReferenceMarkdown(' \n\t ')).toThrow(
      FiscalReferenceInputError,
    )
  })

  it('hashes the normalized content deterministically', () => {
    const markdown = '# Referencia\n\nContenido\n'
    expect(fiscalReferenceContentHash(markdown)).toBe(
      fiscalReferenceContentHash(markdown),
    )
  })

  it('rejects a fake PDF before attempting text extraction', () => {
    expect(() =>
      assertFiscalReferenceSource(Buffer.from('not a PDF'), 'application/pdf'),
    ).toThrow('cabecera PDF válida')
  })

  it('rejects binary content disguised as Markdown', () => {
    expect(() =>
      assertFiscalReferenceSource(
        Buffer.from([0x23, 0x20, 0x61, 0x00]),
        'text/markdown',
      ),
    ).toThrow('datos binarios')
  })

  it('rejects a structurally invalid PDF with a clear text-PDF error', async () => {
    await expect(
      pdfBufferToNormalizedMarkdown(Buffer.from('%PDF-not-a-real-document')),
    ).rejects.toThrow('No se pudo extraer texto del PDF')
  })

  it('extracts a valid text-based PDF into cleaned Markdown', async () => {
    const fixture = await readFile(
      new URL('./fixtures/text-reference.pdf', import.meta.url),
    )

    await expect(pdfBufferToNormalizedMarkdown(fixture)).resolves.toBe(
      '# Referencia fiscal autogestionada\n\nReferencia fiscal de prueba\n',
    )
  })

  it('enforces the global reference limit without requiring a reference to analyze', () => {
    expect(() => assertFiscalReferenceLimit(3)).toThrow('hasta tres')
    expect(canAnalyzeWithRequirements(1, 0)).toBe(true)
    expect(canAnalyzeWithRequirements(0, 1)).toBe(false)
    expect(canAnalyzeWithRequirements(1, 1)).toBe(true)
  })

  it('cleans a stored object when persistence fails', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined)
    await expect(
      withStorageCleanupOnFailure(
        async () => Promise.reject(new Error('database unavailable')),
        cleanup,
      ),
    ).rejects.toThrow('database unavailable')
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
