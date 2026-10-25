const DAY_MS = 86_400_000
const MAX_SEARCH_DAYS = 12_000

export type ScheduleUnit = 'day' | 'week' | 'month'
export type ScheduleEndMode = 'never' | 'on' | 'after'
export type MonthMode = 'dates' | 'weekday'
export type MonthOrdinal = 'first' | 'second' | 'third' | 'fourth' | 'last'
export type Schedule = {
  unit: ScheduleUnit
  interval: number
  weekdays: number[]
  monthMode: MonthMode
  monthDays: number[]
  monthOrdinal: MonthOrdinal
  monthWeekday: number
  startDate: string
  endMode: ScheduleEndMode
  endDate: string | null
  endAfter: number
}
export type ScheduleLog = { done?: boolean; progress?: number; target?: number }
export type ScheduleLogs = Record<string, ScheduleLog>

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isScheduleUnit(value: unknown): value is ScheduleUnit {
  return value === 'day' || value === 'week' || value === 'month'
}

function isEndMode(value: unknown): value is ScheduleEndMode {
  return value === 'never' || value === 'on' || value === 'after'
}

function isMonthMode(value: unknown): value is MonthMode {
  return value === 'dates' || value === 'weekday'
}

function isMonthOrdinal(value: unknown): value is MonthOrdinal {
  return value === 'first' || value === 'second' || value === 'third' || value === 'fourth' || value === 'last'
}

export function localDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(12, 0, 0, 0)
  return date
}

export function localDateKey(date = new Date()): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(12, 0, 0, 0)
  return year >= 1900 && year <= 9999 && localDateKey(date) === value
}

function dateDistance(startKey: string, endKey: string): number {
  return Math.round((localDate(endKey).getTime() - localDate(startKey).getTime()) / DAY_MS)
}

function mondayOf(date: Date): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7))
  return result
}

function monthsBetween(startKey: string, endKey: string): number {
  const start = localDate(startKey)
  const end = localDate(endKey)
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth()
}

function inferLegacySchedule(label: string, startDate: string): Schedule {
  const normalized = String(label ?? '').trim().toLocaleLowerCase()
  const schedule = createDefaultSchedule(startDate)
  if (normalized.startsWith('weekdays')) {
    schedule.unit = 'week'
    schedule.weekdays = [1, 2, 3, 4, 5]
  } else if (normalized.startsWith('weekends')) {
    schedule.unit = 'week'
    schedule.weekdays = [0, 6]
  } else if (normalized.startsWith('mon · wed · fri') || normalized.startsWith('3 times a week')) {
    schedule.unit = 'week'
    schedule.weekdays = [1, 3, 5]
  } else if (normalized.startsWith('weekly')) {
    schedule.unit = 'week'
    schedule.weekdays = [1]
  }
  return schedule
}

export function createDefaultSchedule(startDate = localDateKey()): Schedule {
  return {
    unit: 'day',
    interval: 1,
    weekdays: [1, 2, 3, 4, 5],
    monthMode: 'dates',
    monthDays: [1],
    monthOrdinal: 'first',
    monthWeekday: 1,
    startDate,
    endMode: 'never',
    endDate: null,
    endAfter: 12,
  }
}

