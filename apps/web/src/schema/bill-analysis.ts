import z from 'zod'

import type { BillTargetType } from '#/generated/prisma/enums'

/**
 * Bill Analysis Schema Definitions
 *
 * This file defines the schema transformations for bill analysis:
 * Raw XML → Parsed Bill → Analyzed Bill
 *
 * Each stage builds on the previous, ensuring type safety throughout the pipeline.
 */

// ============================================================================
// STAGE 1: Raw XML (as parsed from XML file)
// ============================================================================

export const RawBillXMLSchema = z.object({
  factura: z.object({
    infoTributaria: z.object({
      secuencial: z.string(),
      nombreComercial: z.string().optional(),
      razonSocial: z.string(),
      ruc: z.string(),
      dirMatriz: z.string().optional(),
    }),
    infoFactura: z.object({
      identificacionComprador: z.string(),
      razonSocialComprador: z.string().optional(),
      totalSinImpuestos: z.string(),
      importeTotal: z.string(),
      totalConImpuestos: z.object({
        totalImpuesto: z.array(
          z.object({
            codigo: z.string().optional(),
            porcentaje: z.string().optional(),
            valor: z.string().optional(),
          }),
        ),
      }),
      propina: z.string().optional(),
    }),
    detalles: z.object({
      detalle: z.array(
        z.object({
          descripcion: z.string(),
          cantidad: z.string(),
          precioUnitario: z.string(),
          descuento: z.string().optional(),
        }),
      ),
    }),
  }),
})

export type RawBillXML = z.infer<typeof RawBillXMLSchema>

// ============================================================================
// STAGE 2: Parsed Bill (structured for analysis)
// ============================================================================

export const ParsedBillSchema = z.object({
  vendorName: z.string().describe('Seller/vendor name from infoTributaria'),
  buyerIdentifier: z
    .string()
    .describe('Buyer ID: 10 digits (PERSONAL) or 13 digits (PROFESSIONAL)'),
  buyerName: z.string().optional(),
  details: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        discount: z.number().optional(),
      }),
    )
    .describe('Line items from invoice'),
  totals: z
    .object({
      amount: z.number().describe('Total amount with taxes'),
      net: z.number().describe('Total without taxes'),
      taxes: z.number().describe('Total tax amount'),
      tip: z.number().optional(),
    })
    .describe('Financial totals'),
  billType: z
    .enum(['PERSONAL', 'PROFESSIONAL', 'OTHER'])
    .describe('Determined by buyerIdentifier length'),
})

export type ParsedBill = z.infer<typeof ParsedBillSchema>

/**
 * Transform raw XML to parsed bill
 * Extracts and structures data for AI analysis
 */
export function transformRawToParsed(raw: RawBillXML): ParsedBill {
  const { factura } = raw
  const { infoTributaria, infoFactura, detalles } = factura

  // Determine bill type from buyer identifier length
  const billType: BillTargetType = determineBillType(
    infoFactura.identificacionComprador,
  )

  // Parse totals
  const net = parseFloat(infoFactura.totalSinImpuestos)
  const taxes = infoFactura.totalConImpuestos.totalImpuesto.reduce(
    (acc, tax) => acc + parseFloat(tax.valor || '0'),
    0,
  )
  const amount = parseFloat(infoFactura.importeTotal)
  const tip = infoFactura.propina ? parseFloat(infoFactura.propina) : 0

  // Parse line items
  const details = detalles.detalle.map((item) => ({
    description: item.descripcion,
    quantity: parseFloat(item.cantidad),
    unitPrice: parseFloat(item.precioUnitario),
    discount: item.descuento ? parseFloat(item.descuento) : undefined,
  }))

  return {
    vendorName: infoTributaria.razonSocial,
    buyerIdentifier: infoFactura.identificacionComprador,
    buyerName: infoFactura.razonSocialComprador,
    details,
    totals: {
      amount,
      net,
      taxes,
      tip: tip || undefined,
    },
    billType,
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Determine bill type from buyer identifier
 * - 10 digits: PERSONAL
 * - 13 digits: PROFESSIONAL
 * - Otherwise: OTHER
 */
export function determineBillType(identifier: string): BillTargetType {
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
