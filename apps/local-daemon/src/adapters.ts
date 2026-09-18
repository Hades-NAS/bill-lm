import type { LocalConnection } from '@bill-lm/contracts'

export type LocalAdapterFailureCause = 'secret' | 'transport' | 'http' | 'protocol' | 'invalid-output'
export type LocalAdapterProbeResult = { ok: true } | { ok: false; message: string; cause: LocalAdapterFailureCause }
export type LocalAdapterAnalyzeResult = { ok: true; payload: unknown } | { ok: false; message: string; cause: LocalAdapterFailureCause }
export type LocalAnalysisRequest = { connection: LocalConnection; runId: string; prompt: string; outputSchema: Record<string, unknown> }

export interface LocalLlmAdapter {
  probe(connection: LocalConnection): Promise<LocalAdapterProbeResult>
  analyze(input: LocalAnalysisRequest): Promise<LocalAdapterAnalyzeResult>
}

type FetchImplementation = typeof fetch

export function resolveLocalSecret(reference?: string) {
  if (!reference) return undefined
  if (!reference.startsWith('env:')) throw new Error('La referencia de secreto requiere un proveedor local.')
  const value = process.env[reference.slice(4)]
  if (!value) throw new Error('No se encontró el secreto local configurado.')
  return value
}

function endpoint(baseUrl: string, path: string) {
  const url = new URL(baseUrl)
  url.pathname = `${url.pathname.replace(/\/$/, '')}/${path.replace(/^\//, '')}`.replace(/\/+/g, '/')
  url.search = ''
  url.hash = ''
  return url
}

function failure(cause: LocalAdapterFailureCause, message: string): { ok: false; message: string; cause: LocalAdapterFailureCause } {
  return { ok: false, cause, message }
}

function isAdapterFailure(value: unknown): value is { ok: false; message: string; cause: LocalAdapterFailureCause } {
  return typeof value === 'object' && value !== null && 'cause' in value && 'message' in value
}

abstract class HttpLocalLlmAdapter implements LocalLlmAdapter {
  constructor(private readonly fetchImplementation: FetchImplementation) {}
  abstract probePath(connection: LocalConnection): string
  abstract analyzePath(connection: LocalConnection): string
  abstract requestHeaders(secret?: string): HeadersInit
  abstract analysisBody(input: LocalAnalysisRequest): Record<string, unknown>
  abstract parsePayload(response: unknown): unknown | null

  async probe(connection: LocalConnection): Promise<LocalAdapterProbeResult> {
    let secret: string | undefined
    try { secret = resolveLocalSecret(connection.secretRef) } catch { return failure('secret', 'No se pudo resolver el secreto local.') }
    const result = await this.request(connection, this.probePath(connection), { headers: this.requestHeaders(secret) })
    if (!result.ok) return result
    return result.response && typeof result.response === 'object'
      ? { ok: true }
      : failure('protocol', 'El servidor local devolvió una respuesta inválida.')
  }

  async analyze(input: LocalAnalysisRequest): Promise<LocalAdapterAnalyzeResult> {
    let secret: string | undefined
    try { secret = resolveLocalSecret(input.connection.secretRef) } catch { return failure('secret', 'No se pudo resolver el secreto local.') }
    const result = await this.request(input.connection, this.analyzePath(input.connection), {
      method: 'POST',
      headers: { ...this.requestHeaders(secret), 'content-type': 'application/json' },
      body: JSON.stringify(this.analysisBody(input)),
    })
    if (!result.ok) return result
    const payload = this.parsePayload(result.response)
    return payload === null ? failure('protocol', 'El servidor local no devolvió JSON estructurado.') : { ok: true, payload }
  }

  private async request(connection: LocalConnection, path: string, init: RequestInit): Promise<{ ok: true; response: unknown } | { ok: false; message: string; cause: LocalAdapterFailureCause }> {
    let response: Response
    try { response = await this.fetchImplementation(endpoint(connection.baseUrl, path), init) }
    catch (error) { return isAdapterFailure(error) ? error : failure('transport', 'No se pudo conectar al servidor local.') }
    if (!response.ok) return failure('http', `El servidor local respondió ${response.status}.`)
    try { return { ok: true, response: await response.json() } }
    catch { return failure('protocol', 'El servidor local devolvió una respuesta inválida.') }
  }
}

class OpenAiLikeAdapter extends HttpLocalLlmAdapter {
  probePath() { return 'models' }
  analyzePath() { return 'chat/completions' }
  requestHeaders(secret?: string): Record<string, string> { return secret ? { authorization: `Bearer ${secret}` } : {} }
  analysisBody(input: LocalAnalysisRequest) { return { model: input.connection.model, messages: [{ role: 'user', content: input.prompt }], response_format: { type: 'json_object' } } }
  parsePayload(response: unknown) {
    const content = (response as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content
    if (typeof content !== 'string') return null
    try { return JSON.parse(content) } catch { return null }
  }
}

class ClaudeLikeAdapter extends HttpLocalLlmAdapter {
  probePath(connection: LocalConnection) { return connection.baseUrl.replace(/\/$/, '').endsWith('/v1') ? 'models' : 'v1/models' }
  analyzePath(connection: LocalConnection) { return connection.baseUrl.replace(/\/$/, '').endsWith('/v1') ? 'messages' : 'v1/messages' }
  requestHeaders(secret?: string): Record<string, string> { return { 'anthropic-version': '2023-06-01', ...(secret ? { 'x-api-key': secret } : {}) } }
  analysisBody(input: LocalAnalysisRequest) { return { model: input.connection.model, max_tokens: 2048, messages: [{ role: 'user', content: input.prompt }] } }
  parsePayload(response: unknown) {
    const text = (response as { content?: Array<{ type?: unknown; text?: unknown }> })?.content?.find((block) => block.type === 'text')?.text
    if (typeof text !== 'string') return null
    try { return JSON.parse(text) } catch { return null }
  }
}

export function createLocalLlmAdapter(connection: LocalConnection, fetchImplementation: FetchImplementation = fetch): LocalLlmAdapter {
  return connection.apiFlavor === 'openai-like' ? new OpenAiLikeAdapter(fetchImplementation) : new ClaudeLikeAdapter(fetchImplementation)
}

export async function probeLocalConnection(connection: LocalConnection) {
  return createLocalLlmAdapter(connection).probe(connection)
}
