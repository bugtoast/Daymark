import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getScheduleStreakStats, localDateKey, normalizeSchedule } from '../shared/schedule.js'
import type { Schedule } from '../shared/schedule.js'

export type AppPage = 'Today' | 'Habits' | 'Stats' | 'Settings'
export type AppSettings = {
  dark: boolean
  weekStart: 'Monday' | 'Sunday' | 'Saturday'
  reminderTime: string
  remindersOn: boolean
  showStreak: boolean
  showActivity: boolean
  completionGoal: number
  userName: string
  avatarColor: string
  categories: string[]
}
export type HabitLog = { done: boolean; progress: number }
export type HabitState = {
  id: number
  position: number
  name: string
  icon: string
  color: string
  detail: string
  streak: number
  longest: number
  done: boolean
  progress: number
  target: number
  category: string
  archived: boolean
  schedule: Schedule
  logs: Record<string, HabitLog>
}
export type AppState = {
  schemaVersion: 1
  habits: HabitState[]
  settings: AppSettings
  activePage: AppPage
}
type JsonRecord = Record<string, unknown>

const SERVER_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const PROJECT_PARENT = resolve(SERVER_DIRECTORY, '..')
const PROJECT_ROOT = existsSync(join(PROJECT_PARENT, 'package.json')) ? PROJECT_PARENT : resolve(PROJECT_PARENT, '..')
export const DATA_DIR = join(PROJECT_ROOT, 'data')
export const DATABASE_PATH = join(DATA_DIR, 'database.sqlite')
export const BACKUP_DIR = join(DATA_DIR, 'backups')
export const DEFAULT_SETTINGS: AppSettings = {
  dark: false,
  weekStart: 'Monday',
  reminderTime: '08:00',
  remindersOn: false,
  showStreak: true,
  showActivity: true,
  completionGoal: 80,
  userName: '',
  avatarColor: '#477a6b',
  categories: ['Body', 'Mind', 'Wellness', 'Home', 'Focus'],
}

mkdirSync(DATA_DIR, { recursive: true })
mkdirSync(BACKUP_DIR, { recursive: true })

export const db = new DatabaseSync(DATABASE_PATH)
const emptyState: AppState = {
  schemaVersion: 1,
  habits: [],
  settings: { ...DEFAULT_SETTINGS, categories: [...DEFAULT_SETTINGS.categories] },
  activePage: 'Today',
}

