import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDefaultSchedule,
  formatScheduleSummary,
  getScheduleStreakStats,
  isScheduledDate,
  normalizeSchedule,
} from '../shared/schedule.js'

test('normalizes and validates repeating schedules', () => {
  const schedule = normalizeSchedule({
    ...createDefaultSchedule('2026-10-01'),
    unit: 'week',
    weekdays: [5, 1, 5],
  })

  assert.deepEqual(schedule.weekdays, [1, 5])
  assert.equal(isScheduledDate(schedule, '2026-10-05'), true)
  assert.equal(isScheduledDate(schedule, '2026-10-06'), false)
  assert.throws(() => normalizeSchedule({ ...schedule, interval: 0 }), /between 1 and 365/)
})

test('supports monthly weekday patterns and month-end dates', () => {
  const secondThursday = normalizeSchedule({
    ...createDefaultSchedule('2026-10-01'),
    unit: 'month',
    monthMode: 'weekday',
    monthOrdinal: 'second',
    monthWeekday: 4,
  })
  assert.equal(isScheduledDate(secondThursday, '2026-10-08'), true)
  assert.equal(isScheduledDate(secondThursday, '2026-10-15'), false)

  const lastDay = normalizeSchedule({
    ...createDefaultSchedule('2026-02-01'),
    unit: 'month',
    monthDays: [31, 0],
  })
  assert.deepEqual(lastDay.monthDays, [0, 31])
  assert.equal(isScheduledDate(lastDay, '2026-02-28'), true)
  assert.equal(isScheduledDate(lastDay, '2026-02-31'), false)
})

test('counts streaks only across scheduled dates and formats summaries', () => {
  const schedule = normalizeSchedule({
    ...createDefaultSchedule('2026-10-19'),
    unit: 'week',
    weekdays: [1, 3, 5],
  })
  const stats = getScheduleStreakStats(schedule, {
    '2026-10-19': { done: true, progress: 1 },
    '2026-10-20': { done: true, progress: 1 },
    '2026-10-21': { done: true, progress: 1 },
  }, '2026-10-22')

  assert.deepEqual(stats, { current: 2, best: 2 })
  assert.equal(formatScheduleSummary(schedule, false), 'Every week · Mon, Wed, Fri')
})
