import { describe, expect, it } from 'vitest'

import { getBuyerProfileMismatchMessage } from '#/utils/bill-buyer-profile'

const profile = {
  personalIdNumber: '1314708916',
  professionalIdNumber: '1314708916001',
}

describe('getBuyerProfileMismatchMessage', () => {
  it('accepts buyer identifiers that match the context profile', () => {
    expect(getBuyerProfileMismatchMessage('1314708916', profile)).toBeNull()
    expect(getBuyerProfileMismatchMessage('1314708916001', profile)).toBeNull()
  })

  it('explains a mismatch without disclosing either identifier', () => {
    expect(getBuyerProfileMismatchMessage('0102030405', profile)).toBe(
      'La cédula del comprador de esta factura no coincide con la cédula del perfil tributario del contexto.',
    )
  })

  it('asks for the missing identifier in the profile', () => {
    expect(
      getBuyerProfileMismatchMessage('1314708916001', {
        personalIdNumber: '1314708916',
        professionalIdNumber: null,
      }),
    ).toBe(
      'Agrega un RUC de 13 dígitos al perfil tributario del contexto antes de subir esta factura.',
    )
  })
})
