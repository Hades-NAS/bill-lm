import { BillPromptTemplate } from "#/constants/bill-prompt";

import { roundToDecimals } from "./math";

import type { BillFileType, BillTargetType } from "#/generated/prisma/enums";
import type { InfoFactura, XmlBillContent } from "#/schema/bill";
import type { AnalyzeJobData } from "#/schema/collections";

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

export const getBillType = (identifier: InfoFactura['identificacionComprador']): BillTargetType => {
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
  const totalWithoutTaxes = roundToDecimals(parseFloat(data.totalSinImpuestos) + tip)
  const taxes = roundToDecimals(data.totalConImpuestos.totalImpuesto.reduce((acc, tax) => acc + parseFloat(tax.valor || "0"), 0))

  return {
    totalWithoutTaxes,
    taxes,
    totalAmount,
  }
}

export const buildUserPrompt = (jobData: AnalyzeJobData, billTargetType: BillTargetType, xmlContent: XmlBillContent): string => {
  const { instructions } = jobData.data

  const detailsData = xmlContent.factura.detalles.detalle.map(({ descripcion }) => descripcion)

  const billDataForPrompt = {
    sellerName: xmlContent.factura.infoTributaria.razonSocial,
    detalles: detailsData,
  }

  let finalInstructions = 'Se debe analizar esta factura basándose en los campos disponibles de la factura, las NORMATIVAS VIGENTES del SRI para este tipo de facturas'

  if (billTargetType === 'PROFESSIONAL' && instructions && instructions.trim() !== '') {
    finalInstructions += '\nAdicionalmente a las condiciones generales, se deben considerar las siguientes instrucciones específicas para facturas de tipo PROFESSIONAL:\n' + instructions + '\nEstas instrucciones específicas son una extensión de las condiciones generales, pero no deben cumplirse ambas, ya que una factura puede ser un consumo personal (NORMATIVAS VIGENTES del SRI) o un gasto profesional (instrucciones específicas), y con que cumpla una de las dos condiciones, la factura ya sería deducible.'
  }

  return BillPromptTemplate.replace("{{BILL_DATA}}", JSON.stringify(billDataForPrompt)).replace("{{INSTRUCTIONS}}", finalInstructions)
}
