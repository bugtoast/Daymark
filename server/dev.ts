import { createServer as createViteServer } from 'vite'
import { createConnection } from 'node:net'
import type { AddressInfo } from 'node:net'
import { db } from './database.js'
import { createApiServer } from './api.js'

const webPort = Number(process.env.PORT ?? 3100)
const apiPort = Number(process.env.API_PORT ?? 3101)
const apiServer = createApiServer()

async function listenApi(port: number): Promise<number> {
  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: NodeJS.ErrnoException) => reject(error)
      apiServer.once('error', onError)
      apiServer.listen(port, '127.0.0.1', () => {
        apiServer.off('error', onError)
        resolve()
      })
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error
    console.warn(`API port ${port} is already in use; selecting an available local port.`)
    await new Promise<void>((resolve, reject) => {
      const onError = (listenError: NodeJS.ErrnoException) => reject(listenError)
      apiServer.once('error', onError)
      apiServer.listen(0, '127.0.0.1', () => {
        apiServer.off('error', onError)
        resolve()
      })
    })
  }

  const address = apiServer.address() as AddressInfo | null
  if (!address) throw new Error('The local SQLite API did not bind to a network port.')
  return address.port
}

const actualApiPort = await listenApi(apiPort)

const portIsInUse = await new Promise<boolean>(resolve => {
  const socket = createConnection({ host: '127.0.0.1', port: webPort })
  socket.setTimeout(500)
  socket.once('connect', () => { socket.destroy(); resolve(true) })
  socket.once('timeout', () => { socket.destroy(); resolve(false) })
  socket.once('error', () => resolve(false))
})

let vite: Awaited<ReturnType<typeof createViteServer>> | null = null
if (portIsInUse) {
  console.log(`Web server already uses port ${webPort}; serving its /api proxy from the local SQLite service.`)
} else {
  vite = await createViteServer({
    server: {
      proxy: { '/api': `http://127.0.0.1:${actualApiPort}` },
    },
  })
  await vite.listen()
  vite.printUrls()
}
console.log(`Local SQLite API listening at http://127.0.0.1:${actualApiPort}`)

let shuttingDown = false
async function shutdown(): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  if (vite) await vite.close()
  await new Promise<void>((resolve, reject) => apiServer.close(error => error ? reject(error) : resolve()))
  db.close()
}

process.on('SIGINT', () => { void shutdown() })
process.on('SIGTERM', () => { void shutdown() })
