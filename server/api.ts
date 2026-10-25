import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { basename } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  BACKUP_DIR,
  createBackup,
  db,
  listBackups,
  normalizeState,
  readBackupState,
  readState,
  replaceState,
  resolveBackup,
  wipeAllData,
  type AppState,
} from './database.js'

const MAX_BODY_SIZE = 25 * 1024 * 1024

class ApiError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message)
    this.name = 'ApiError'
  }
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown): void {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
  })
  response.end(JSON.stringify(value))
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_SIZE) throw new ApiError('Request is too large (25 MB maximum).', 413)
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    throw new ApiError('Request body must be valid JSON.', 400)
  }
}

function backupNameFromPath(pathname: string, action: 'download' | 'restore'): string | null {
  const match = pathname.match(new RegExp(`^/api/backups/([^/]+)/${action}$`))
  if (!match) return null
  try { return decodeURIComponent(match[1]) } catch { return null }
}

function isLocalOrigin(value: string): boolean {
  try {
    const origin = new URL(value)
    return origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
  } catch {
    return false
  }
}

function assertSafeMutation(request: IncomingMessage): void {
  if (request.headers.origin && !isLocalOrigin(request.headers.origin)) {
    throw new ApiError('Cross-origin data changes are not allowed.', 403)
  }
  if (request.headers['sec-fetch-site'] === 'cross-site') {
    throw new ApiError('Cross-origin data changes are not allowed.', 403)
  }
}

export async function handleApiRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost')
  try {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method ?? '')) assertSafeMutation(request)

    if (request.method === 'GET' && url.pathname === '/api/health') {
      const row = db.prepare('PRAGMA integrity_check').get() as { integrity_check?: string } | undefined
      sendJson(response, row?.integrity_check === 'ok' ? 200 : 503, {
        ok: row?.integrity_check === 'ok',
        database: 'SQLite',
        integrity: row?.integrity_check ?? 'unavailable',
      })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/data') {
      sendJson(response, 200, readState())
      return
    }

    if (request.method === 'PUT' && url.pathname === '/api/data') {
      if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
        throw new ApiError('The data request must use application/json.', 415)
      }
      const input = await readJson(request)
      let state: AppState
      try { state = normalizeState(input) } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : 'The data backup is invalid.', 400)
      }
      sendJson(response, 200, replaceState(state))
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/data/import') {
      if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
        throw new ApiError('The data request must use application/json.', 415)
      }
      const input = await readJson(request)
      let state: AppState
      try { state = normalizeState(input) } catch (error) {
        throw new ApiError(error instanceof Error ? error.message : 'The data backup is invalid.', 400)
      }
      createBackup()
      const savedState = replaceState(state)
      sendJson(response, 200, { state: savedState, backups: listBackups() })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/export') {
      const backup = { ...readState(), exportedAt: new Date().toISOString() }
      const date = new Date().toISOString().slice(0, 10)
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="daymark-export-${date}.json"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer',
      })
      response.end(JSON.stringify(backup, null, 2))
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/backups') {
      sendJson(response, 200, { backups: listBackups() })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/backups') {
      const { filename, size } = createBackup()
      sendJson(response, 201, { filename, size, backups: listBackups() })
      return
    }

    const downloadName = backupNameFromPath(url.pathname, 'download')
    if (request.method === 'GET' && downloadName) {
      const backupPath = resolveBackup(downloadName)
      if (!backupPath) {
        sendJson(response, 400, { error: 'Backup name is invalid.' })
        return
      }
      response.writeHead(200, {
        'Content-Type': 'application/vnd.sqlite3',
        'Content-Disposition': `attachment; filename="${basename(backupPath)}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer',
      })
      await pipeline(createReadStream(backupPath), response)
      return
    }

    const restoreName = backupNameFromPath(url.pathname, 'restore')
    if (request.method === 'POST' && restoreName) {
      if (!resolveBackup(restoreName)) {
        sendJson(response, 400, { error: 'Backup name is invalid.' })
        return
      }
      const restoreState = readBackupState(restoreName)
      createBackup()
      sendJson(response, 200, { state: replaceState(restoreState), backups: listBackups() })
      return
    }

    const deleteName = url.pathname.match(/^\/api\/backups\/([^/]+)$/)
    if (request.method === 'DELETE' && deleteName) {
      let filename = ''
      try { filename = decodeURIComponent(deleteName[1] ?? '') } catch {}
      const backupPath = resolveBackup(filename)
      if (!backupPath) {
        sendJson(response, 400, { error: 'Backup name is invalid.' })
        return
      }
      await unlink(backupPath)
      sendJson(response, 200, { backups: listBackups() })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/data/wipe') {
      const state = wipeAllData()
      sendJson(response, 200, { state, backups: [] })
      return
    }

    if (url.pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: 'API route not found.' })
      return
    }
    sendJson(response, 404, { error: 'Not found.' })
  } catch (error) {
    if (response.headersSent) {
      response.destroy(error instanceof Error ? error : undefined)
      return
    }
    const statusCode = error instanceof ApiError ? error.statusCode : error instanceof SyntaxError ? 400 : 500
    sendJson(response, statusCode, { error: error instanceof Error ? error.message : 'Unexpected database error.' })
  }
}

export function createApiServer() {
  return createServer((request, response) => { void handleApiRequest(request, response) })
}

export { BACKUP_DIR }
