import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleApiRequest } from './api.js'
import { db } from './database.js'

const PROJECT_ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)))
const DIST_DIR = resolve(PROJECT_ROOT, 'dist')
if (!existsSync(resolve(DIST_DIR, 'index.html'))) {
  throw new Error('Production build not found. Run `npm run build` first.')
}

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
  if (request.url?.startsWith('/api/')) {
    await handleApiRequest(request, response)
    return
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' })
    response.end('Method not allowed')
    return
  }

  let pathname: string
  try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname) } catch {
    response.writeHead(400)
    response.end('Invalid URL')
    return
  }
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const filePath = resolve(DIST_DIR, relativePath)
  if (filePath !== DIST_DIR && !filePath.startsWith(`${DIST_DIR}${sep}`)) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  let resolvedPath = filePath
  if (!existsSync(resolvedPath) || !statSync(resolvedPath).isFile()) {
    resolvedPath = resolve(DIST_DIR, 'index.html')
  }
  const headers = {
    'Content-Type': contentTypes[extname(resolvedPath).toLowerCase()] ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': resolvedPath.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  }
  response.writeHead(200, headers)
  if (request.method === 'HEAD') response.end()
  else {
    try { await pipeline(createReadStream(resolvedPath), response) } catch (error) {
      if (!response.destroyed) response.destroy(error instanceof Error ? error : undefined)
    }
  }
})

const host = process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.PORT ?? 3000)
server.listen(port, host, () => console.log(`Daymark is available at http://${host}:${port}`))

function shutdown(): void {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
