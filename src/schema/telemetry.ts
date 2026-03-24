import { z } from "zod"

// src/schema/telemetry.ts
export const AgentTelemetrySchema = z.object({
  jobId: z.string(),
  billId: z.string(),

  // Tokens
  tokensInput: z.number(),
  tokensOutput: z.number(),
  tokensTotal: z.number(),

  // LLM Config
  model: z.string(),
  preset: z.enum(['strict', 'balanced', 'creative']),
  temperature: z.number(),

  // Ejecución
  duration: z.number(),  // ms
  attempts: z.number(),  // intentos antes de éxito
  status: z.enum(['success', 'error', 'timeout', 'circuit_open']),
  error: z.string().optional(),

  // Metadata
  promptVersion: z.string(),
  timestamp: z.date(),
})

export type AgentTelemetry = z.infer<typeof AgentTelemetrySchema>
