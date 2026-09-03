import {
  keepPreviousData,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { createTRPCClient, httpBatchStreamLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import superjson from 'superjson'

import { TRPCProvider } from '#/integrations/trpc/react'
import { getFirebaseIdToken } from '#/integrations/firebase/firebase'

import type { TRPCRouter } from '#/integrations/trpc/router'
import type { ReactNode } from 'react'

function getUrl() {
  const base = (() => {
    if (typeof window !== 'undefined') return ''
    return `http://localhost:${process.env.PORT ?? 3000}`
  })()
  return `${base}/api/trpc`
}

export const trpcClient = createTRPCClient<TRPCRouter>({
  links: [
    httpBatchStreamLink({
      transformer: superjson,
      url: getUrl(),
      headers: async () => {
        const token = await getFirebaseIdToken()
        return token ? { Authorization: `Bearer ${token}` } : {}
      },
    }),
  ],
})

let context:
  | {
      queryClient: QueryClient
      trpc: ReturnType<typeof createTRPCOptionsProxy<TRPCRouter>>
    }
  | undefined

export function getContext() {
  if (context) {
    return context
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: { serializeData: superjson.serialize },
      hydrate: { deserializeData: superjson.deserialize },
      queries: {
        placeholderData: keepPreviousData,
      },
    },
  })

  const serverHelpers = createTRPCOptionsProxy({
    client: trpcClient,
    queryClient: queryClient,
  })
  context = {
    queryClient,
    trpc: serverHelpers,
  }

  return context
}

export default function TanStackQueryProvider({
  children,
}: {
  children: ReactNode
}) {
  const { queryClient } = getContext()

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  )
}
