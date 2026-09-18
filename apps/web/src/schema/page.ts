import { z } from 'zod'

export type ModalFormType<T = unknown> = { opened: boolean; data?: T | null }

export type ModalPageProps<TData = unknown, TSubmit = TData> = {
  modal?: boolean
  allowFile?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | `${number}%`
  state: ModalFormType<TData>
  onClose?: () => void
  onSubmitted?: (item: TSubmit | void) => void
}

export type PageProps<T = unknown> = {
  cardPreview?: boolean
} & T

export const ModeSchema = z.enum(['edit', 'create'])

export type ModeType = z.infer<typeof ModeSchema>

export function paginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    rows: z.array(itemSchema),
    pageCount: z.number().int().min(0, 'Page count must be a positive integer'),
    rowCount: z.number().int().min(0, 'Row count must be a positive integer'),
  })
}

export function paginatedRequestSchema() {
  return z.object({
    pageIndex: z
      .number()
      .int()
      .min(0, 'Page must be a positive integer')
      .default(0),
    pageSize: z
      .number()
      .int()
      .min(1, 'Page size must be a positive integer')
      .default(10),
    sort: z
      .object({
        id: z.string(),
        direction: z.enum(['asc', 'desc']).default('desc'),
      })
      .array()
      .nullish(),
    search: z
      .object({
        id: z.string(),
        value: z.unknown(),
      })
      .array()
      .nullish(),
  })
}
