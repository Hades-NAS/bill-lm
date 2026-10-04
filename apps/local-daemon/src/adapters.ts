import {
  Agent,
  MaxTurnsExceededError,
  ModelBehaviorError,
  ModelRefusalError,
  ModelTimeoutError,
  run,
  setTracingDisabled,
  SystemError,
} from '@openai/agents'
import { OpenAIChatCompletionsModel } from '@openai/agents-openai'
import OpenAI from 'openai'

import {
  LocalTaxAnalysisAgentOutputType,
  localTaxAnalysisAgentOutputTypeForPurpose,
} from './analysis-output-schema'

import type {
  ModelTaxAnalysisPayload,
  LocalConnection,
} from '@bill-lm/contracts'

setTracingDisabled(true)

// Reasoning-capable local models can spend the entire default output budget
// before emitting the structured JSON in `message.content`.
const LOCAL_OPENAI_MAX_TOKENS = 20_480

export type LocalAdapterFailureCause =
  | 'secret'
  | 'transport'
  | 'http'
  | 'protocol'
  | 'invalid-output'
export type LocalAdapterProbeResult =
  | { ok: true }
  | { ok: false; message: string; cause: LocalAdapterFailureCause }
export type LocalAdapterResponseVariant =
  | 'openai-message-missing'
  | 'openai-reasoning-content-only'
  | 'openai-reasoning-only'
  | 'openai-tool-calls-only'
  | 'openai-refusal-only'
  | 'openai-content-missing'
export type LocalAdapterContentKind =
  | 'markdown-fence'
  | 'json-object-malformed'
  | 'json-array'
  | 'json-scalar'
  | 'plain-text'
export type LocalAdapterJsonParseReason = 'unexpected-end' | 'invalid-syntax'
export type LocalAgentsErrorKind =
  | 'model-behavior'
  | 'model-refusal'
  | 'max-turns'
  | 'model-timeout'
  | 'system'
  | 'other'

export type LocalAdapterAnalyzeResult =
  | { ok: true; payload: unknown }
  | {
      ok: false
      message: string
      cause: LocalAdapterFailureCause
      responseVariant?: LocalAdapterResponseVariant
      contentKind?: LocalAdapterContentKind
      contentBytes?: number
      jsonParseReason?: LocalAdapterJsonParseReason
      finishReason?: string
      agentsErrorKind?: LocalAgentsErrorKind
      agentsTimeoutMs?: number
    }
export type LocalAnalysisRequest = {
  connection: LocalConnection
  runId: string
  prompt: string
  outputSchema: Record<string, unknown>
  purpose?: ModelTaxAnalysisPayload['purpose']
}

export interface LocalLlmAdapter {
  probe: (connection: LocalConnection) => Promise<LocalAdapterProbeResult>
  analyze: (input: LocalAnalysisRequest) => Promise<LocalAdapterAnalyzeResult>
}

type FetchImplementation = typeof fetch

export function resolveLocalSecret(reference?: string) {
  if (!reference) return undefined
  if (!reference.startsWith('env:'))
    throw new Error('La referencia de secreto requiere un proveedor local.')
  const value = process.env[reference.slice(4)]
  if (!value) throw new Error('No se encontró el secreto local configurado.')
  return value
}

function endpoint(baseUrl: string, path: string) {
  const url = new URL(baseUrl)
  url.pathname =
    `${url.pathname.replace(/\/$/, '')}/${path.replace(/^\//, '')}`.replace(
      /\/+/g,
      '/',
    )
  url.search = ''
  url.hash = ''
  return url
}

function failure(
  cause: LocalAdapterFailureCause,
  message: string,
  responseVariant?: LocalAdapterResponseVariant,
  diagnostics: Omit<
    Extract<LocalAdapterAnalyzeResult, { ok: false }>,
    'ok' | 'message' | 'cause' | 'responseVariant'
  > = {},
): Extract<LocalAdapterAnalyzeResult, { ok: false }> {
  return { ok: false, cause, message, responseVariant, ...diagnostics }
}

function isAdapterFailure(
  value: unknown,
): value is Extract<LocalAdapterAnalyzeResult, { ok: false }> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'cause' in value &&
    'message' in value
  )
}

