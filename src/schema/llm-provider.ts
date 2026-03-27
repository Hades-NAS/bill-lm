import { z } from 'zod'

export const LLMProviderEnum = z.enum(['lm-studio', 'openai', 'claude'])
export type LLMProviderType = z.infer<typeof LLMProviderEnum>

export const LLMProviderConfigSchema = z.object({
  provider: LLMProviderEnum,
  modelId: z.string(),
  maxTokens: z.number(),
  timeout: z.number(),
  agentInstructions: z.string(),
  apiKey: z.string().optional(), // For OpenAI, Claude
  projectId: z.string().optional(),
  organization: z.string().optional(),
  baseUrl: z.string().optional(), // For LMStudio
})

export type LLMProviderConfig = z.infer<typeof LLMProviderConfigSchema>
