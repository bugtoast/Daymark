import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import { createApiServer } from '../server/api.js'

test('serves SQLite health and state and rejects cross-origin mutations', async () => {
  const server = createApiServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${address.port}`
  try {
    const healthResponse = await fetch(`${baseUrl}/api/health`)
    assert.equal(healthResponse.status, 200)
    assert.deepEqual(await healthResponse.json(), { ok: true, database: 'SQLite', integrity: 'ok' })

    const stateResponse = await fetch(`${baseUrl}/api/data`)
    assert.equal(stateResponse.status, 200)
    const state = await stateResponse.json() as { schemaVersion: number; habits: unknown[]; settings: unknown }
    assert.equal(state.schemaVersion, 1)
    assert.ok(Array.isArray(state.habits))
    assert.ok(state.settings)

    const rejectedMutation = await fetch(`${baseUrl}/api/data/wipe`, {
      method: 'POST',
      headers: { origin: 'https://untrusted.example' },
    })
    assert.equal(rejectedMutation.status, 403)
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
