import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'

import { LocalLibrary } from './library'
import { startLocalDaemon } from './server'

const daemonHost = '127.0.0.1'
const daemonPort = 4318

export function resolveLocalLibraryPath(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const override = environment.BILL_LM_LOCAL_LIBRARY_DIR
  if (override) {
    if (!isAbsolute(override))
      throw new Error('BILL_LM_LOCAL_LIBRARY_DIR must be an absolute path.')
    return override
  }

  return join(
    environment.XDG_DATA_HOME ?? environment.HOME ?? homedir(),
    environment.XDG_DATA_HOME ? 'bill-lm' : '.local/share/bill-lm',
  )
}

export function runLocalDaemon() {
  const library = new LocalLibrary(resolveLocalLibraryPath())
  const server = startLocalDaemon(library, daemonPort)
  let shuttingDown = false

  const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true
    server.stop(true)
    library.close()
    process.exit(0)
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  console.info(`Bill-LM local daemon listening on http://${daemonHost}:${server.port}`)
}

if (import.meta.main) runLocalDaemon()
