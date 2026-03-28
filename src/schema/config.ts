import { z } from 'zod'

export const WhitelistConfigSchema = z.object({
  enabled: z.boolean().default(false),
  allowedEmails: z.array(z.email()).default([]),
  allowedUserIds: z.array(z.string()).default([]),
})

export type WhitelistConfig = z.infer<typeof WhitelistConfigSchema>