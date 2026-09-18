import { z } from 'zod'

// Environment values arrive as strings. Deliberately do not coerce arbitrary
// values here: a typo must fail closed instead of accidentally spending tokens.
export const LLMSmokeTestEnvSchema = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true')
