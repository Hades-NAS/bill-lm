import { ZodError } from 'zod'

const fieldLabels: Record<string, string> = {
  activityRevisionIds: 'las actividades económicas',
  additionalFacts: 'los datos adicionales',
  apiKey: 'la API key',
  base64: 'el contenido del archivo',
  displayName: 'el nombre',
  email: 'el correo electrónico',
  file: 'el archivo',
  instructions: 'las instrucciones',
  label: 'el nombre',
  mimeType: 'el tipo de archivo',
  modelId: 'el modelo',
  name: 'el nombre',
  password: 'la contraseña',
  passwordConfirmation: 'la confirmación de contraseña',
  personalIdNumber: 'la cédula',
  professionalIdNumber: 'el RUC',
  profileRevisionId: 'el perfil tributario',
  purpose: 'el propósito del análisis',
  registeredActivityName: 'el nombre de la actividad',
  revenueVatTreatment: 'el tratamiento de IVA',
  vatFilingFrequency: 'la periodicidad de IVA',
  year: 'el año',
}

function fieldLabel(path: PropertyKey[]) {
  const key = [...path].reverse().find((item) => typeof item === 'string')
  return typeof key === 'string' ? fieldLabels[key] : undefined
}

export function userFacingZodError(error: unknown): string | null {
  if (!(error instanceof ZodError)) return null

  const issue = error.issues[0]
  if (!issue) return 'Revisa los datos ingresados e inténtalo de nuevo.'

  const label = fieldLabel(issue.path)
  if (issue.code === 'invalid_format') {
    if (issue.path.includes('personalIdNumber'))
      return 'Ingresa los 10 dígitos de la cédula.'
    if (issue.path.includes('professionalIdNumber'))
      return 'Ingresa los 13 dígitos del RUC.'
    if (issue.path.includes('email')) return 'Ingresa un correo electrónico válido.'
    return label
      ? `Revisa el formato de ${label}.`
      : 'Revisa el formato de los datos ingresados.'
  }

  if (issue.code === 'too_small' || issue.code === 'invalid_type')
    return label ? `Completa ${label}.` : 'Completa los datos requeridos.'

  if (issue.code === 'too_big')
    return label
      ? `${label[0]?.toUpperCase()}${label.slice(1)} es demasiado largo.`
      : 'Uno de los datos es demasiado largo.'

  if (issue.code === 'invalid_value')
    return label
      ? `Selecciona un valor válido para ${label}.`
      : 'Selecciona un valor válido.'

  return 'Revisa los datos ingresados e inténtalo de nuevo.'
}
