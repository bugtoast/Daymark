import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import {
  DATABASE_PATH,
  DEFAULT_SETTINGS,
  initializeDatabase,
  readState,
  replaceState,
} from '../server/database.js'
import { createDefaultSchedule, localDateKey } from '../shared/schedule.js'

test('uses the project-local SQLite database path', () => {
  assert.equal(DATABASE_PATH, resolve('data/database.sqlite'))
})

test('persists and validates application data across SQLite connections', () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'daymark-sqlite-test-'))
  const databasePath = join(temporaryDirectory, 'database.sqlite')
  const today = localDateKey()
  const expectedHabit = {
    id: 48123,
    name: 'Persistence check',
    icon: 'check',
    color: '#3b82f6',
    detail: 'Daily routine',
    streak: 0,
    longest: 0,
    done: true,
    progress: 1,
    target: 1,
    category: 'Focus',
    archived: false,
    schedule: createDefaultSchedule(today),
    logs: { [today]: { done: true, progress: 1 } },
  }

  let database: DatabaseSync | undefined
  try {
    database = new DatabaseSync(databasePath)
    initializeDatabase(database)
    replaceState({
      schemaVersion: 1,
      habits: [expectedHabit],
      settings: { ...DEFAULT_SETTINGS, categories: [...DEFAULT_SETTINGS.categories] },
      activePage: 'Today',
    }, database)
    database.close()
    database = undefined

    database = new DatabaseSync(databasePath)
    initializeDatabase(database)
    const state = readState(database)
    assert.equal(state.habits.length, 1)
    assert.equal(state.habits[0]?.name, expectedHabit.name)
    assert.equal(state.habits[0]?.color, expectedHabit.color)
    assert.deepEqual(state.habits[0]?.logs[today], { done: true, progress: 1 })
    assert.equal(database.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok')
  } finally {
    database?.close()
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
})