export function normalizeSchedule(input: unknown, legacyLabel = 'Daily', fallbackStartDate = localDateKey()): Schedule {
  const inputRecord = isRecord(input) ? input : null
  const source = inputRecord && isScheduleUnit(inputRecord.unit)
    ? inputRecord
    : inferLegacySchedule(legacyLabel, fallbackStartDate)

  assert(isScheduleUnit(source.unit), 'Repeat unit must be days, weeks, or months.')
  const unit = source.unit
  assert(typeof source.interval === 'number' && Number.isInteger(source.interval) && source.interval >= 1 && source.interval <= 365, 'Repeat interval must be between 1 and 365.')
  const interval = source.interval
  assert(isValidDateKey(source.startDate), 'Schedule start date must be a valid date from 1900 onward.')
  const startDate = source.startDate
  assert(isEndMode(source.endMode), 'Schedule end rule is invalid.')
  const endMode = source.endMode

  const weekdays = Array.isArray(source.weekdays) ? [...new Set(source.weekdays)] : []
  assert(weekdays.every((day): day is number => typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 6), 'Selected weekdays are invalid.')
  const normalizedWeekdays = weekdays as number[]
  if (unit === 'week') assert(normalizedWeekdays.length > 0, 'Select at least one day of the week.')

  assert(isMonthMode(source.monthMode), 'Monthly repeat pattern is invalid.')
  const monthMode = source.monthMode
  const monthDays = Array.isArray(source.monthDays) ? [...new Set(source.monthDays)] : []
  assert(monthDays.every((day): day is number => typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 31), 'Selected month dates are invalid.')
  const normalizedMonthDays = monthDays as number[]
  if (unit === 'month' && monthMode === 'dates') assert(normalizedMonthDays.length > 0, 'Select at least one date in the month.')
  assert(isMonthOrdinal(source.monthOrdinal), 'Monthly weekday position is invalid.')
  const monthOrdinal = source.monthOrdinal
  assert(typeof source.monthWeekday === 'number' && Number.isInteger(source.monthWeekday) && source.monthWeekday >= 0 && source.monthWeekday <= 6, 'Monthly weekday is invalid.')
  const monthWeekday = source.monthWeekday

  const rawEndDate = source.endDate
  assert(rawEndDate === null || rawEndDate === undefined || isValidDateKey(rawEndDate), 'Schedule end date must be valid.')
  if (endMode === 'on') {
    assert(typeof rawEndDate === 'string' && isValidDateKey(rawEndDate), 'Choose a valid schedule end date.')
    assert(rawEndDate >= startDate, 'Schedule end date must be on or after its start date.')
  }
  assert(typeof source.endAfter === 'number' && Number.isInteger(source.endAfter) && source.endAfter >= 1 && source.endAfter <= 10000, 'Ending occurrence count must be between 1 and 10,000.')
  const endAfter = source.endAfter

  return {
    unit,
    interval,
    weekdays: normalizedWeekdays.sort((a, b) => a - b),
    monthMode,
    monthDays: normalizedMonthDays.sort((a, b) => a - b),
    monthOrdinal,
    monthWeekday,
    startDate,
    endMode,
    endDate: endMode === 'on' ? rawEndDate as string : null,
    endAfter,
  }
}

function monthlyDates(schedule: Schedule, year: number, month: number): number[] {
  const lastDay = new Date(year, month + 1, 0).getDate()
  if (schedule.monthMode === 'dates') {
    return [...new Set(schedule.monthDays
      .map(day => day === 0 ? lastDay : day)
      .filter(day => day <= lastDay))]
  }

  const weekday = schedule.monthWeekday
  if (schedule.monthOrdinal === 'last') {
    const lastWeekday = new Date(year, month, lastDay).getDay()
    return [lastDay - ((lastWeekday - weekday + 7) % 7)]
  }
  const ordinal = { first: 1, second: 2, third: 3, fourth: 4 }[schedule.monthOrdinal]
  const firstWeekday = new Date(year, month, 1).getDay()
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (ordinal - 1) * 7
  return day <= lastDay ? [day] : []
}

function firstActiveWeek(schedule: Schedule): number {
  const startWeekday = (localDate(schedule.startDate).getDay() + 6) % 7
  const hasRemainingDay = schedule.weekdays.some(weekday => ((weekday + 6) % 7) >= startWeekday)
  return hasRemainingDay ? 0 : 1
}

