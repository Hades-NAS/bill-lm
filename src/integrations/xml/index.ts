import { XMLParser } from 'fast-xml-parser'

import { xmlBillContentSchema, xmlBillSchema } from '#/schema/bill'

import { getServiceLogger } from '../logger.server'

const logger = getServiceLogger('XmlIntegration')

export function parseAndValidateInvoiceXML(xmlBuffer: Buffer) {
  const xmlString = xmlBuffer.toString('utf-8')

  const xmlParser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
  })

  // Parse the full XML
  const rawData = xmlParser.parse(xmlString)

  // Validate wrapper structure
  const resultXML = xmlBillSchema.safeParse(rawData)

  if (!resultXML.success) {
    logger.error('Failed to validate authorization wrapper', {
      error: resultXML.error,
      rawData,
    })
    return resultXML
  }

  const { comprobante } = resultXML.data.autorizacion

  // Parse the factura XML content
  const comprobanteParsed = xmlParser.parse(comprobante)

  // Validate and normalize factura content
  const contentResult = xmlBillContentSchema.safeParse(comprobanteParsed)

  return contentResult
}
