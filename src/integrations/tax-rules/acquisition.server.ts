import { createHash } from 'node:crypto'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFParse } from 'pdf-parse'

import type { TaxRuleSourceManifest } from './contracts'

const SRI_HOST = 'www.sri.gob.ec'
const MAX_PDF_BYTES = 20 * 1024 * 1024
const MAX_REDIRECTS = 3
const REQUEST_TIMEOUT_MS = 30_000

export class TaxRuleAcquisitionError extends Error {}

type FetchLike = (
  input: URL | RequestInfo,
  init?: RequestInit,
) => Promise<Response>

function assertOfficialSriUrl(url: string) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || parsed.hostname !== SRI_HOST)
    throw new TaxRuleAcquisitionError(
      'La fuente debe usar HTTPS en www.sri.gob.ec.',
    )
  return parsed
}

function normalizeExtractedMarkdown(markdown: string) {
  const cleaned = markdown
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!cleaned)
    throw new TaxRuleAcquisitionError(
      'No se pudo extraer texto del PDF. Usa un PDF con texto seleccionable; OCR no está disponible.',
    )

  return `${cleaned}\n`
}

type DownloadedSriPdf = {
  buffer: Buffer
  resolvedUrl: string
  contentHash: string
  size: number
  contentType: string
  contentLength: number | null
  lastModified: string | null
}

async function downloadOfficialSriPdf(
  source: TaxRuleSourceManifest,
  fetcher: FetchLike,
): Promise<DownloadedSriPdf> {
  let currentUrl = source.resolvedUrl ?? source.discoveryUrl
  let response: Response | undefined
  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      assertOfficialSriUrl(currentUrl)
      response = await fetcher(currentUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (response.status < 300 || response.status >= 400) break
      const location = response.headers.get('location')
      if (!location)
        throw new TaxRuleAcquisitionError('La redirección no contiene destino.')
      currentUrl = new URL(location, currentUrl).toString()
    }
  } catch (error) {
    if (error instanceof TaxRuleAcquisitionError) throw error
    if (error instanceof DOMException && error.name === 'TimeoutError')
      throw new TaxRuleAcquisitionError(
        'El SRI tardó demasiado en responder. Intenta de nuevo más tarde.',
      )
    throw new TaxRuleAcquisitionError(
      'No se pudo conectar con la fuente oficial del SRI.',
    )
  }
  if (!response?.ok)
    throw new TaxRuleAcquisitionError('No se pudo descargar la fuente oficial.')
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('application/pdf'))
    throw new TaxRuleAcquisitionError('La fuente oficial no respondió un PDF.')
  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (contentLength > MAX_PDF_BYTES)
    throw new TaxRuleAcquisitionError('El PDF supera el límite de 20 MB.')
  const buffer = Buffer.from(await response.arrayBuffer())
  if (
    buffer.length > MAX_PDF_BYTES ||
    !buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))
  )
    throw new TaxRuleAcquisitionError(
      'El archivo descargado no es un PDF válido dentro del límite.',
    )
  return {
    buffer,
    resolvedUrl: currentUrl,
    contentHash: `sha256:${createHash('sha256').update(buffer).digest('hex')}`,
    size: buffer.length,
    contentType,
    contentLength:
      Number.isFinite(contentLength) && contentLength > 0
        ? contentLength
        : null,
    lastModified: response.headers.get('last-modified'),
  }
}

export async function checkTaxRuleSource(
  source: TaxRuleSourceManifest,
  observedContentHash?: string | null,
  fetcher: FetchLike = fetch,
) {
  if (!source.resolvedUrl)
    return { sourceId: source.id, status: 'source-unresolved' as const }
  const downloaded = await downloadOfficialSriPdf(source, fetcher)
  return {
    sourceId: source.id,
    status:
      observedContentHash === downloaded.contentHash
        ? ('unchanged' as const)
        : ('update-candidate' as const),
    observedContentHash: downloaded.contentHash,
    resolvedUrl: downloaded.resolvedUrl,
  }
}

export async function fetchTaxRuleSource(
  source: TaxRuleSourceManifest,
  cacheRoot: string,
  fetcher: FetchLike = fetch,
) {
  const downloaded = await downloadOfficialSriPdf(source, fetcher)
  const directory = join(cacheRoot, 'originals')
  await mkdir(directory, { recursive: true })
  const path = join(
    directory,
    `${source.id}-${downloaded.contentHash.slice(7)}.pdf`,
  )
  const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`
  await writeFile(temporaryPath, downloaded.buffer)
  await rename(temporaryPath, path)
  const { buffer: _buffer, ...metadata } = downloaded
  return { path, ...metadata }
}

export async function extractTaxRulePdf(pdf: Buffer) {
  const parser = new PDFParse({ data: pdf })
  try {
    const { text } = await parser.getText({
      pageJoiner: '\n\n<!-- page page_number of total_number -->\n\n',
    })
    return normalizeExtractedMarkdown(text)
  } catch (error) {
    if (error instanceof TaxRuleAcquisitionError) throw error
    throw new TaxRuleAcquisitionError(
      'No se pudo extraer texto del PDF. Usa un PDF con texto seleccionable; OCR no está disponible.',
    )
  } finally {
    await parser.destroy()
  }
}
