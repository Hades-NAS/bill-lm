import { z } from 'zod'

const normalizeToArray = <T>(value: T | Array<T>): Array<T> => {
  if (Array.isArray(value)) return value
  return [value]
}

// Impuesto individual (puede haber 1 o muchos por concepto)
const impuestoSchema = z
  .object({
    codigo: z.string(),
    codigoPorcentaje: z.string(),
    tarifa: z.string(),
    baseImponible: z.string(),
    valor: z.string(),
  })
  .partial()

export type Impuesto = z.infer<typeof impuestoSchema>

// Impuesto singular o array, normalizado a array
const impuestosContainerSchema = z
  .object({
    impuesto: impuestoSchema.or(z.array(impuestoSchema)),
  })
  .transform((data) => ({
    impuesto: normalizeToArray(data.impuesto),
  }))

export type ImpuestosContainer = z.infer<typeof impuestosContainerSchema>

// ==================== DETALLE SCHEMA ====================
const detalleSchema = z.object({
  codigoPrincipal: z.string(),
  descripcion: z.string(),
  cantidad: z.string(),
  precioUnitario: z.string(),
  descuento: z.string(),
  precioTotalSinImpuesto: z.string(),
  impuestos: impuestosContainerSchema,
})

export type Detalle = z.infer<typeof detalleSchema>

// ==================== TOTAL IMPUESTO ====================
const totalImpuestoSchema = z
  .object({
    codigo: z.string(),
    codigoPorcentaje: z.string(),
    baseImponible: z.string(),
    tarifa: z.string(),
    valor: z.string(),
  })
  .partial()

export type TotalImpuesto = z.infer<typeof totalImpuestoSchema>

// TotalConImpuestos contiene totalImpuesto (objeto o array)
const totalConImpuestosSchema = z
  .object({
    totalImpuesto: totalImpuestoSchema.or(z.array(totalImpuestoSchema)),
  })
  .transform((data) => ({
    totalImpuesto: normalizeToArray(data.totalImpuesto),
  }))

export type TotalConImpuestos = z.infer<typeof totalConImpuestosSchema>

// ==================== PAGO ====================
const pagoSchema = z.object({
  formaPago: z.string(),
  total: z.string(),
  plazo: z.string().optional(),
  unidadTiempo: z.string().optional(),
})

export type Pago = z.infer<typeof pagoSchema>

// Pagos contiene pago (objeto o array)
const pagosSchema = z
  .object({
    pago: pagoSchema.or(z.array(pagoSchema)),
  })
  .transform((data) => ({
    pago: normalizeToArray(data.pago),
  }))

export type Pagos = z.infer<typeof pagosSchema>

// ==================== INFO TRIBUTARIA ====================
const infoTributariaSchema = z.object({
  ambiente: z.string(),
  tipoEmision: z.string(),
  razonSocial: z.string(),
  nombreComercial: z.string(),
  ruc: z.string(),
  claveAcceso: z.string(),
  codDoc: z.string(),
  estab: z.string(),
  ptoEmi: z.string(),
  secuencial: z.string(),
  dirMatriz: z.string(),
})

export type InfoTributaria = z.infer<typeof infoTributariaSchema>

// ==================== INFO FACTURA ====================
const infoFacturaSchema = z.object({
  fechaEmision: z.string(),
  dirEstablecimiento: z.string().optional(),
  contribuyenteEspecial: z.string().optional(),
  obligadoContabilidad: z.string(),
  tipoIdentificacionComprador: z.string(),
  razonSocialComprador: z.string(),
  identificacionComprador: z.string(),
  totalSinImpuestos: z.string(),
  totalDescuento: z.string(),
  totalConImpuestos: totalConImpuestosSchema,
  propina: z.string().optional(),
  importeTotal: z.string(),
  moneda: z.string(),
  pagos: pagosSchema.optional(),
})

export type InfoFactura = z.infer<typeof infoFacturaSchema>

// ==================== DETALLES ====================
const detallesSchema = z
  .object({
    detalle: detalleSchema.or(z.array(detalleSchema)),
  })
  .transform((data) => ({
    detalle: normalizeToArray(data.detalle),
  }))

export type Detalles = z.infer<typeof detallesSchema>

// ==================== INFO ADICIONAL ====================
const campoAdicionalSchema = z.object({
  '#text': z.string(),
  '@_nombre': z.string(),
})

export type CampoAdicional = z.infer<typeof campoAdicionalSchema>

const infoAdicionalSchema = z
  .object({
    campoAdicional: campoAdicionalSchema.or(z.array(campoAdicionalSchema)),
  })
  .transform((data) => ({
    campoAdicional: normalizeToArray(data.campoAdicional),
  }))

export type InfoAdicional = z.infer<typeof infoAdicionalSchema>

// ==================== BILL CONTENT SCHEMA (FACTURA) ====================
export const xmlBillContentSchema = z.object({
  factura: z.object({
    infoTributaria: infoTributariaSchema,
    infoFactura: infoFacturaSchema,
    detalles: detallesSchema,
    infoAdicional: infoAdicionalSchema.optional(),
  }),
})

export type XmlBillContent = z.infer<typeof xmlBillContentSchema>
export type Factura = z.infer<typeof xmlBillContentSchema>['factura']

// ==================== AUTHORIZATION SCHEMA ====================
export const xmlBillSchema = z.object({
  autorizacion: z.object({
    estado: z.string(),
    numeroAutorizacion: z.string(),
    fechaAutorizacion: z.string(),
    ambiente: z.string(),
    comprobante: z.string(),
  }),
})

export type XmlBill = z.infer<typeof xmlBillSchema>