export function initializeDatabase(database: DatabaseSync): void {
  database.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = DELETE;
  PRAGMA synchronous = FULL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL CHECK (json_valid(value_json))
  );
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY,
    position INTEGER NOT NULL,
    name TEXT NOT NULL CHECK (length(name) > 0),
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    detail TEXT NOT NULL,
    streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
    longest INTEGER NOT NULL DEFAULT 0 CHECK (longest >= 0),
    done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
    progress REAL NOT NULL DEFAULT 0 CHECK (progress >= 0),
    target REAL NOT NULL DEFAULT 1 CHECK (target > 0),
    category TEXT NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    schedule_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(schedule_json))
  );
  CREATE TABLE IF NOT EXISTS habit_logs (
    habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date_key TEXT NOT NULL CHECK (date_key GLOB '????-??-??'),
    done INTEGER NOT NULL CHECK (done IN (0, 1)),
    progress REAL NOT NULL CHECK (progress >= 0),
    PRIMARY KEY (habit_id, date_key)
  );
  CREATE INDEX IF NOT EXISTS habit_logs_date_idx ON habit_logs(date_key);
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `)

  let schemaVersion = database.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get()?.value
  if (schemaVersion !== undefined && !['1', '2', '3'].includes(String(schemaVersion))) {
    throw new Error(`Unsupported SQLite schema version ${String(schemaVersion)}.`)
  }
  if (schemaVersion === '1') {
    database.exec('DROP TABLE IF EXISTS habit_history;')
    database.prepare("UPDATE app_meta SET value = '2' WHERE key = 'schema_version'").run()
    schemaVersion = '2'
  }
  if (schemaVersion === '2') {
    const columns = database.prepare('PRAGMA table_info(habits)').all() as Array<{ name: string }>
    if (!columns.some(column => column.name === 'schedule_json')) {
      database.exec("ALTER TABLE habits ADD COLUMN schedule_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(schedule_json));")
    }
    database.prepare("UPDATE app_meta SET value = '3' WHERE key = 'schema_version'").run()
    schemaVersion = '3'
  } else if (schemaVersion === undefined) {
    database.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?)').run('schema_version', '3')
  }
  if (!database.prepare("SELECT 1 FROM app_state WHERE key = 'settings'").get()) {
    replaceState(emptyState, database)
  }
}
initializeDatabase(db)

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedString(value: unknown, label: string, fallback: string, maxLength = 240): string {
  if (value === undefined || value === null) return fallback
  assert(typeof value === 'string', `${label} must be text.`)
  return value.trim().slice(0, maxLength)
}

function nonNegativeNumber(value: unknown, label: string, fallback = 0): number {
  if (value === undefined || value === null) return fallback
  assert(typeof value === 'number' && Number.isFinite(value) && value >= 0, `${label} must be a non-negative number.`)
  return value
}

export function normalizeState(input: unknown): AppState {
  assert(isRecord(input), 'The data file must contain a Daymark backup object.')
  assert(input.schemaVersion === 1, 'Unsupported or missing Daymark backup version.')
  const rawHabits = input.habits
  assert(Array.isArray(rawHabits), 'The backup must include a habits list.')
  assert(rawHabits.length <= 500, 'A backup cannot contain more than 500 habits.')
  const rawSettings = input.settings
  assert(isRecord(rawSettings), 'The backup must include settings.')
  const activePageValue = input.activePage ?? 'Today'
  assert(['Today', 'Habits', 'Stats', 'Settings'].includes(String(activePageValue)), 'The saved page is invalid.')

  const ids = new Set<number>()
  const habits: HabitState[] = rawHabits.map((rawItem: unknown, position: number): HabitState => {
    assert(isRecord(rawItem), `Habit ${position + 1} is invalid.`)
    const item = rawItem
    const id = Number(item.id)
    assert(Number.isSafeInteger(id) && id > 0 && !ids.has(id), `Habit ${position + 1} has an invalid or duplicate ID.`)
    ids.add(id)
    const name = boundedString(item.name, `Habit ${position + 1} name`, '', 160)
    assert(name.length > 0, `Habit ${position + 1} needs a name.`)
    const target = nonNegativeNumber(item.target, `${name} target`, 1)
    assert(Number.isInteger(target) && target > 0 && target <= 999, `${name} target must be a whole number between 1 and 999.`)
    const progress = nonNegativeNumber(item.progress, `${name} progress`, 0)
    assert(progress <= target, `${name} progress cannot exceed its target.`)
    assert(item.done === undefined || typeof item.done === 'boolean', `${name} completion value is invalid.`)
    assert(item.archived === undefined || typeof item.archived === 'boolean', `${name} archive value is invalid.`)
    const rawLogs = item.logs ?? {}
    assert(isRecord(rawLogs), `${name} daily logs are invalid.`)
    assert(Object.keys(rawLogs).length <= 10000, `${name} cannot contain more than 10,000 daily records.`)
    const cleanLogs: Record<string, HabitLog> = {}
    for (const [dateKey, rawRecord] of Object.entries(rawLogs)) {
      assert(/^\d{4}-\d{2}-\d{2}$/.test(dateKey), `${name} has an invalid log date.`)
      const [year, month, day] = dateKey.split('-').map(Number)
      const parsedDate = new Date(0)
      parsedDate.setUTCFullYear(year, month - 1, day)
      parsedDate.setUTCHours(0, 0, 0, 0)
      assert(year > 0 && parsedDate.getUTCFullYear() === year && parsedDate.getUTCMonth() === month - 1 && parsedDate.getUTCDate() === day, `${name} has an invalid log date.`)
      assert(isRecord(rawRecord), `${name} has an invalid log entry.`)
      const record = rawRecord
      assert(record.done === undefined || typeof record.done === 'boolean', `${name} log completion value is invalid.`)
      const loggedProgress = nonNegativeNumber(record.progress, `${name} logged progress`, 0)
      assert(loggedProgress <= target, `${name} logged progress cannot exceed its target.`)
      const completed = record.done === true || loggedProgress >= target
      cleanLogs[dateKey] = { done: completed, progress: completed ? target : loggedProgress }
    }
    const done = item.done === true || progress >= target
    const normalizedProgress = done ? target : progress
    const detail = boundedString(item.detail, `${name} details`, 'Daily routine', 500)
    const todayKey = localDateKey()
    if (!cleanLogs[todayKey] && (done || normalizedProgress > 0)) {
      cleanLogs[todayKey] = { done, progress: normalizedProgress }
    }
    const color = boundedString(item.color, `${name} color`, '#477a6b', 24) || '#477a6b'
    assert(/^#[\da-f]{6}$/i.test(color), `${name} color must be a six-digit hex color.`)
    const firstLogDate = Object.keys(cleanLogs).sort()[0] ?? todayKey
    const schedule = normalizeSchedule(item.schedule, detail, firstLogDate)
    const streak = getScheduleStreakStats(schedule, cleanLogs, todayKey)
    return {
      id,
      position,
      name,
      icon: boundedString(item.icon, `${name} icon`, 'sparkles', 100) || 'sparkles',
      color,
      detail,
      streak: streak.current,
      longest: streak.best,
      done,
      progress: normalizedProgress,
      target,
      category: boundedString(item.category, `${name} category`, 'General', 100) || 'General',
      archived: item.archived === true,
      schedule,
      logs: cleanLogs,
    }
  })

  const rawCategories = rawSettings.categories === undefined ? [...DEFAULT_SETTINGS.categories] : rawSettings.categories
  assert(Array.isArray(rawCategories) && rawCategories.every((value: unknown) => typeof value === 'string'), 'Habit categories are invalid.')
  assert(rawCategories.length <= 100, 'A backup cannot contain more than 100 habit categories.')
  const uniqueCategories = new Set<string>()
  const cleanCategories = (rawCategories as string[])
    .map(value => value.trim().slice(0, 100))
    .filter(value => {
      const normalized = value.toLocaleLowerCase()
      if (!value || uniqueCategories.has(normalized)) return false
      uniqueCategories.add(normalized)
      return true
    })
  if (cleanCategories.length === 0) cleanCategories.push(...DEFAULT_SETTINGS.categories)
  const completionGoal = rawSettings.completionGoal === undefined ? DEFAULT_SETTINGS.completionGoal : Number(rawSettings.completionGoal)
  assert(Number.isInteger(completionGoal) && completionGoal >= 0 && completionGoal <= 100, 'Completion goal must be between 0 and 100.')
  const rawWeekStart = rawSettings.weekStart ?? DEFAULT_SETTINGS.weekStart
  assert(rawWeekStart === 'Monday' || rawWeekStart === 'Sunday' || rawWeekStart === 'Saturday', 'Week start day is invalid.')
  const reminderTime = rawSettings.reminderTime ?? DEFAULT_SETTINGS.reminderTime
  assert(typeof reminderTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime), 'Reminder time is invalid.')
  const userName = boundedString(rawSettings.userName, 'Display name', DEFAULT_SETTINGS.userName, 32)
  const avatarColor = boundedString(rawSettings.avatarColor, 'Avatar color', DEFAULT_SETTINGS.avatarColor, 24)
  assert(/^#[\da-f]{6}$/i.test(avatarColor), 'Avatar color must be a six-digit hex color.')
  for (const key of ['dark', 'remindersOn', 'showStreak', 'showActivity'] as const) {
    assert(rawSettings[key] === undefined || typeof rawSettings[key] === 'boolean', `${key} must be true or false.`)
  }
  const settings: AppSettings = {
    dark: rawSettings.dark === undefined ? DEFAULT_SETTINGS.dark : rawSettings.dark as boolean,
    weekStart: rawWeekStart,
    reminderTime,
    remindersOn: rawSettings.remindersOn === undefined ? DEFAULT_SETTINGS.remindersOn : rawSettings.remindersOn as boolean,
    showStreak: rawSettings.showStreak === undefined ? DEFAULT_SETTINGS.showStreak : rawSettings.showStreak as boolean,
    showActivity: rawSettings.showActivity === undefined ? DEFAULT_SETTINGS.showActivity : rawSettings.showActivity as boolean,
    completionGoal: completionGoal as number,
    userName,
    avatarColor,
    categories: cleanCategories,
  }
  return { schemaVersion: 1, habits, settings, activePage: activePageValue as AppPage }
}

type SqliteLogRow = { habit_id: number; date_key: string; done: number; progress: number }
type SqliteHabitRow = {
  id: number; name: string; icon: string; color: string; detail: string; streak: number; longest: number
  target: number; category: string; archived: number; schedule_json?: string
}

export function readState(database: DatabaseSync = db): AppState {
  const settingsRow = database.prepare("SELECT value_json FROM app_state WHERE key = 'settings'").get() as { value_json: string } | undefined
  const pageRow = database.prepare("SELECT value_json FROM app_state WHERE key = 'active_page'").get() as { value_json: string } | undefined
  const settings: unknown = settingsRow ? JSON.parse(settingsRow.value_json) : { ...DEFAULT_SETTINGS, categories: [...DEFAULT_SETTINGS.categories] }
  const logRows = database.prepare('SELECT habit_id, date_key, done, progress FROM habit_logs ORDER BY habit_id, date_key').all() as SqliteLogRow[]
  const logsByHabit = new Map<number, Record<string, HabitLog>>()
  for (const row of logRows) {
    const logs = logsByHabit.get(row.habit_id) ?? {}
    logs[row.date_key] = { done: Boolean(row.done), progress: row.progress }
    logsByHabit.set(row.habit_id, logs)
  }
  const todayKey = localDateKey()
  const hasScheduleColumn = (database.prepare('PRAGMA table_info(habits)').all() as Array<{ name: string }>).some(column => column.name === 'schedule_json')
  const habits = (database.prepare('SELECT * FROM habits ORDER BY position, id').all() as SqliteHabitRow[]).map(row => {
    const logs = logsByHabit.get(row.id) ?? {}
    const todayRecord = logs[todayKey]
    const storedSchedule: unknown = hasScheduleColumn && row.schedule_json ? JSON.parse(row.schedule_json) : null
    const schedule = isRecord(storedSchedule) && storedSchedule.unit ? storedSchedule : undefined
    return {
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      detail: row.detail,
      streak: row.streak,
      longest: row.longest,
      done: todayRecord?.done ?? false,
      progress: todayRecord?.progress ?? 0,
      target: row.target,
      category: row.category,
      archived: Boolean(row.archived),
      schedule,
      logs,
    }
  })
  const activePage: unknown = pageRow ? JSON.parse(pageRow.value_json) : 'Today'
  return normalizeState({ schemaVersion: 1, habits, settings, activePage })
}

export function replaceState(input: unknown, database: DatabaseSync = db): AppState {
  const state = normalizeState(input)
  database.exec('BEGIN IMMEDIATE')
  try {
    database.exec('DELETE FROM habit_logs; DELETE FROM habits; DELETE FROM app_state;')
    const insertHabit = database.prepare(`INSERT INTO habits
      (id, position, name, icon, color, detail, streak, longest, done, progress, target, category, archived, schedule_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    const insertLog = database.prepare('INSERT INTO habit_logs (habit_id, date_key, done, progress) VALUES (?, ?, ?, ?)')
    for (const habit of state.habits) {
      insertHabit.run(habit.id, habit.position, habit.name, habit.icon, habit.color, habit.detail, habit.streak,
        habit.longest, habit.done ? 1 : 0, habit.progress, habit.target, habit.category, habit.archived ? 1 : 0, JSON.stringify(habit.schedule))
      for (const [dateKey, record] of Object.entries(habit.logs)) {
        insertLog.run(habit.id, dateKey, record.done ? 1 : 0, record.progress)
      }
    }
    database.prepare('INSERT INTO app_state (key, value_json) VALUES (?, ?)').run('settings', JSON.stringify(state.settings))
    database.prepare('INSERT INTO app_state (key, value_json) VALUES (?, ?)').run('active_page', JSON.stringify(state.activePage))
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
  return readState(database)
}

