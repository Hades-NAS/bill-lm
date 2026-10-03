import { createLocalDaemon } from './app'
import { probeLocalConnection } from './adapters'
import { createLocalDaemonLogger } from './logger'

import type { LocalLibrary } from './library'

export function startLocalDaemon(library: LocalLibrary, port = 4318, logger = createLocalDaemonLogger()) {
  const app = createLocalDaemon(library, probeLocalConnection, undefined, logger)
  return Bun.serve({
    hostname: '127.0.0.1',
    port,
    fetch: app.fetch,
  })
}
