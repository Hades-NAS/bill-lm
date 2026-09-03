import z from 'zod'

export const FilterFormSchema = z.object({
  textValue: z.string(),
  numberValue: z.number().nullable(),
  dateRangeValue: z.tuple([z.date().nullable(), z.date().nullable()]),
  thresholdValue: z.number(),
  thresholdCondition: z.enum(['>', '<', '>=', '<=']),
  numberRangeValue: z.tuple([z.number(), z.number()]),
})

export type FilterFormValues = z.infer<typeof FilterFormSchema>