export function resetState(database: DatabaseSync = db): AppState {
  database.exec('PRAGMA secure_delete = ON;')
  const state = replaceState(emptyState, database)
  database.exec('VACUUM;')
  return state
}

export function wipeAllData(): AppState {
  let suffix = 0
  let stagedBackupDir = join(DATA_DIR, `backups-pending-delete-${Date.now()}`)
  while (existsSync(stagedBackupDir)) stagedBackupDir = join(DATA_DIR, `backups-pending-delete-${Date.now()}-${++suffix}`)
  renameSync(BACKUP_DIR, stagedBackupDir)
  try {
    mkdirSync(BACKUP_DIR, { recursive: true })
    const state = resetState()
    try {
      rmSync(stagedBackupDir, { recursive: true, force: true })
    } catch (error) {
      throw new Error(`Data was cleared, but old backups could not be removed from ${stagedBackupDir}. ${error instanceof Error ? error.message : ''}`)
    }
    return state
  } catch (error) {
    if (existsSync(stagedBackupDir)) {
      rmSync(BACKUP_DIR, { recursive: true, force: true })
      renameSync(stagedBackupDir, BACKUP_DIR)
    }
    throw error
  }
}

export function createBackup(): { filename: string; path: string; size: number } {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  let filename = `daymark-${timestamp}.sqlite`
  let suffix = 1
  while (existsSync(join(BACKUP_DIR, filename))) {
    filename = `daymark-${timestamp}-${suffix++}.sqlite`
  }
  const destination = join(BACKUP_DIR, filename).replaceAll("'", "''")
  db.exec(`VACUUM INTO '${destination}'`)
  return { filename, path: join(BACKUP_DIR, filename), size: statSync(join(BACKUP_DIR, filename)).size }
}

