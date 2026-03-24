import z from "zod";

export const AnalyzeBillOutputSchema = z.object({
  percentage: z.number().min(0).max(100),
  reason: z.string().min(1).max(10000),
})

export type AnalyzeBillOutput = z.infer<typeof AnalyzeBillOutputSchema>
