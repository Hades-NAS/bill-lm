import { roundToDecimals } from './math'

import type { BillFileType, BillTargetType } from '#/generated/prisma/enums'
import type { InfoFactura } from '#/schema/bill'

export const getColorBillFileType = (type: BillFileType) => {
  if (type === 'PDF') {
    return 'red'
  } else if (type === 'XML') {
    return 'yellow'
  } else if (type === 'TEXT') {
    return 'blue'
  } else {
    return 'cyan'
  }
}

export const getColorBillTargetType = (type: BillTargetType) => {
  if (type === 'PERSONAL') {
    return 'green'
  } else if (type === 'PROFESSIONAL') {
    return 'blue'
  } else {
    return 'gray'
  }
}

export const getColorPercentage = (percentage: number | null) => {
  if (percentage === null) {
    return 'gray'
  } else if (percentage < 50) {
    return 'red'
  } else if (percentage < 100) {
    return 'yellow'
  } else {
    return 'green'
  }
}

export const getBillType = (
  identifier: InfoFactura['identificacionComprador'],
): BillTargetType => {
  const regexPersonal = /^\d{10}$/
  const regexProfessional = /^\d{13}$/

  if (regexPersonal.test(identifier)) {
    return 'PERSONAL'
  }
  if (regexProfessional.test(identifier)) {
    return 'PROFESSIONAL'
  }
  return 'OTHER'
}

export const getBillAmounts = (data: InfoFactura) => {
  const tip = roundToDecimals(data.propina ? parseFloat(data.propina) : 0)
  const totalAmount = roundToDecimals(data.importeTotal)
  const totalWithoutTaxes = roundToDecimals(
    parseFloat(data.totalSinImpuestos) + tip,
  )
  const taxes = roundToDecimals(
    data.totalConImpuestos.totalImpuesto.reduce(
      (acc, tax) => acc + parseFloat(tax.valor || '0'),
      0,
    ),
  )

  return {
    totalWithoutTaxes,
    taxes,
    totalAmount,
  }
}
