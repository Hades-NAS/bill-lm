import { createServer as createNetServer } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'

import localViewerConfig from '../../vite.config'

let server: ViteDevServer | undefined

async function reserveEphemeralPort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const listener = createNetServer()
    listener.once('error', reject)
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address()
      if (!address || typeof address === 'string') {
        listener.close(() => reject(new Error('Expected a TCP address')))
        return
      }
      listener.close((error) => (error ? reject(error) : resolve(address.port)))
    })
  })
}

afterEach(async () => {
  await server?.close()
  server = undefined
})

describe('local viewer development server', () => {
  it('serves the isolated local viewer root', async () => {
    const port = await reserveEphemeralPort()
    server = await createServer({
      ...localViewerConfig,
      configFile: false,
      logLevel: 'error',
      server: {
        ...localViewerConfig.server,
        host: '127.0.0.1',
        port,
        strictPort: true,
      },
    })
    await server.listen()

    const address = server.httpServer?.address()
    expect(address).toMatchObject({ port: expect.any(Number) })
    if (!address || typeof address === 'string') throw new Error('Expected a TCP address')

    const response = await fetch(`http://127.0.0.1:${address.port}/`)

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toContain('id="local-viewer"')
  })
})