function firstActiveMonth(schedule: Schedule): number {
  const start = localDate(schedule.startDate)
  const hasRemainingDate = monthlyDates(schedule, start.getFullYear(), start.getMonth())
    .some(day => localDateKey(new Date(start.getFullYear(), start.getMonth(), day, 12)) >= schedule.startDate)
  return hasRemainingDate ? 0 : 1
}

function isBaseScheduledDate(schedule: Schedule, dateKey: string): boolean {
  if (dateKey < schedule.startDate) return false
  if (schedule.endMode === 'on' && schedule.endDate && dateKey > schedule.endDate) return false
  const date = localDate(dateKey)

  if (schedule.unit === 'day') {
    return dateDistance(schedule.startDate, dateKey) % schedule.interval === 0
  }

  if (schedule.unit === 'week') {
    const weekIndex = Math.round((mondayOf(date).getTime() - mondayOf(localDate(schedule.startDate)).getTime()) / (DAY_MS * 7))
    const activeIndex = weekIndex - firstActiveWeek(schedule)
    return activeIndex >= 0 && activeIndex % schedule.interval === 0 && schedule.weekdays.includes(date.getDay())
  }

  const monthIndex = monthsBetween(schedule.startDate, dateKey)
  const activeIndex = monthIndex - firstActiveMonth(schedule)
  if (activeIndex < 0 || activeIndex % schedule.interval !== 0) return false
  return monthlyDates(schedule, date.getFullYear(), date.getMonth()).includes(date.getDate())
}

function countScheduledThrough(schedule: Schedule, dateKey: string): number {
  if (schedule.unit === 'day') return Math.floor(dateDistance(schedule.startDate, dateKey) / schedule.interval) + 1

  if (schedule.unit === 'week') {
    const date = localDate(dateKey)
    const weekIndex = Math.round((mondayOf(date).getTime() - mondayOf(localDate(schedule.startDate)).getTime()) / (DAY_MS * 7))
    const startWeekDates = schedule.weekdays.filter(weekday => {
      const candidate = new Date(mondayOf(localDate(schedule.startDate)))
      candidate.setDate(candidate.getDate() + ((weekday + 6) % 7))
      const key = localDateKey(candidate)
      return key >= schedule.startDate && key <= dateKey
    })
    if (weekIndex === 0) return startWeekDates.length
    const activeWeekIndex = weekIndex - firstActiveWeek(schedule)
    const fullActiveWeeksBeforeCurrent = activeWeekIndex > 0 ? Math.ceil(activeWeekIndex / schedule.interval) : 0
    const currentWeekDates = activeWeekIndex >= 0 && activeWeekIndex % schedule.interval === 0
      ? schedule.weekdays.filter(weekday => ((weekday + 6) % 7) <= ((date.getDay() + 6) % 7)).length
      : 0
    return startWeekDates.length + fullActiveWeeksBeforeCurrent * schedule.weekdays.length + currentWeekDates
  }

  const target = localDate(dateKey)
  const months = monthsBetween(schedule.startDate, dateKey)
  let count = 0
  for (let monthIndex = firstActiveMonth(schedule); monthIndex <= months; monthIndex += schedule.interval) {
    const start = localDate(schedule.startDate)
    const monthDate = new Date(start.getFullYear(), start.getMonth() + monthIndex, 1, 12)
    for (const day of monthlyDates(schedule, monthDate.getFullYear(), monthDate.getMonth())) {
      const candidate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day, 12)
      const key = localDateKey(candidate)
      if (key >= schedule.startDate && key <= dateKey && key <= localDateKey(target)) count++
    }
    if (count > schedule.endAfter) return count
  }
  return count
}

export function isScheduledDate(input: unknown, dateKey: string): boolean {
  const schedule = normalizeSchedule(input)
  if (!isValidDateKey(dateKey) || !isBaseScheduledDate(schedule, dateKey)) return false
  return schedule.endMode !== 'after' || countScheduledThrough(schedule, dateKey) <= schedule.endAfter
}

