import { createTRPCRouter } from './init'
import { accountRouter } from './procedures/account'
import { billsRouter } from './procedures/bills'
import { collectionsRouter } from './procedures/collections'
import { fiscalReferencesRouter } from './procedures/fiscal-references'
import { officialSourcesRouter } from './procedures/official-sources'
import { providerConnectionsRouter } from './procedures/provider-connections'
import { taxpayerProfilesRouter } from './procedures/taxpayer-profiles'
import { telemetryRouter } from './procedures/telemetry'

export const trpcRouter = createTRPCRouter({
  collections: collectionsRouter,
  bills: billsRouter,
  telemetry: telemetryRouter,
  providerConnections: providerConnectionsRouter,
  fiscalReferences: fiscalReferencesRouter,
  taxpayerProfiles: taxpayerProfilesRouter,
  account: accountRouter,
  officialSources: officialSourcesRouter,
})

export type TRPCRouter = typeof trpcRouter
