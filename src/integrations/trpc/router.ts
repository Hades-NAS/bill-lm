
import { createTRPCRouter } from './init'
import { collectionsRouter } from './procedures/collections'


export const trpcRouter = createTRPCRouter({
  collections: collectionsRouter
})

export type TRPCRouter = typeof trpcRouter
