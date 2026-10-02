import z from 'zod'
import { LocalAnalysisRunStatusSchema } from './local-analysis'

export * from './local-analysis'
export * from './local-execution'
export * from './local-invoice-xml'

const IdSchema = z.string().uuid()
const IsoDateTimeSchema = z.string().datetime()
export const LocalCollectionInvoiceInputSchema = z.object({
  invoiceId: IdSchema,
})
export type LocalCollectionInvoiceInput = z.infer<
  typeof LocalCollectionInvoiceInputSchema
>

export const LocalCollectionAnalysisInputSchema = z.object({
  invoiceId: IdSchema,
  /** Analyses are always owned by a local collection and an explicit GPU host. */
  collectionId: IdSchema,
  connectionId: IdSchema,
})
export type LocalCollectionAnalysisInput = z.infer<
  typeof LocalCollectionAnalysisInputSchema
>

export const LocalCollectionInvoiceSchema = z.object({
  id: IdSchema,
  fileName: z.string().min(1),
  createdAt: IsoDateTimeSchema,
})
export type LocalCollectionInvoice = z.infer<
  typeof LocalCollectionInvoiceSchema
>

export const LocalCollectionInvoiceMembershipSchema = z.object({
  kind: z.enum(['attached', 'already-attached', 'detached']),
})
export type LocalCollectionInvoiceMembership = z.infer<
  typeof LocalCollectionInvoiceMembershipSchema
>
const CivilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha civil YYYY-MM-DD')
const OptionalTextSchema = z
  .string()
  .trim()
  .max(4_000, 'El texto no puede superar los 4.000 caracteres.')
  .optional()
const OptionalPersonalIdNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$/, 'Ingresa los 10 dígitos de la cédula.')
  .or(z.literal(''))
  .optional()
const OptionalProfessionalIdNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{13}$/, 'Ingresa los 13 dígitos del RUC.')
  .or(z.literal(''))
  .optional()

export const TaxPurposeSchema = z.enum([
  'vat_credit',
  'business_income_tax',
  'personal_expenses',
])
export type TaxPurpose = z.infer<typeof TaxPurposeSchema>

export const RevenueVatTreatmentSchema = z.enum([
  'taxed_nonzero',
  'zero_with_credit',
  'zero_without_credit',
  'mixed',
  'export',
  'unknown',
  'other',
])
export type RevenueVatTreatment = z.infer<typeof RevenueVatTreatmentSchema>

export const TaxRegimeSchema = z.enum([
  'general',
  'rimpe_entrepreneur',
  'rimpe_popular_business',
  'unknown',
])
export type TaxRegime = z.infer<typeof TaxRegimeSchema>

export const VatFilingFrequencySchema = z.enum([
  'none',
  'monthly',
  'semiannual',
  'unknown',
])
export type VatFilingFrequency = z.infer<typeof VatFilingFrequencySchema>

export const EconomicActivityRevisionInputSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Ingresa un nombre para la actividad.')
      .max(
        120,
        'El nombre de la actividad no puede superar los 120 caracteres.',
      ),
    registeredActivityCode: z
      .string()
      .trim()
      .max(100, 'El código de actividad no puede superar los 100 caracteres.')
      .optional(),
    registeredActivityName: z
      .string()
      .trim()
      .min(1, 'Ingresa el nombre registrado de la actividad.')
      .max(500, 'El nombre registrado no puede superar los 500 caracteres.'),
    activityDescription: z
      .string()
      .trim()
      .min(1, 'Describe en qué consiste la actividad.')
      .max(4_000, 'La descripción no puede superar los 4.000 caracteres.'),
    necessaryPurchases: OptionalTextSchema,
    revenueVatTreatment: RevenueVatTreatmentSchema,
    revenueVatTreatmentOther: OptionalTextSchema,
    mixedUseDescription: OptionalTextSchema,
    additionalFacts: OptionalTextSchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.revenueVatTreatment === 'other' &&
      !value.revenueVatTreatmentOther
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['revenueVatTreatmentOther'],
        message: 'Describe el tratamiento de IVA cuando seleccionas “otro”.',
      })
    }
  })
export type EconomicActivityRevisionInput = z.infer<
  typeof EconomicActivityRevisionInputSchema
>

export const EconomicActivityRevisionSchema =
  EconomicActivityRevisionInputSchema.extend({
    id: IdSchema,
    activityId: IdSchema,
    revision: z.number().int().positive(),
    createdAt: z.date(),
  })
export type EconomicActivityRevision = z.infer<
  typeof EconomicActivityRevisionSchema
>

export const TaxpayerProfileRevisionDataSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Ingresa un nombre para el perfil.')
      .max(120, 'El nombre del perfil no puede superar los 120 caracteres.'),
    personalIdNumber: OptionalPersonalIdNumberSchema,
    professionalIdNumber: OptionalProfessionalIdNumberSchema,
    hasEmploymentIncome: z.boolean(),
    hasRuc: z.boolean(),
    taxRegime: TaxRegimeSchema,
    vatFilingFrequency: VatFilingFrequencySchema,
    additionalFacts: OptionalTextSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.hasRuc && value.vatFilingFrequency !== 'none')
      ctx.addIssue({
        code: 'custom',
        path: ['vatFilingFrequency'],
        message:
          'Un perfil sin RUC debe indicar que no tiene obligación de IVA.',
      })
  })

export const TaxpayerProfileRevisionInputSchema =
  TaxpayerProfileRevisionDataSchema.extend({
    activityRevisionIds: z.array(IdSchema).max(20),
  }).superRefine((value, ctx) => {
    if (!value.hasRuc && value.activityRevisionIds.length > 0)
      ctx.addIssue({
        code: 'custom',
        path: ['activityRevisionIds'],
        message: 'Un perfil sin RUC no puede incluir actividades económicas.',
      })
  })
export type TaxpayerProfileRevisionInput = z.infer<
  typeof TaxpayerProfileRevisionInputSchema
>

export const TaxpayerProfileRevisionSchema =
  TaxpayerProfileRevisionInputSchema.extend({
    id: IdSchema,
    taxpayerProfileId: IdSchema,
    revision: z.number().int().positive(),
    createdAt: z.date(),
  })
export type TaxpayerProfileRevision = z.infer<
  typeof TaxpayerProfileRevisionSchema
>

export const TaxPeriodSchema = z
  .object({
    startDate: CivilDateSchema,
    endDate: CivilDateSchema,
  })
  .refine((period) => period.startDate <= period.endDate, {
    path: ['endDate'],
    message: 'La fecha final debe ser igual o posterior a la fecha inicial.',
  })
export type TaxPeriod = z.infer<typeof TaxPeriodSchema>

export const CollectionContextRevisionInputSchema = z.object({
  purpose: TaxPurposeSchema,
  period: TaxPeriodSchema,
  taxpayerProfileRevisionId: IdSchema,
  activityRevisionIds: z
    .array(IdSchema)
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'No repitas actividades económicas en el contexto.',
    }),
  notes: OptionalTextSchema,
})
export type CollectionContextRevisionInput = z.infer<
  typeof CollectionContextRevisionInputSchema
>

export const CollectionContextRevisionSchema =
  CollectionContextRevisionInputSchema.extend({
    id: IdSchema,
    collectionId: IdSchema,
    revision: z.number().int().positive(),
    createdAt: z.date(),
  })
export type CollectionContextRevision = z.infer<
  typeof CollectionContextRevisionSchema
>

const LocalCollectionContextResponseSchema = z.object({
  id: IdSchema,
  latestRevision: CollectionContextRevisionInputSchema.extend({
    id: IdSchema,
    collectionId: IdSchema,
    revision: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
  }).nullable(),
})
export type LocalCollectionContextResponse = z.infer<
  typeof LocalCollectionContextResponseSchema
>

export const CreateLocalCollectionInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Ingresa un nombre para la colección.')
    .max(120, 'El nombre de la colección no puede superar los 120 caracteres.'),
  year: z
    .number()
    .int()
    .min(2000, 'Ingresa un año válido.')
    .max(2100, 'Ingresa un año válido.'),
})
export type CreateLocalCollectionInput = z.infer<
  typeof CreateLocalCollectionInputSchema
>

export const LocalCollectionSummarySchema =
  LocalCollectionContextResponseSchema.extend({
    name: z.string().min(1),
    year: z.number().int(),
    invoiceCount: z.number().int().nonnegative(),
  })
export type LocalCollectionSummary = z.infer<
  typeof LocalCollectionSummarySchema
>

export const LocalCollectionRunSchema = z.object({
  id: IdSchema,
  invoiceId: IdSchema,
  collectionId: IdSchema.nullable(),
  status: LocalAnalysisRunStatusSchema,
  createdAt: IsoDateTimeSchema,
  readAt: IsoDateTimeSchema.nullish().transform((value) => value ?? null),
})
export type LocalCollectionRun = z.infer<typeof LocalCollectionRunSchema>

export const LocalCollectionDetailSchema =
  LocalCollectionContextResponseSchema.extend({
    invoices: z.array(LocalCollectionInvoiceSchema),
    runs: z.array(LocalCollectionRunSchema),
  })
export type LocalCollectionDetail = z.infer<typeof LocalCollectionDetailSchema>

export const TaxpayerProfileContextSchema = z.object({
  hasRuc: z.boolean(),
  taxRegime: TaxRegimeSchema,
  vatFilingFrequency: VatFilingFrequencySchema,
})
export type TaxpayerProfileContext = z.infer<
  typeof TaxpayerProfileContextSchema
>