export type BackupInfo = { filename: string; size: number; createdAt: string }
export function listBackups(): BackupInfo[] {
  return readdirSync(BACKUP_DIR)
    .filter(filename => /^daymark-\d{8}T\d{6}Z(?:-\d+)?\.sqlite$/.test(filename))
    .map(filename => {
      const filePath = join(BACKUP_DIR, filename)
      const stats = statSync(filePath)
      return { filename, size: stats.size, createdAt: stats.mtime.toISOString() }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function resolveBackup(filename: string): string | null {
  if (typeof filename !== 'string' || !/^daymark-\d{8}T\d{6}Z(?:-\d+)?\.sqlite$/.test(filename)) return null
  return join(BACKUP_DIR, filename)
}

export function readBackupState(filename: string): AppState {
  const backupPath = resolveBackup(filename)
  assert(backupPath, 'Backup name is invalid.')
  const backupDb = new DatabaseSync(backupPath, { readOnly: true })
  try {
    const integrity = backupDb.prepare('PRAGMA integrity_check').get() as { integrity_check?: string } | undefined
    assert(integrity?.integrity_check === 'ok', 'Backup integrity check failed.')
    const version = backupDb.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get() as { value?: string } | undefined
    assert(typeof version?.value === 'string' && ['1', '2', '3'].includes(version.value), 'This backup uses an unsupported database schema.')
    return readState(backupDb)
  } finally {
    backupDb.close()
  }
}

