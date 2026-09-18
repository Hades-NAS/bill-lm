import { XMLParser } from 'fast-xml-parser'
import { z } from 'zod'

const asArray = <Value>(value: Value | Value[]): Value[] => Array.isArray(value) ? value : [value]
const impuesto = z.object({ codigo: z.string(), codigoPorcentaje: z.string(), tarifa: z.string(), baseImponible: z.string(), valor: z.string() }).partial()
const impuestos = z.object({ impuesto: impuesto.or(z.array(impuesto)) }).transform((value) => ({ impuesto: asArray(value.impuesto) }))
const detalle = z.object({ codigoPrincipal: z.string(), descripcion: z.string(), cantidad: z.string(), precioUnitario: z.string(), descuento: z.string(), precioTotalSinImpuesto: z.string(), impuestos })
const totalImpuesto = z.object({ codigo: z.string(), codigoPorcentaje: z.string(), baseImponible: z.string(), tarifa: z.string(), valor: z.string() }).partial()
const totalConImpuestos = z.object({ totalImpuesto: totalImpuesto.or(z.array(totalImpuesto)) }).transform((value) => ({ totalImpuesto: asArray(value.totalImpuesto) }))
const pago = z.object({ formaPago: z.string(), total: z.string(), plazo: z.string().optional(), unidadTiempo: z.string().optional() })
const pagos = z.object({ pago: pago.or(z.array(pago)) }).transform((value) => ({ pago: asArray(value.pago) }))
const infoTributaria = z.object({ ambiente: z.string(), tipoEmision: z.string(), razonSocial: z.string(), nombreComercial: z.string(), ruc: z.string(), claveAcceso: z.string(), codDoc: z.string(), estab: z.string(), ptoEmi: z.string(), secuencial: z.string(), dirMatriz: z.string() })
const infoFactura = z.object({ fechaEmision: z.string(), dirEstablecimiento: z.string().optional(), contribuyenteEspecial: z.string().optional(), obligadoContabilidad: z.string(), tipoIdentificacionComprador: z.string(), razonSocialComprador: z.string(), identificacionComprador: z.string(), totalSinImpuestos: z.string(), totalDescuento: z.string(), totalConImpuestos, propina: z.string().optional(), importeTotal: z.string(), moneda: z.string(), pagos: pagos.optional() })
const detalles = z.object({ detalle: detalle.or(z.array(detalle)) }).transform((value) => ({ detalle: asArray(value.detalle) }))
const campoAdicional = z.object({ '#text': z.string(), '@_nombre': z.string() })
const infoAdicional = z.object({ campoAdicional: campoAdicional.or(z.array(campoAdicional)) }).transform((value) => ({ campoAdicional: asArray(value.campoAdicional) }))

export const XmlInvoiceContentSchema = z.object({ factura: z.object({ infoTributaria, infoFactura, detalles, infoAdicional: infoAdicional.optional() }) })
export type XmlInvoiceContent = z.infer<typeof XmlInvoiceContentSchema>
export const XmlInvoiceAuthorizationSchema = z.object({ autorizacion: z.object({ estado: z.string(), numeroAutorizacion: z.string(), fechaAutorizacion: z.string(), ambiente: z.string(), comprobante: z.string() }) })

/** Parses the two-layer SRI authorization XML without filesystem or cloud access. */
export function parseAndValidateInvoiceXML(xmlInput: Uint8Array | string) {
  const xmlString = typeof xmlInput === 'string' ? xmlInput : new TextDecoder().decode(xmlInput)
  const parser = new XMLParser({ ignoreAttributes: false, parseAttributeValue: false, parseTagValue: false, trimValues: true })
  const authorization = XmlInvoiceAuthorizationSchema.safeParse(parser.parse(xmlString))
  if (!authorization.success) return authorization
  return XmlInvoiceContentSchema.safeParse(parser.parse(authorization.data.autorizacion.comprobante))
}