function parseModelJson(content: string):
  | { payload: unknown }
  | {
      contentKind: LocalAdapterContentKind
      contentBytes: number
      jsonParseReason: LocalAdapterJsonParseReason
    } {
  const candidates = [
    content.trim(),
    ...Array.from(
      content.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi),
      (match) => match[1]?.trim() ?? '',
    ),
  ]
  const firstObject = content.indexOf('{')
  const lastObject = content.lastIndexOf('}')
  if (firstObject >= 0 && lastObject > firstObject)
    candidates.push(content.slice(firstObject, lastObject + 1))

  let jsonParseReason: LocalAdapterJsonParseReason = 'invalid-syntax'
  for (const candidate of candidates) {
    try {
      return { payload: JSON.parse(candidate) }
    } catch (error) {
      if (error instanceof SyntaxError && /unexpected end/i.test(error.message))
        jsonParseReason = 'unexpected-end'
    }
  }
  const trimmed = content.trim()
  const contentKind: LocalAdapterContentKind = trimmed.startsWith('```')
    ? 'markdown-fence'
    : trimmed.startsWith('{')
      ? 'json-object-malformed'
      : trimmed.startsWith('[')
        ? 'json-array'
        : /^[-+]?\d|^(?:true|false|null|")/i.test(trimmed)
          ? 'json-scalar'
          : 'plain-text'
  return {
    contentKind,
    contentBytes: new TextEncoder().encode(content).byteLength,
    jsonParseReason,
  }
}

abstract class HttpLocalLlmAdapter implements LocalLlmAdapter {
  constructor(protected readonly fetchImplementation: FetchImplementation) {}
  abstract probePath(connection: LocalConnection): string
  abstract analyzePath(connection: LocalConnection): string
  abstract requestHeaders(secret?: string): HeadersInit
  abstract analysisBody(input: LocalAnalysisRequest): Record<string, unknown>
  abstract parsePayload(response: unknown):
    | { payload: unknown }
    | {
        message: string
        responseVariant?: LocalAdapterResponseVariant
        contentKind?: LocalAdapterContentKind
        contentBytes?: number
        jsonParseReason?: LocalAdapterJsonParseReason
        finishReason?: string
      }

  async probe(connection: LocalConnection): Promise<LocalAdapterProbeResult> {
    let secret: string | undefined
    try {
      secret = resolveLocalSecret(connection.secretRef)
    } catch {
      return failure('secret', 'No se pudo resolver el secreto local.')
    }
    const result = await this.request(connection, this.probePath(connection), {
      headers: this.requestHeaders(secret),
    })
    if (!result.ok) return result
    return result.response && typeof result.response === 'object'
      ? { ok: true }
      : failure(
          'protocol',
          'El servidor local devolvió una respuesta inválida.',
        )
  }

  async analyze(
    input: LocalAnalysisRequest,
  ): Promise<LocalAdapterAnalyzeResult> {
    let secret: string | undefined
    try {
      secret = resolveLocalSecret(input.connection.secretRef)
    } catch {
      return failure('secret', 'No se pudo resolver el secreto local.')
    }
    const result = await this.request(
      input.connection,
      this.analyzePath(input.connection),
      {
        method: 'POST',
        headers: {
          ...this.requestHeaders(secret),
          'content-type': 'application/json',
        },
        body: JSON.stringify(this.analysisBody(input)),
      },
    )
    if (!result.ok) return result
    const parsed = this.parsePayload(result.response)
    return 'message' in parsed
      ? failure('protocol', parsed.message, parsed.responseVariant, parsed)
      : { ok: true, payload: parsed.payload }
  }

  private async request(
    connection: LocalConnection,
    path: string,
    init: RequestInit,
  ): Promise<
    | { ok: true; response: unknown }
    | { ok: false; message: string; cause: LocalAdapterFailureCause }
  > {
    let response: Response
    try {
      response = await this.fetchImplementation(
        endpoint(connection.baseUrl, path),
        init,
      )
    } catch (error) {
      return isAdapterFailure(error)
        ? error
        : failure('transport', 'No se pudo conectar al servidor local.')
    }
    if (!response.ok)
      return failure('http', `El servidor local respondió ${response.status}.`)
    try {
      return { ok: true, response: await response.json() }
    } catch {
      return failure(
        'protocol',
        'El servidor local devolvió una respuesta inválida.',
      )
    }
  }
}

class OpenAiLikeAdapter extends HttpLocalLlmAdapter {
  // These satisfy the shared HTTP adapter shape. OpenAI-like overrides probe
  // and analyze below; all network traffic is performed by the official SDK.
  probePath() {
    return 'models'
  }
  analyzePath() {
    return 'chat/completions'
  }
  requestHeaders() {
    return {}
  }
  analysisBody() {
    return {}
  }

