import { createTRPCRouter } from './init'
import { billsRouter } from './procedures/bills'
import { collectionsRouter } from './procedures/collections'
import { providerConnectionsRouter } from './procedures/provider-connections'
import { telemetryRouter } from './procedures/telemetry'

export const trpcRouter = createTRPCRouter({
  collections: collectionsRouter,
  bills: billsRouter,
  telemetry: telemetryRouter,
  providerConnections: providerConnectionsRouter,
})

export type TRPCRouter = typeof trpcRouter