export function nextScheduledDateKey(input: unknown, dateKey: string): string | null {
  const schedule = normalizeSchedule(input)
  const date = localDate(dateKey)
  for (let offset = 1; offset <= MAX_SEARCH_DAYS; offset++) {
    const candidate = new Date(date)
    candidate.setDate(date.getDate() + offset)
    const key = localDateKey(candidate)
    if (isScheduledDate(schedule, key)) return key
    if (schedule.endMode === 'on' && schedule.endDate && key > schedule.endDate) return null
  }
  return null
}

export function previousScheduledDateKey(input: unknown, dateKey: string): string | null {
  const schedule = normalizeSchedule(input)
  const date = localDate(dateKey)
  for (let offset = 1; offset <= MAX_SEARCH_DAYS; offset++) {
    const candidate = new Date(date)
    candidate.setDate(date.getDate() - offset)
    const key = localDateKey(candidate)
    if (key < schedule.startDate) return null
    if (isScheduledDate(schedule, key)) return key
  }
  return null
}

export function getScheduleStreakStats(scheduleInput: unknown, logs: ScheduleLogs = {}, todayKey: string): { current: number; best: number } {
  const schedule = normalizeSchedule(scheduleInput)
  const completedDates = new Set(Object.entries(logs ?? {})
    .filter(([dateKey, record]) => dateKey <= todayKey && record.done)
    .map(([dateKey]) => dateKey)
    .filter(dateKey => isScheduledDate(schedule, dateKey)))
  const todayIsScheduled = isScheduledDate(schedule, todayKey)
  const referenceDate = todayIsScheduled && completedDates.has(todayKey)
    ? todayKey
    : previousScheduledDateKey(schedule, todayIsScheduled ? todayKey : localDateKey(new Date(localDate(todayKey).getTime() + DAY_MS)))

  let best = 0
  let running = 0
  let current = 0
  let previous: string | null = null
  for (const dateKey of [...completedDates].sort()) {
    running = previous !== null && nextScheduledDateKey(schedule, previous) === dateKey ? running + 1 : 1
    best = Math.max(best, running)
    if (dateKey === referenceDate) current = running
    previous = dateKey
  }
  return { current, best }
}

export function formatScheduleSummary(input: unknown, includeBounds = true): string {
  const schedule = normalizeSchedule(input)
  const unitLabel = { day: 'day', week: 'week', month: 'month' }[schedule.unit]
  const repeat = schedule.interval === 1
    ? `Every ${unitLabel}`
    : `Every ${schedule.interval} ${unitLabel}s`
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  let pattern = ''

  if (schedule.unit === 'week') {
    pattern = ` · ${schedule.weekdays.map(day => dayNames[day]).join(', ')}`
  } else if (schedule.unit === 'month' && schedule.monthMode === 'dates') {
    const ordinals = schedule.monthDays.map(day => day === 0 ? 'last day' : `${day}${day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'}`)
    pattern = ` · ${ordinals.join(', ')}`
  } else if (schedule.unit === 'month') {
    const ordinal = { first: 'First', second: 'Second', third: 'Third', fourth: 'Fourth', last: 'Last' }[schedule.monthOrdinal]
    pattern = ` · ${ordinal} ${dayNames[schedule.monthWeekday]}`
  }

  const bounds: string[] = []
  if (includeBounds) {
    bounds.push(`from ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(localDate(schedule.startDate))}`)
    if (schedule.endMode === 'on' && schedule.endDate) bounds.push(`through ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(localDate(schedule.endDate))}`)
    if (schedule.endMode === 'after') bounds.push(`for ${schedule.endAfter} occurrence${schedule.endAfter === 1 ? '' : 's'}`)
  }
  return `${repeat}${pattern}${bounds.length ? ` · ${bounds.join(' · ')}` : ''}`
}

export function legacyScheduleLabelToSettings(label: string, startDate: string): Schedule {
  return inferLegacySchedule(label, startDate)
}
