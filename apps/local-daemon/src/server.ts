import { createLocalDaemon } from './app'
import { probeLocalConnection } from './adapters'

import type { LocalLibrary } from './library'

export function startLocalDaemon(library: LocalLibrary, port = 4318) {
  const app = createLocalDaemon(library, probeLocalConnection)
  return Bun.serve({
    hostname: '127.0.0.1',
    port,
    fetch: app.fetch,
  })
}
