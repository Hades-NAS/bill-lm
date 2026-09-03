import { isUtf8 } from 'node:buffer'
import { createHash } from 'node:crypto'
import { PDFParse } from 'pdf-parse'

import { FISCAL_REFERENCE_MAX_NORMALIZED_CHARS } from '#/schema/fiscal-references'

export class FiscalReferenceInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FiscalReferenceInputError'
  }
}

export function assertFiscalReferenceSource(
  buffer: Buffer,
  mimeType: 'application/pdf' | 'text/markdown' | 'text/plain',
): void {
  if (mimeType === 'application/pdf') {
    if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-')))
      throw new FiscalReferenceInputError(
        'El archivo declarado como PDF no contiene una cabecera PDF válida.',
      )
    return
  }

  if (buffer.includes(0) || !isUtf8(buffer))
    throw new FiscalReferenceInputError(
      'Las referencias Markdown deben ser texto UTF-8 y no contener datos binarios.',
    )
}

export function assertFiscalReferenceLimit(activeReferenceCount: number): void {
  if (activeReferenceCount >= 3)
    throw new FiscalReferenceInputError(
      'Solo puedes mantener hasta tres referencias fiscales.',
    )
}

export const canAnalyzeWithRequirements = (
  activeConnectionCount: number,
  activeReferenceCount: number,
) => activeConnectionCount > 0 && activeReferenceCount > 0

export async function withStorageCleanupOnFailure<T>(
  operation: () => Promise<T>,
  cleanup: () => Promise<unknown>,
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    await cleanup().catch(() => undefined)
    throw error
  }
}

export function normalizeFiscalReferenceMarkdown(source: string): string {
  const cleaned = source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/^--\s+\d+\s+of\s+\d+\s+--\s*$/gm, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!cleaned)
    throw new FiscalReferenceInputError(
      'El archivo no contiene texto que se pueda usar como referencia.',
    )
  if (cleaned.length > FISCAL_REFERENCE_MAX_NORMALIZED_CHARS)
    throw new FiscalReferenceInputError(
      'La referencia normalizada supera el máximo de 20 000 caracteres.',
    )

  return cleaned.startsWith('#')
    ? `${cleaned}\n`
    : `# Referencia fiscal autogestionada\n\n${cleaned}\n`
}

export async function pdfBufferToNormalizedMarkdown(
  buffer: Buffer,
): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  try {
    const { text } = await parser.getText()
    return normalizeFiscalReferenceMarkdown(text)
  } catch (error) {
    if (error instanceof FiscalReferenceInputError) throw error
    throw new FiscalReferenceInputError(
      'No se pudo extraer texto del PDF. Usa un PDF con texto seleccionable; OCR no está disponible.',
    )
  } finally {
    await parser.destroy()
  }
}

export const fiscalReferenceContentHash = (markdown: string) =>
  createHash('sha256').update(markdown).digest('hex')
