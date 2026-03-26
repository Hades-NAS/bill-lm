import { createTRPCRouter } from './init'
import { billsRouter } from './procedures/bills'
import { collectionsRouter } from './procedures/collections'
import { telemetryRouter } from './procedures/telemetry'

export const trpcRouter = createTRPCRouter({
  collections: collectionsRouter,
  bills: billsRouter,
  telemetry: telemetryRouter,
})

export type TRPCRouter = typeof trpcRouter
