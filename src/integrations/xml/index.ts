import { XMLParser } from 'fast-xml-parser'

import { xmlBillContentSchema, xmlBillSchema } from '#/schema/bill'


export function parseAndValidateInvoiceXML(xmlInput: Buffer | string) {
  const xmlString = typeof xmlInput === 'string' ? xmlInput : xmlInput.toString('utf-8')

  const xmlParser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
  })

  const rawData = xmlParser.parse(xmlString)

  const resultXML = xmlBillSchema.safeParse(rawData)

  if (!resultXML.success) {
    return resultXML
  }

  const { comprobante } = resultXML.data.autorizacion

  const comprobanteParsed = xmlParser.parse(comprobante)

  const contentResult = xmlBillContentSchema.safeParse(comprobanteParsed)

  return contentResult
}
