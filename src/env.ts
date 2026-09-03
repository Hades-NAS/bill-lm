import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const LLMProviderEnum = z.enum(['lm-studio', 'openai', 'claude'])
export type LLMProvider = z.infer<typeof LLMProviderEnum>

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development').optional(),

    DATABASE_URL: z.string().min(1),
    GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1),

    MINIO_ENDPOINT: z.string().min(1),
    MINIO_ACCESS_KEY: z.string().min(1),
    MINIO_SECRET_KEY: z.string().min(1),
    MINIO_BUCKET_NAME: z.string().min(1),

    ANALYZE_QUEUE_NAME: z.string().min(1),
    REDIS_HOST: z.string().min(1),
    REDIS_PORT: z.string().min(1).optional(),

    FAKE_ANALYZE: z.string().optional(),

    // LLM Provider selection
    LLM_PROVIDER: LLMProviderEnum.default('lm-studio'),

    // LM Studio (when LLM_PROVIDER=lm-studio)
    LLM_BASE_URL: z.string().optional(),
    MODEL_KEY: z.string().optional(),

    // OpenAI (when LLM_PROVIDER=openai)
    OPENAI_MODEL_ID: z.string().optional(),
    OPENAI_PROJECT_ID: z.string().optional(),
    OPENAI_ORGANIZATION: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),

    // Claude (when LLM_PROVIDER=claude)
    CLAUDE_MODEL_ID: z.string().optional(),
    CLAUDE_API_KEY: z.string().optional(),

    // Shared LLM settings
    LLM_MAX_TOKENS: z.string().optional(),
    LLM_TIMEOUT_MS: z.string().optional(),
  },

  /**
   * The prefix that client-side variables must have. This is enforced both at
   * a type-level and at runtime.
   */
  clientPrefix: 'VITE_',

  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),
    VITE_FIREBASE_API_KEY: z.string().min(1),
    VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
    VITE_FIREBASE_PROJECT_ID: z.string().min(1),
    VITE_FIREBASE_STORAGE_BUCKET: z.string().min(1),
    VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
    VITE_FIREBASE_APP_ID: z.string().min(1),
  },

  /**
   * What object holds the environment variables at runtime. This is usually
   * `process.env` or `import.meta.env`.
   */
  runtimeEnv: {
    // Server vars
    DATABASE_URL: process.env.DATABASE_URL,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
    MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY,
    MINIO_BUCKET_NAME: process.env.MINIO_BUCKET_NAME,
    ANALYZE_QUEUE_NAME: process.env.ANALYZE_QUEUE_NAME,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    FAKE_ANALYZE: process.env.FAKE_ANALYZE,

    // LLM Provider
    LLM_PROVIDER: process.env.LLM_PROVIDER,

    // LM Studio
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    MODEL_KEY: process.env.MODEL_KEY,

    // OpenAI
    OPENAI_MODEL_ID: process.env.OPENAI_MODEL_ID,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,

    // Claude
    CLAUDE_MODEL_ID: process.env.CLAUDE_MODEL_ID,
    CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,

    // Shared LLM
    LLM_TEMPERATURE: process.env.LLM_TEMPERATURE,
    LLM_MAX_TOKENS: process.env.LLM_MAX_TOKENS,
    LLM_TIMEOUT_MS: process.env.LLM_TIMEOUT_MS,

    // Client vars
    VITE_APP_TITLE: import.meta.env.VITE_APP_TITLE || process.env.VITE_APP_TITLE,
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env
      .VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
  },

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,
})
