import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { userFacingZodError } from '../user-facing-validation'

describe('userFacingZodError', () => {
  it('replaces technical identifier patterns with clear guidance', () => {
    const result = z
      .object({ professionalIdNumber: z.string().regex(/^\d{13}$/) })
      .safeParse({ professionalIdNumber: '131470891600' })

    expect(result.success).toBe(false)
    if (!result.success)
      expect(userFacingZodError(result.error)).toBe(
        'Ingresa los 13 dígitos del RUC.',
      )
  })

  it('does not expose Zod fallback messages for unknown fields', () => {
    const result = z.object({ opaque: z.string().min(1) }).safeParse({
      opaque: '',
    })

    expect(result.success).toBe(false)
    if (!result.success)
      expect(userFacingZodError(result.error)).toBe(
        'Completa los datos requeridos.',
      )
  })
})
