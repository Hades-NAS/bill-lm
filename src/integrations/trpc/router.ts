
import { createTRPCRouter } from './init'
import { billsRouter } from './procedures/bills'
import { collectionsRouter } from './procedures/collections'


export const trpcRouter = createTRPCRouter({
  collections: collectionsRouter,
  bills: billsRouter
})

export type TRPCRouter = typeof trpcRouter