  override async probe(
    connection: LocalConnection,
  ): Promise<LocalAdapterProbeResult> {
    const client = this.clientFor(connection)
    if (!client.ok) return client
    try {
      await client.value.models.list()
      return { ok: true }
    } catch (error) {
      return openAiSdkFailure(error)
    }
  }

  override async analyze(
    input: LocalAnalysisRequest,
  ): Promise<LocalAdapterAnalyzeResult> {
    const client = this.clientFor(input.connection)
    if (!client.ok) return client
    try {
      const agent = new Agent({
        name: 'Análisis tributario local',
        model: new OpenAIChatCompletionsModel(
          client.value,
          input.connection.model,
        ),
        instructions: [
          'Analiza exclusivamente el snapshot local proporcionado por el usuario.',
          'Devuelve el objeto estructurado solicitado, sin texto adicional.',
          'El propósito de la salida debe ser exactamente el propósito de la revisión de contexto.',
          'Nunca inventes ni omitas identificadores de actividades: usa solo los incluidos en el snapshot cuando el esquema los requiera.',
        ].join(' '),
        outputType: input.purpose
          ? localTaxAnalysisAgentOutputTypeForPurpose(input.purpose)
          : LocalTaxAnalysisAgentOutputType,
        modelSettings: {
          temperature: 0,
          maxTokens: LOCAL_OPENAI_MAX_TOKENS,
          // LocalAI otherwise may return the generated JSON as reasoning,
          // leaving `message.content` empty for structured-output clients.
          providerData: {
            metadata: { enable_thinking: 'false' },
          },
        },
      })
      const result = await run(agent, input.prompt, {
        maxTurns: 1,
        stream: false,
      })
      const output = result.finalOutput as { payload?: unknown } | undefined
      if (!output || !('payload' in output))
        return failure(
          'protocol',
          'La respuesta OpenAI-like no incluye contenido estructurado.',
        )
      return { ok: true, payload: output.payload }
    } catch (error) {
      return openAiAgentsFailure(error)
    }
  }

  private clientFor(
    connection: LocalConnection,
  ):
    | { ok: true; value: OpenAI }
    | { ok: false; message: string; cause: LocalAdapterFailureCause } {
    let secret: string | undefined
    try {
      secret = resolveLocalSecret(connection.secretRef)
    } catch {
      return failure('secret', 'No se pudo resolver el secreto local.')
    }
    return {
      ok: true,
      value: new OpenAI({
        baseURL: connection.baseUrl,
        // LocalAI accepts Bearer auth but an unauthenticated local host still
        // needs a non-empty SDK credential. This is never persisted or logged.
        apiKey: secret ?? 'local-dummy-key',
        fetch: this.fetchImplementation,
        maxRetries: 0,
      }),
    }
  }

  parsePayload(response: unknown):
    | { payload: unknown }
    | {
        message: string
        responseVariant?: LocalAdapterResponseVariant
        contentKind?: LocalAdapterContentKind
        contentBytes?: number
        jsonParseReason?: LocalAdapterJsonParseReason
        finishReason?: string
      } {
    const choices = (response as { choices?: unknown })?.choices
    if (!Array.isArray(choices))
      return { message: 'La respuesta OpenAI-like no incluye choices.' }
    const choice = choices[0] as
      | { message?: unknown; finish_reason?: unknown }
      | undefined
    const finishReason = safeFinishReason(choice?.finish_reason)
    const message = choice?.message
    if (!message || typeof message !== 'object')
      return {
        message: 'La respuesta OpenAI-like no incluye contenido textual.',
        responseVariant: 'openai-message-missing',
      }
    const content = (message as { content?: unknown }).content
    if (typeof content !== 'string' || content.trim().length === 0)
      return {
        message: 'La respuesta OpenAI-like no incluye contenido textual.',
        responseVariant: openAiMissingContentVariant(message),
      }
    const parsed = parseModelJson(content)
    return 'payload' in parsed
      ? parsed
      : {
          message: 'El contenido del modelo no contiene JSON válido.',
          finishReason,
          ...parsed,
        }
  }
}

function safeFinishReason(value: unknown) {
  return typeof value === 'string' && /^[a-z_]{1,40}$/i.test(value)
    ? value.toLowerCase()
    : undefined
}

function openAiSdkFailure(error: unknown): {
  ok: false
  message: string
  cause: LocalAdapterFailureCause
} {
  if (error instanceof OpenAI.APIError && typeof error.status === 'number')
    return failure('http', `El servidor local respondió ${error.status}.`)
  return failure('transport', 'No se pudo conectar al servidor local.')
}

