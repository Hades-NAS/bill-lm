type BuyerProfileIdentity = {
  personalIdNumber: string | null
  professionalIdNumber: string | null
}

export function getBuyerProfileMismatchMessage(
  buyerIdentifier: string,
  profile: BuyerProfileIdentity,
): string | null {
  const buyerId = buyerIdentifier.trim()

  if (buyerId.length === 10) {
    if (!profile.personalIdNumber)
      return 'Agrega una cédula de 10 dígitos al perfil tributario del contexto antes de subir esta factura.'
    if (buyerId !== profile.personalIdNumber)
      return 'La cédula del comprador de esta factura no coincide con la cédula del perfil tributario del contexto.'
    return null
  }

  if (buyerId.length === 13) {
    if (!profile.professionalIdNumber)
      return 'Agrega un RUC de 13 dígitos al perfil tributario del contexto antes de subir esta factura.'
    if (buyerId !== profile.professionalIdNumber)
      return 'El RUC del comprador de esta factura no coincide con el RUC del perfil tributario del contexto.'
    return null
  }

  return 'La factura debe identificar al comprador con una cédula de 10 dígitos o un RUC de 13 dígitos.'
}