function safeAgentsTimeoutMs(error: ModelTimeoutError) {
  try {
    const timeoutMs = error.timeoutMs
    return typeof timeoutMs === 'number' &&
      Number.isFinite(timeoutMs) &&
      Number.isInteger(timeoutMs) &&
      timeoutMs >= 1 &&
      timeoutMs <= 3_600_000
      ? timeoutMs
      : undefined
  } catch {
    return undefined
  }
}

export function openAiAgentsFailure(
  error: unknown,
): Extract<LocalAdapterAnalyzeResult, { ok: false }> {
  if (error instanceof OpenAI.APIError && typeof error.status === 'number')
    return failure('http', `El servidor local respondió ${error.status}.`)
  if (error instanceof TypeError)
    return failure('transport', 'No se pudo conectar al servidor local.')
  const agentsErrorKind: LocalAgentsErrorKind =
    error instanceof ModelBehaviorError
      ? 'model-behavior'
      : error instanceof ModelRefusalError
        ? 'model-refusal'
        : error instanceof MaxTurnsExceededError
          ? 'max-turns'
          : error instanceof ModelTimeoutError
            ? 'model-timeout'
            : error instanceof SystemError
              ? 'system'
              : 'other'
  const agentsTimeoutMs =
    error instanceof ModelTimeoutError ? safeAgentsTimeoutMs(error) : undefined
  return {
    ok: false,
    cause: 'invalid-output',
    message: 'El modelo local devolvió una salida estructurada inválida.',
    agentsErrorKind,
    ...(agentsTimeoutMs === undefined ? {} : { agentsTimeoutMs }),
  }
}

function openAiMissingContentVariant(
  message: object,
): LocalAdapterResponseVariant {
  const fields = message as {
    reasoning_content?: unknown
    reasoning?: unknown
    tool_calls?: unknown
    refusal?: unknown
  }
  if (
    typeof fields.reasoning_content === 'string' &&
    fields.reasoning_content.trim()
  )
    return 'openai-reasoning-content-only'
  if (typeof fields.reasoning === 'string' && fields.reasoning.trim())
    return 'openai-reasoning-only'
  if (Array.isArray(fields.tool_calls) && fields.tool_calls.length > 0)
    return 'openai-tool-calls-only'
  if (typeof fields.refusal === 'string' && fields.refusal.trim())
    return 'openai-refusal-only'
  return 'openai-content-missing'
}

class ClaudeLikeAdapter extends HttpLocalLlmAdapter {
  probePath(connection: LocalConnection) {
    return connection.baseUrl.replace(/\/$/, '').endsWith('/v1')
      ? 'models'
      : 'v1/models'
  }
  analyzePath(connection: LocalConnection) {
    return connection.baseUrl.replace(/\/$/, '').endsWith('/v1')
      ? 'messages'
      : 'v1/messages'
  }
  requestHeaders(secret?: string): Record<string, string> {
    return {
      'anthropic-version': '2023-06-01',
      ...(secret ? { 'x-api-key': secret } : {}),
    }
  }
  analysisBody(input: LocalAnalysisRequest) {
    return {
      model: input.connection.model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: input.prompt }],
    }
  }
  parsePayload(response: unknown): { payload: unknown } | { message: string } {
    const content = (response as { content?: unknown })?.content
    if (!Array.isArray(content))
      return { message: 'La respuesta Claude-like no incluye content.' }
    const text = (content as Array<{ type?: unknown; text?: unknown }>).find(
      (block) => block.type === 'text',
    )?.text
    if (typeof text !== 'string' || text.trim().length === 0)
      return {
        message: 'La respuesta Claude-like no incluye contenido textual.',
      }
    const parsed = parseModelJson(text)
    return 'payload' in parsed
      ? parsed
      : {
          message: 'El contenido del modelo no contiene JSON válido.',
          ...parsed,
        }
  }
}

export function createLocalLlmAdapter(
  connection: LocalConnection,
  fetchImplementation: FetchImplementation = fetch,
): LocalLlmAdapter {
  return connection.apiFlavor === 'openai-like'
    ? new OpenAiLikeAdapter(fetchImplementation)
    : new ClaudeLikeAdapter(fetchImplementation)
}

export async function probeLocalConnection(connection: LocalConnection) {
  return createLocalLlmAdapter(connection).probe(connection)
}
