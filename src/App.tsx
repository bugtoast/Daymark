import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  createDefaultSchedule,
  formatScheduleSummary,
  getScheduleStreakStats,
  isScheduledDate,
  normalizeSchedule,
} from '../shared/schedule'
import type { Schedule } from '../shared/schedule'
import {
  Activity,
  AlarmClock,
  Apple,
  Archive,
  ArchiveRestore,
  Award,
  BarChart3,
  Bath,
  Bed,
  Bike,
  BookOpen,
  Bookmark,
  Brain,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Code,
  Coffee,
  Compass,
  Crosshair,
  Diamond,
  DollarSign,
  Download,
  Droplet,
  Dumbbell,
  Eye,
  Feather,
  Flame,
  Flower2,
  Footprints,
  GraduationCap,
  Headphones,
  Heart,
  HeartHandshake,
  Hexagon,
  Home,
  Key,
  Laptop,
  Layers,
  Leaf,
  Lightbulb,
  Mail,
  MapPin,
  Minus,
  MoreHorizontal,
  Moon,
  Music,
  Package,
  Palette,
  Pencil,
  PenTool,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Smile,
  Sparkle,
  Sparkles,
  Square,
  Star,
  Sun,
  Target,
  Timer,
  Trash2,
  Trees,
  Triangle,
  Trophy,
  Upload,
  Utensils,
  Wind,
  X,
  Zap,
} from 'lucide-react'

type DailyRecord = {
  done: boolean
  progress: number
}

type PersistedData = {
  schemaVersion: 1
  habits: Habit[]
  settings: {
    dark: boolean
    weekStart: string
    reminderTime: string
    remindersOn: boolean
    showStreak: boolean
    showActivity: boolean
    completionGoal: number
    userName: string
    avatarColor: string
    categories: string[]
  }
  activePage: string
  exportedAt?: string
}

type BackupInfo = { filename: string; size: number; createdAt: string }

type Habit = {
  id: number
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
  schedule?: Schedule
  archived?: boolean
  logs?: Record<string, DailyRecord>
}

interface ActivityCellData {
  level: number
  count: number
  maxHabits: number
  isToday: boolean
  isFuture: boolean
  dayName: string
  fullDate: string
  label: string
  percentage: number
}

type IconCategory = 'all' | 'fitness' | 'mind' | 'wellness' | 'daily' | 'aesthetic'

interface HabitIconDef {
  id: string
  name: string
  cat: IconCategory
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
}

const HABIT_ICONS_CONFIG: HabitIconDef[] = [
  // Fitness / Movement
  { id: 'dumbbell', name: 'Dumbbell', cat: 'fitness', icon: Dumbbell },
  { id: 'footprints', name: 'Steps / Walk', cat: 'fitness', icon: Footprints },
  { id: 'activity', name: 'Cardio', cat: 'fitness', icon: Activity },
  { id: 'heart', name: 'Heart health', cat: 'fitness', icon: Heart },
  { id: 'bike', name: 'Cycling', cat: 'fitness', icon: Bike },
  { id: 'droplet', name: 'Hydration', cat: 'fitness', icon: Droplet },
  { id: 'apple', name: 'Nutrition', cat: 'fitness', icon: Apple },
  { id: 'utensils', name: 'Healthy meals', cat: 'fitness', icon: Utensils },
  { id: 'flame', name: 'Workouts', cat: 'fitness', icon: Flame },
  { id: 'timer', name: 'Intervals', cat: 'fitness', icon: Timer },
  { id: 'zap', name: 'High intensity', cat: 'fitness', icon: Zap },
  { id: 'wind', name: 'Breathwork', cat: 'fitness', icon: Wind },
  { id: 'trophy', name: 'Goals & PRs', cat: 'fitness', icon: Trophy },

  // Mind / Focus / Growth
  { id: 'book-open', name: 'Reading', cat: 'mind', icon: BookOpen },
  { id: 'pen-tool', name: 'Journaling', cat: 'mind', icon: PenTool },
  { id: 'brain', name: 'Mind & Focus', cat: 'mind', icon: Brain },
  { id: 'lightbulb', name: 'Ideas & Learn', cat: 'mind', icon: Lightbulb },
  { id: 'target', name: 'Deep focus', cat: 'mind', icon: Target },
  { id: 'clock', name: 'Pomodoro', cat: 'mind', icon: Clock },
  { id: 'laptop', name: 'Deep work', cat: 'mind', icon: Laptop },
  { id: 'code', name: 'Coding', cat: 'mind', icon: Code },
  { id: 'palette', name: 'Creativity', cat: 'mind', icon: Palette },
  { id: 'music', name: 'Music practice', cat: 'mind', icon: Music },
  { id: 'headphones', name: 'Audio & Podcasts', cat: 'mind', icon: Headphones },
  { id: 'graduation-cap', name: 'Study & Course', cat: 'mind', icon: GraduationCap },
  { id: 'compass', name: 'Strategy', cat: 'mind', icon: Compass },
  { id: 'search', name: 'Research', cat: 'mind', icon: Search },

  // Wellness / Rest / Self-Care
  { id: 'moon', name: 'Night routine', cat: 'wellness', icon: Moon },
  { id: 'sun', name: 'Morning sun', cat: 'wellness', icon: Sun },
  { id: 'bed', name: 'Sleep hygiene', cat: 'wellness', icon: Bed },
  { id: 'bath', name: 'Relaxation', cat: 'wellness', icon: Bath },
  { id: 'coffee', name: 'Coffee / Tea', cat: 'wellness', icon: Coffee },
  { id: 'smile', name: 'Mood & Gratitude', cat: 'wellness', icon: Smile },
  { id: 'feather', name: 'Meditation', cat: 'wellness', icon: Feather },
  { id: 'leaf', name: 'Nature & Fresh air', cat: 'wellness', icon: Leaf },
  { id: 'sparkles', name: 'Self care', cat: 'wellness', icon: Sparkles },
  { id: 'eye', name: 'Mindfulness', cat: 'wellness', icon: Eye },
  { id: 'shield-check', name: 'Immunity & Health', cat: 'wellness', icon: ShieldCheck },
  { id: 'heart-handshake', name: 'Kindness', cat: 'wellness', icon: HeartHandshake },

  // Daily / Routines
  { id: 'check-circle-2', name: 'Tasks & To-dos', cat: 'daily', icon: CheckCircle2 },
  { id: 'calendar', name: 'Plan the day', cat: 'daily', icon: Calendar },
  { id: 'alarm-clock', name: 'Early wake', cat: 'daily', icon: AlarmClock },
  { id: 'home', name: 'Tidy space', cat: 'daily', icon: Home },
  { id: 'mail', name: 'Inbox zero', cat: 'daily', icon: Mail },
  { id: 'dollar-sign', name: 'Budget & Finance', cat: 'daily', icon: DollarSign },
  { id: 'phone', name: 'Call family', cat: 'daily', icon: Phone },
  { id: 'package', name: 'Declutter', cat: 'daily', icon: Package },
  { id: 'key', name: 'Discipline', cat: 'daily', icon: Key },
  { id: 'layers', name: 'Habit stacking', cat: 'daily', icon: Layers },
  { id: 'bookmark', name: 'Reading log', cat: 'daily', icon: Bookmark },
  { id: 'trash-2', name: 'Clean up', cat: 'daily', icon: Trash2 },

  // Aesthetic / Geometry Symbols
  { id: 'circle', name: 'Circle', cat: 'aesthetic', icon: Circle },
  { id: 'square', name: 'Square', cat: 'aesthetic', icon: Square },
  { id: 'triangle', name: 'Triangle', cat: 'aesthetic', icon: Triangle },
  { id: 'hexagon', name: 'Hexagon', cat: 'aesthetic', icon: Hexagon },
  { id: 'star', name: 'Star', cat: 'aesthetic', icon: Star },
  { id: 'diamond', name: 'Diamond', cat: 'aesthetic', icon: Diamond },
  { id: 'crosshair', name: 'Target aim', cat: 'aesthetic', icon: Crosshair },
  { id: 'sparkle', name: 'Sparkle dot', cat: 'aesthetic', icon: Sparkle },
  { id: 'award', name: 'Milestone', cat: 'aesthetic', icon: Award },
  { id: 'map-pin', name: 'Location', cat: 'aesthetic', icon: MapPin },
  { id: 'flower-2', name: 'Bloom', cat: 'aesthetic', icon: Flower2 },
  { id: 'trees', name: 'Forest walk', cat: 'aesthetic', icon: Trees },
]

const ICON_LOOKUP: Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {}
HABIT_ICONS_CONFIG.forEach(item => {
  ICON_LOOKUP[item.id] = item.icon
})

const LEGACY_ICON_MAP: Record<string, string> = {
  '◒': 'dumbbell',
  '▤': 'book-open',
  '⌁': 'droplet',
  '✦': 'sparkles',
  '🏃': 'footprints',
  '🚶': 'footprints',
  '🧘': 'feather',
  '🚴': 'bike',
  '🏊': 'droplet',
  '🏋️': 'dumbbell',
  '🤸': 'activity',
  '👟': 'footprints',
  '🥊': 'flame',
  '⚽': 'activity',
  '🎾': 'activity',
  '🫀': 'heart',
  '💧': 'droplet',
  '🥗': 'utensils',
  '🥑': 'apple',
  '📖': 'book-open',
  '✍️': 'pen-tool',
  '🧠': 'brain',
  '💡': 'lightbulb',
  '🎯': 'target',
  '⏱️': 'timer',
  '📝': 'pen-tool',
  '💻': 'laptop',
  '🎨': 'palette',
  '🎸': 'music',
  '🎹': 'music',
  '🎧': 'headphones',
  '🌙': 'moon',
  '🛌': 'bed',
  '☀️': 'sun',
  '🌅': 'sun',
  '🛀': 'bath',
  '🍵': 'coffee',
  '☕': 'coffee',
  '✨': 'sparkles',
  '⏰': 'alarm-clock',
  '🗓️': 'calendar',
  '🧹': 'trash-2',
  '🪴': 'leaf',
  '🍳': 'utensils',
  '🍎': 'apple',
  '💰': 'dollar-sign',
  '📦': 'package',
  '✉️': 'mail',
  '📞': 'phone',
}

function HabitIcon({ name, size = 18 }: { name: string; size?: number }) {
  const resolvedId = LEGACY_ICON_MAP[name] || name
  const IconComponent = ICON_LOOKUP[resolvedId]
  if (IconComponent) {
    return <IconComponent size={size} strokeWidth={2.2} />
  }
  return <span style={{ fontSize: size, lineHeight: 1 }}>{name}</span>
}

const HABIT_COLORS = [
  { name: 'Sage Pine', hex: '#7b8d3c' },
  { name: 'Mint Emerald', hex: '#00a88f' },
  { name: 'Forest Green', hex: '#2f8f46' },
  { name: 'Teal Ocean', hex: '#087f91' },
  { name: 'Nordic Slate', hex: '#5a77a8' },
  { name: 'Sky Blue', hex: '#3b82f6' },
  { name: 'Indigo Deep', hex: '#4f46e5' },
  { name: 'Heather Lilac', hex: '#9b6db0' },
  { name: 'Royal Plum', hex: '#7c3aed' },
  { name: 'Dusty Rose', hex: '#c75d7b' },
  { name: 'Coral Red', hex: '#e05555' },
  { name: 'Terracotta', hex: '#d96b45' },
  { name: 'Amber Rust', hex: '#c2612d' },
  { name: 'Warm Ochre', hex: '#d49a3d' },
  { name: 'Golden Sun', hex: '#eab308' },
  { name: 'Charcoal', hex: '#4e655d' },
]

function getDateKey(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, '0')
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function supportsNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

function getHabitSchedule(habit: Habit): Schedule {
  const firstLogDate = Object.keys(habit.logs ?? {}).sort()[0] ?? getDateKey(new Date())
  return normalizeSchedule(habit.schedule, habit.detail, firstLogDate)
}

function isHabitScheduledForDate(habit: Habit, dateKey: string): boolean {
  return isScheduledDate(getHabitSchedule(habit), dateKey)
}

function getHabitScheduleUnit(habit: Habit, count: number): string {
  const schedule = getHabitSchedule(habit)
  if (schedule.unit === 'day' && schedule.interval === 1) return count === 1 ? 'day' : 'days'
  return count === 1 ? 'scheduled check-in' : 'scheduled check-ins'
}

function getHabitStreakStats(habit: Habit, todayKey: string) {
  return getScheduleStreakStats(getHabitSchedule(habit), habit.logs ?? {}, todayKey)
}

function getHabitDailyRecord(h: Habit, dateKey: string): DailyRecord {
  return h.logs?.[dateKey] ?? { done: false, progress: 0 }
}

function getHabitSubtitleForDate(h: Habit, record: DailyRecord): string {
  if (h.target > 1) {
    const base = h.detail.replace(/\s*·\s*\d+\s+of\s+\d+/i, '').trim()
    return `${base} · ${record.progress} of ${h.target}`
  }
  return h.detail
}

function replaceCategoryInDetail(detail: string, oldCategory: string, newCategory: string): string {
  const parts = detail.split('·').map(part => part.trim())
  const last = parts.length - 1
  if (parts[last]?.toLocaleLowerCase() === oldCategory.toLocaleLowerCase()) {
    parts[last] = newCategory
    return parts.join(' · ')
  }
  return detail
}

function ScheduleEditor({
  prefix,
  schedule,
  dark,
  onChange,
}: {
  prefix: string
  schedule: Schedule
  dark: boolean
  onChange: (schedule: Schedule) => void
}) {
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [monthPickerPosition, setMonthPickerPosition] = useState({ top: 12, left: 12 })
  const monthPickerTriggerRef = useRef<HTMLButtonElement>(null)
  const monthPickerPopoverRef = useRef<HTMLDivElement>(null)
  const summaryRef = useRef<HTMLSpanElement>(null)
  const [summaryOverflows, setSummaryOverflows] = useState(false)
  const compactSummary = formatScheduleSummary(schedule, false)
  const summary = schedule.unit === 'day' && schedule.interval === 1
    ? `${compactSummary} · Monday through Sunday`
    : compactSummary

  useLayoutEffect(() => {
    const element = summaryRef.current
    if (!element) return
    const updateOverflow = () => setSummaryOverflows(element.scrollWidth > element.clientWidth + 1)
    updateOverflow()
    const observer = new ResizeObserver(updateOverflow)
    observer.observe(element)
    return () => observer.disconnect()
  }, [summary])
  const weekdays = [
    { value: 1, short: 'M', name: 'Monday' },
    { value: 2, short: 'T', name: 'Tuesday' },
    { value: 3, short: 'W', name: 'Wednesday' },
    { value: 4, short: 'T', name: 'Thursday' },
    { value: 5, short: 'F', name: 'Friday' },
    { value: 6, short: 'S', name: 'Saturday' },
    { value: 0, short: 'S', name: 'Sunday' },
  ]
  const makePreset = (unit: Schedule['unit'], days?: number[]) => onChange(normalizeSchedule({
    ...schedule,
    unit,
    interval: 1,
    weekdays: days ?? schedule.weekdays,
    monthMode: 'dates',
    monthDays: schedule.monthDays.length ? schedule.monthDays : [Number(schedule.startDate.slice(-2))],
  }))
  const isSelectedPreset = (unit: Schedule['unit'], days?: number[]) =>
    schedule.unit === unit && schedule.interval === 1 && (!days || (schedule.weekdays.length === days.length && days.every(day => schedule.weekdays.includes(day))))
  const updateUnit = (unit: Schedule['unit']) => {
    const start = new Date(`${schedule.startDate}T12:00:00`)
    const next = { ...schedule, unit }
    if (unit === 'week' && !next.weekdays.length) next.weekdays = [start.getDay()]
    if (unit === 'month' && schedule.unit !== 'month') next.monthDays = [start.getDate()]
    onChange(normalizeSchedule(next))
  }
  const toggleWeekday = (value: number) => {
    const weekdays = schedule.weekdays.includes(value)
      ? schedule.weekdays.filter(day => day !== value)
      : [...schedule.weekdays, value]
    if (weekdays.length) onChange(normalizeSchedule({ ...schedule, weekdays }))
  }
  const toggleMonthDay = (value: number) => {
    const monthDays = schedule.monthDays.includes(value)
      ? schedule.monthDays.filter(day => day !== value)
      : [...schedule.monthDays, value]
    if (monthDays.length) onChange(normalizeSchedule({ ...schedule, monthDays }))
  }

  const openMonthPicker = () => {
    const anchor = monthPickerTriggerRef.current?.getBoundingClientRect()
    if (!anchor) return
    const width = Math.min(320, window.innerWidth - 24)
    const left = Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12))
    setMonthPickerPosition({ top: Math.min(anchor.bottom + 8, window.innerHeight - 320), left })
    setMonthPickerOpen(true)
  }

  useLayoutEffect(() => {
    if (!monthPickerOpen) return
    const anchor = monthPickerTriggerRef.current?.getBoundingClientRect()
    const popover = monthPickerPopoverRef.current
    if (!anchor || !popover) return
    const { width, height } = popover.getBoundingClientRect()
    const left = Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12))
    const below = window.innerHeight - anchor.bottom - 12
    const top = height <= below ? anchor.bottom + 8 : Math.max(12, anchor.top - height - 8)
    setMonthPickerPosition(previous => previous.top === top && previous.left === left ? previous : { top, left })
  }, [monthPickerOpen])

  useEffect(() => {
    if (!monthPickerOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (monthPickerTriggerRef.current?.contains(target) || monthPickerPopoverRef.current?.contains(target)) return
      setMonthPickerOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMonthPickerOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [monthPickerOpen])

  useEffect(() => {
    if (schedule.unit !== 'month' || schedule.monthMode !== 'dates') setMonthPickerOpen(false)
  }, [schedule.unit, schedule.monthMode])

  const monthPickerPopover = monthPickerOpen && createPortal(
    <div
      ref={monthPickerPopoverRef}
      className={`schedule-month-popover${dark ? ' is-dark' : ''}`}
      role="dialog"
      aria-label="Choose dates of the month"
      style={{ top: monthPickerPosition.top, left: monthPickerPosition.left }}
    >
      <div className="schedule-month-days" role="group" aria-label="Dates of the month">
        {Array.from({ length: 31 }, (_, index) => index + 1).map(day => (
          <button
            type="button"
            key={day}
            className={`schedule-month-day${schedule.monthDays.includes(day) ? ' selected' : ''}`}
            aria-pressed={schedule.monthDays.includes(day)}
            aria-label={`${day}${day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'} day of the month`}
            onClick={() => toggleMonthDay(day)}
          >{day}</button>
        ))}
        <button
          type="button"
          className={`schedule-month-day schedule-last-day${schedule.monthDays.includes(0) ? ' selected' : ''}`}
          aria-pressed={schedule.monthDays.includes(0)}
          aria-label="Last day of the month"
          onClick={() => toggleMonthDay(0)}
        >Last</button>
      </div>
      <small className="form-field-help">A selected date is skipped in shorter months if it does not exist.</small>
    </div>,
    document.body,
  )

  return (
    <>
    <section className="schedule-editor" aria-label="Habit frequency">
      <div className="schedule-editor-heading">
        <span className="form-field-label">Quick schedules</span>
        <span ref={summaryRef} className={`schedule-editor-summary${summaryOverflows ? ' is-overflowing' : ''}`} aria-live="polite">{summary}</span>
      </div>
      <div className="schedule-presets" role="group" aria-label="Common schedules">
        {[
          { label: 'Every day', unit: 'day' as const },
          { label: 'Weekdays', unit: 'week' as const, days: [1, 2, 3, 4, 5] },
          { label: 'Weekends', unit: 'week' as const, days: [0, 6] },
          { label: 'Mon · Wed · Fri', unit: 'week' as const, days: [1, 3, 5] },
          { label: 'Tue · Thu · Sat', unit: 'week' as const, days: [2, 4, 6] },
        ].map(preset => (
          <button
            type="button"
            key={preset.label}
            className={`schedule-preset${isSelectedPreset(preset.unit, preset.days) ? ' selected' : ''}`}
            aria-pressed={isSelectedPreset(preset.unit, preset.days)}
            onClick={() => makePreset(preset.unit, preset.days)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="schedule-rule">
        <span className="schedule-rule-label">Repeat every</span>
        <input
          id={`${prefix}-interval`}
          aria-label="Repeat interval"
          type="number"
          min={1}
          max={365}
          step={1}
          value={schedule.interval}
          onChange={event => {
            const interval = Number(event.target.value)
            if (Number.isInteger(interval) && interval >= 1 && interval <= 365) onChange(normalizeSchedule({ ...schedule, interval }))
          }}
        />
        <div className="schedule-unit-picker" role="group" aria-label="Repeat unit">
          {(['day', 'week', 'month'] as const).map(unit => (
            <button
              type="button"
              key={unit}
              className={`schedule-unit-button${schedule.unit === unit ? ' selected' : ''}`}
              aria-pressed={schedule.unit === unit}
              onClick={() => updateUnit(unit)}
            >
              {unit}{schedule.interval === 1 ? '' : 's'}
            </button>
          ))}
        </div>
      </div>

      {schedule.unit === 'week' && (
        <div className="schedule-subsection">
          <div className="schedule-day-picker" role="group" aria-label="Days of the week">
            {weekdays.map(day => (
              <button
                type="button"
                key={day.value}
                className={`schedule-day-button${schedule.weekdays.includes(day.value) ? ' selected' : ''}`}
                aria-label={day.name}
                aria-pressed={schedule.weekdays.includes(day.value)}
                title={day.name}
                onClick={() => toggleWeekday(day.value)}
              >
                {day.short}
              </button>
            ))}
          </div>
        </div>
      )}

      {schedule.unit === 'month' && (
        <div className="schedule-subsection">
          <span className="form-field-label">Repeat by</span>
          <div className="schedule-mode-picker" role="group" aria-label="Monthly pattern type">
            <button type="button" className={schedule.monthMode === 'dates' ? 'selected' : ''} aria-pressed={schedule.monthMode === 'dates'} onClick={() => onChange(normalizeSchedule({ ...schedule, monthMode: 'dates' }))}>Dates</button>
            <button type="button" className={schedule.monthMode === 'weekday' ? 'selected' : ''} aria-pressed={schedule.monthMode === 'weekday'} onClick={() => onChange(normalizeSchedule({ ...schedule, monthMode: 'weekday' }))}>Weekday pattern</button>
          </div>
          {schedule.monthMode === 'dates' ? (
            <div className="schedule-month-picker">
              <button
                ref={monthPickerTriggerRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={monthPickerOpen}
                onClick={() => monthPickerOpen ? setMonthPickerOpen(false) : openMonthPicker()}
              >
                <span>On these dates</span>
                <span className="schedule-month-selection">{schedule.monthDays.length} selected</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="schedule-monthly-weekday">
              <label htmlFor={`${prefix}-ordinal`}>The</label>
              <select id={`${prefix}-ordinal`} value={schedule.monthOrdinal} onChange={event => onChange(normalizeSchedule({ ...schedule, monthOrdinal: event.target.value as Schedule['monthOrdinal'] }))}>
                <option value="first">first</option>
                <option value="second">second</option>
                <option value="third">third</option>
                <option value="fourth">fourth</option>
                <option value="last">last</option>
              </select>
              <select aria-label="Weekday in monthly pattern" value={schedule.monthWeekday} onChange={event => onChange(normalizeSchedule({ ...schedule, monthWeekday: Number(event.target.value) }))}>
                {weekdays.map(day => <option key={day.value} value={day.value}>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.value]}</option>)}
              </select>
              <span>of the month</span>
            </div>
          )}
        </div>
      )}

      <div className="schedule-end-section">
        <div className="schedule-date-grid">
          <div className="form-field">
            <label className="form-field-label" htmlFor={`${prefix}-starts`}>Starts on</label>
            <input id={`${prefix}-starts`} type="date" min="1900-01-01" max="9999-12-31" value={schedule.startDate} onChange={event => {
              if (!event.target.value) return
              const endDate = schedule.endDate && schedule.endDate < event.target.value ? event.target.value : schedule.endDate
              onChange(normalizeSchedule({ ...schedule, startDate: event.target.value, endDate }))
            }} />
          </div>
          <div className="form-field">
            <label className="form-field-label" htmlFor={schedule.endMode === 'on' ? `${prefix}-ends-on` : `${prefix}-ends`}>Ends</label>
            <div className={`schedule-ends-control${schedule.endMode === 'after' ? ' has-count' : ''}${schedule.endMode === 'on' ? ' has-date' : ''}`}>
              {schedule.endMode === 'on' ? (
                <>
                  <input id={`${prefix}-ends-on`} type="date" min={schedule.startDate} max="9999-12-31" value={schedule.endDate ?? schedule.startDate} onChange={event => {
                    if (event.target.value >= schedule.startDate) onChange(normalizeSchedule({ ...schedule, endDate: event.target.value }))
                  }} />
                  <select id={`${prefix}-ends`} aria-label="End condition" value={schedule.endMode} onChange={event => onChange(normalizeSchedule({ ...schedule, endMode: event.target.value as Schedule['endMode'], endDate: event.target.value === 'on' ? (schedule.endDate && schedule.endDate >= schedule.startDate ? schedule.endDate : schedule.startDate) : null }))}>
                    <option value="never">Never</option>
                    <option value="on">On a date</option>
                    <option value="after">After a number of times</option>
                  </select>
                </>
              ) : (
                <>
                  <select id={`${prefix}-ends`} value={schedule.endMode} onChange={event => onChange(normalizeSchedule({ ...schedule, endMode: event.target.value as Schedule['endMode'], endDate: event.target.value === 'on' ? (schedule.endDate && schedule.endDate >= schedule.startDate ? schedule.endDate : schedule.startDate) : null }))}>
                    <option value="never">Never</option>
                    <option value="on">On a date</option>
                    <option value="after">After a number of times</option>
                  </select>
                  {schedule.endMode === 'after' && (
                <input
                  id={`${prefix}-occurrences`}
                  aria-label="Number of scheduled check-ins"
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  value={schedule.endAfter}
                  onChange={event => {
                    const endAfter = Number(event.target.value)
                    if (Number.isInteger(endAfter) && endAfter >= 1 && endAfter <= 10000) onChange(normalizeSchedule({ ...schedule, endAfter }))
                  }}
                />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
    {monthPickerPopover}
    </>
  )
}

const nav = [
  { label: 'Today', icon: CalendarDays },
  { label: 'Habits', icon: Target },
  { label: 'Stats', icon: BarChart3 },
  { label: 'Settings', icon: Settings },
]

function Heatmap({ logs, color, todayKey }: { logs?: Record<string, DailyRecord>; color: string; todayKey: string }) {
  const today = new Date(`${todayKey}T12:00:00`)
  const history = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (27 - index))
    const record = logs?.[getDateKey(date)]
    return record && (record.done || record.progress > 0) ? 1 : 0
  })
  return (
    <div className="heatmap" aria-label="Habit activity over the last 4 weeks">
      {history.map((value, index) => (
        <span
          key={index}
          style={{ background: value ? color : undefined, opacity: value ? 0.35 + (index % 4) * 0.16 : undefined }}
        />
      ))}
    </div>
  )
}

type HabitEditorDialogProps = {
  mode: 'create' | 'edit'
  dark: boolean
  name: string
  onNameChange: (value: string) => void
  target: number
  onTargetChange: (value: number) => void
  category: string
  onCategoryChange: (value: string) => void
  categories: string[]
  schedule: Schedule
  onScheduleChange: (value: Schedule) => void
  icon: string
  onIconChange: (value: string) => void
  color: string
  onColorChange: (value: string) => void
  onClose: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

function HabitEditorDialog({
  mode,
  dark,
  name,
  onNameChange,
  target,
  onTargetChange,
  category,
  onCategoryChange,
  categories,
  schedule,
  onScheduleChange,
  icon,
  onIconChange,
  color,
  onColorChange,
  onClose,
  onSubmit,
}: HabitEditorDialogProps) {
  const isEdit = mode === 'edit'
  const formId = `habit-editor-${mode}-form`
  const titleId = `habit-editor-${mode}-title`
  const appearanceTitleId = `habit-editor-${mode}-appearance-title`
  const nameId = `habit-editor-${mode}-name`
  const schedulePrefix = `habit-editor-${mode}-schedule`

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop habit-editor-backdrop" onClick={onClose}>
      <div className="modal habit-editor-layout" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event => event.stopPropagation()}>
        <section className="habit-editor-modal" aria-labelledby={titleId}>
          <header className="habit-editor-header">
            <div>
              <h2 id={titleId}>{isEdit ? 'Shape your routine' : 'Build a new routine'}</h2>
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close habit editor">
              <X size={17} />
            </button>
          </header>

          <form id={formId} className="habit-editor-form" onSubmit={onSubmit}>
            <div className="habit-editor-body">
              <section className="habit-editor-details" aria-label="Habit details">
                <div className="form-field habit-name-field">
                  <label className="form-field-label" htmlFor={nameId}>Habit name</label>
                  <input
                    id={nameId}
                    type="text"
                    value={name}
                    onChange={event => onNameChange(event.target.value)}
                    placeholder="e.g. Morning run, Read 20 pages"
                    maxLength={60}
                    required
                  />
                </div>
                <div className="habit-editor-detail-row">
                  <div className="form-field">
                    <label className="form-field-label" htmlFor={`${formId}-target`}>Goal per check-in</label>
                    <input
                      id={`${formId}-target`}
                      type="number"
                      min={1}
                      max={999}
                      step={1}
                      value={target}
                      onChange={event => onTargetChange(Math.max(1, Number(event.target.value) || 1))}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-field-label" htmlFor={`${formId}-category`}>Category</label>
                    <select id={`${formId}-category`} value={category} onChange={event => onCategoryChange(event.target.value)}>
                      {categories.map(item => <option value={item} key={item}>{item}</option>)}
                    </select>
                  </div>
                </div>
                <p className="habit-editor-note">{isEdit ? 'Your logged progress stays safe when you adjust the goal.' : 'Use a goal of 1 for a simple check-in.'}</p>
              </section>

              <ScheduleEditor prefix={schedulePrefix} schedule={schedule} dark={dark} onChange={onScheduleChange} />

            </div>

            <footer className="habit-editor-footer">
              <button type="button" className="outline-button" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary-button">
                {isEdit ? 'Save changes' : 'Create habit'}
              </button>
            </footer>
          </form>
        </section>

        <aside className="habit-appearance-modal" aria-labelledby={appearanceTitleId}>
          <header className="habit-appearance-header">
            <h3 id={appearanceTitleId}>Choose your look</h3>
          </header>
          <div className="habit-appearance-body">
            <section className="habit-editor-color-section">
              <div className="habit-editor-section-heading">
                <span className="form-field-label">Accent color</span>
                <span className="habit-editor-choice-name">{HABIT_COLORS.find(item => item.hex === color)?.name ?? 'Custom'}</span>
              </div>
              <div className="color-swatches" role="group" aria-label="Choose an accent color">
                {HABIT_COLORS.map(item => (
                  <button
                    type="button"
                    key={item.hex}
                    className={`color-dot${color === item.hex ? ' selected' : ''}`}
                    style={{ background: item.hex }}
                    onClick={() => onColorChange(item.hex)}
                    title={item.name}
                    aria-label={item.name}
                    aria-pressed={color === item.hex}
                  >
                    {color === item.hex && <Check size={12} strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </section>

            <section className="habit-editor-icon-section">
              <div className="habit-editor-section-heading">
                <span className="form-field-label">Choose an icon</span>
                <span className="habit-editor-choice-name">{HABIT_ICONS_CONFIG.find(item => item.id === icon)?.name ?? 'Selected icon'}</span>
              </div>
              <div className="icon-grid habit-editor-icon-grid" role="group" aria-label="Select habit icon">
                {HABIT_ICONS_CONFIG.map(item => {
                  const selected = icon === item.id
                  const IconComponent = item.icon
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`icon-btn${selected ? ' selected' : ''}`}
                      style={selected ? { borderColor: color, outlineColor: color, background: `${color}18`, color } : undefined}
                      onClick={() => onIconChange(item.id)}
                      title={item.name}
                      aria-label={item.name}
                      aria-pressed={selected}
                    >
                      <IconComponent size={18} strokeWidth={2} />
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  )
}

function getMonotoneSplinePath(points: { x: number; y: number }[]): { linePath: string; areaPath: string } {
  const n = points.length
  if (n < 2) return { linePath: '', areaPath: '' }

  const dxs: number[] = []
  const dys: number[] = []
  const slopes: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x
    const dy = points[i + 1].y - points[i].y
    dxs.push(dx)
    dys.push(dy)
    slopes.push(dy / (dx || 0.0001))
  }

  const m: number[] = [slopes[0]]
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      m.push(0)
    } else {
      m.push((slopes[i - 1] + slopes[i]) / 2)
    }
  }
  m.push(slopes[n - 2])

  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
    } else {
      const a = m[i] / slopes[i]
      const b = m[i + 1] / slopes[i]
      const h = Math.hypot(a, b)
      if (h > 3) {
        const t = 3 / h
        m[i] = t * a * slopes[i]
        m[i + 1] = t * b * slopes[i]
      }
    }
  }

  let linePath = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]
    const dx = dxs[i]
    const cp1x = p1.x + dx / 3
    const cp1y = p1.y + (m[i] * dx) / 3
    const cp2x = p2.x - dx / 3
    const cp2y = p2.y - (m[i + 1] * dx) / 3
    linePath += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }

  const areaPath = `${linePath} L 100,100 L 0,100 Z`
  return { linePath, areaPath }
}

function WeeklyAreaChart({ goal, habits, todayKey }: { goal: number; habits: Habit[]; todayKey: string }) {
  const [timeframe, setTimeframe] = useState<'7d' | '4w' | '3m'>('7d')
  const [viewMetric, setViewMetric] = useState<'percent' | 'count'>('percent')
  const [showTarget, setShowTarget] = useState(true)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const currentData = useMemo(() => {
    const bucketCount = timeframe === '7d' ? 7 : timeframe === '4w' ? 4 : 3
    const today = new Date(`${todayKey}T12:00:00`)
    const start = new Date(today)
    if (timeframe === '7d') start.setDate(today.getDate() - 6)
    else if (timeframe === '4w') start.setDate(today.getDate() - 27)
    else start.setDate(1), start.setMonth(today.getMonth() - 2)
    const points: { label: string; fullDate: string; percent: number; count: number; total: number; bucketIndex: number }[] = []
    let totalCheckIns = 0
    let totalRecords = 0

    for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex++) {
      const bucketStart = new Date(start)
      const bucketEnd = new Date(bucketStart)
      if (timeframe === '7d') {
        bucketStart.setDate(start.getDate() + bucketIndex)
        bucketEnd.setTime(bucketStart.getTime())
      } else if (timeframe === '4w') {
        bucketStart.setDate(start.getDate() + bucketIndex * 7)
        bucketEnd.setDate(bucketStart.getDate() + 6)
      } else {
        bucketStart.setMonth(start.getMonth() + bucketIndex)
        bucketEnd.setMonth(bucketStart.getMonth() + 1, 0)
      }
      if (bucketEnd > today) bucketEnd.setTime(today.getTime())
      let count = 0
      let total = 0

      for (const date = new Date(bucketStart); date <= bucketEnd; date.setDate(date.getDate() + 1)) {
        const dateKey = getDateKey(date)
        for (const habit of habits) {
          const record = habit.logs?.[dateKey]
          if (!record) continue
          total++
          if (record.done || record.progress >= habit.target) count++
        }
      }

      if (!total) continue
      const label = timeframe === '7d'
        ? bucketStart.toLocaleDateString(undefined, { weekday: 'short' })
        : timeframe === '4w'
        ? `W${bucketIndex + 1}`
        : bucketStart.toLocaleDateString(undefined, { month: 'short' })
      points.push({
        label,
        fullDate: timeframe === '7d'
          ? bucketStart.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
          : `${bucketStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${bucketEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
        percent: Math.round((count / total) * 100),
        count,
        total,
        bucketIndex,
      })
      totalCheckIns += count
      totalRecords += total
    }

    const bestPoint = points.reduce<(typeof points)[number] | null>((best, point) => !best || point.percent > best.percent ? point : best, null)
    return {
      title: timeframe === '7d' ? 'Past 7 days' : timeframe === '4w' ? 'Past 4 weeks' : 'Past 3 months',
      points,
      average: totalRecords ? `${Math.round((totalCheckIns / totalRecords) * 100)}%` : '—',
      best: bestPoint ? `${bestPoint.label} (${bestPoint.percent}%)` : '—',
      checkIns: totalCheckIns,
      totalRecords,
      hasData: totalRecords > 0,
      bucketCount,
    }
  }, [habits, timeframe, todayKey])
  const dataPoints = currentData.points

  const coords = useMemo(() => {
    const maxCount = Math.max(1, ...dataPoints.map(point => point.count))
    return dataPoints.map(p => {
      const val = viewMetric === 'percent' ? p.percent : p.count
      const normalized = viewMetric === 'percent' ? val : (val / maxCount) * 100
      const xPct = currentData.bucketCount > 1 ? (p.bucketIndex / (currentData.bucketCount - 1)) * 100 : 50
      const yPct = 100 - normalized
      return { ...p, val, normalized, xPct, yPct, x: xPct, y: yPct }
    })
  }, [dataPoints, viewMetric, currentData.bucketCount])

  const { linePath, areaPath } = useMemo(() => {
    return getMonotoneSplinePath(coords)
  }, [coords])

  const activePoint = hoveredIdx !== null && coords[hoveredIdx]?.total ? coords[hoveredIdx] : null

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const pct = Math.max(0, Math.min(100, (mouseX / rect.width) * 100))
    let closestIdx = 0
    let minDist = Infinity
    coords.forEach((p, idx) => {
      const dist = Math.abs(p.xPct - pct)
      if (dist < minDist) {
        minDist = dist
        closestIdx = idx
      }
    })
    setHoveredIdx(closestIdx)
  }

  const tooltipHorizontal =
    (activePoint?.xPct ?? 50) < 15 ? '0%' : (activePoint?.xPct ?? 50) > 85 ? '-100%' : '-50%'
  const tooltipVertical = (activePoint?.yPct ?? 50) < 24 ? '12px' : '-125%'
  const tooltipTransform = `translate(${tooltipHorizontal}, ${tooltipVertical})`

  return (
    <div className="chart-card">
      <div className="chart-header-row">
        <div>
          <h2>Completion trend</h2>
          <span>Consistency &amp; momentum over time</span>
        </div>
        {currentData.hasData && <div className="chart-actions-group">
          <div className="chart-mini-segmented">
            <button
              type="button"
              className={showTarget ? 'active' : ''}
              onClick={() => setShowTarget(!showTarget)}
              title={`${showTarget ? 'Hide' : 'Show'} goal reference line`}
              aria-label={`${showTarget ? 'Hide' : 'Show'} goal reference line`}
              aria-pressed={showTarget}
            >
              Goal line
            </button>
          </div>
          <div className="chart-mini-segmented">
            <button
              type="button"
              className={viewMetric === 'percent' ? 'active' : ''}
              onClick={() => setViewMetric('percent')}
              aria-pressed={viewMetric === 'percent'}
            >
              Rate %
            </button>
            <button
              type="button"
              className={viewMetric === 'count' ? 'active' : ''}
              onClick={() => setViewMetric('count')}
              aria-pressed={viewMetric === 'count'}
            >
              Check-ins
            </button>
          </div>
          <div className="chart-mini-segmented">
            <button
              type="button"
              className={timeframe === '7d' ? 'active' : ''}
              onClick={() => { setTimeframe('7d'); setHoveredIdx(null); }}
              aria-pressed={timeframe === '7d'}
            >
              7D
            </button>
            <button
              type="button"
              className={timeframe === '4w' ? 'active' : ''}
              onClick={() => { setTimeframe('4w'); setHoveredIdx(null); }}
              aria-pressed={timeframe === '4w'}
            >
              4W
            </button>
            <button
              type="button"
              className={timeframe === '3m' ? 'active' : ''}
              onClick={() => { setTimeframe('3m'); setHoveredIdx(null); }}
              aria-pressed={timeframe === '3m'}
            >
              3M
            </button>
          </div>
        </div>}
      </div>

      <div className="chart-summary-strip">
        {currentData.hasData ? <>
          <div className="chart-summary-item">
            <small>Average completion</small>
            <strong>{currentData.average}</strong>
          </div>
          <div className="chart-summary-item">
            <small>Best period</small>
            <strong>{currentData.best}</strong>
          </div>
          <div className="chart-summary-item">
            <small>Check-ins</small>
            <strong>{currentData.checkIns}</strong>
          </div>
          <div className="chart-summary-badge">
            <span>{activePoint
              ? `${activePoint.fullDate}: ${activePoint.count} completed from ${activePoint.total} logged updates`
              : `${currentData.totalRecords} logged habit updates in this period`}</span>
          </div>
        </> : <p className="chart-empty-state">No recorded check-ins in the {currentData.title.toLowerCase()}.</p>}
      </div>

      {currentData.hasData && <>
      <div className="chart-stage-wrapper">
        <div className="chart-main-row">
          <div className="chart-y-axis-col">
            {[1, .75, .5, .25, 0].map(fraction => {
              const maxCount = Math.max(1, ...coords.map(point => point.count))
              const axisValue = viewMetric === 'percent' ? Math.round(fraction * 100) : Math.round(fraction * maxCount)
              return <span key={fraction} className="chart-y-axis-label">{axisValue}{viewMetric === 'percent' ? '%' : ''}</span>
            })}
          </div>

          <div
            className="chart-stage-area"
            onMouseMove={handleStageMouseMove}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {/* Horizontal guide lines */}
            <div className="chart-grid-line" style={{ top: '0%' }} />
            <div className="chart-grid-line" style={{ top: '25%' }} />
            <div className="chart-grid-line" style={{ top: '50%' }} />
            <div className="chart-grid-line" style={{ top: '75%' }} />
            <div className="chart-grid-line" style={{ top: '100%' }} />

            {/* Completion goal line */}
            {showTarget && viewMetric === 'percent' && (
              <div className="chart-target-guide" style={{ top: `${100 - goal}%` }}>
                <span className="chart-target-badge">Goal {goal}%</span>
              </div>
            )}

            {/* Smooth SVG Area and Curve */}
            <svg
              className="chart-stage-svg"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <path d={areaPath} fill="var(--chart-fill)" />
              <path
                d={linePath}
                fill="none"
                stroke="var(--green)"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Tracker Line */}
            {activePoint && (
              <div
                className="chart-tracker-line"
                style={{ left: `${activePoint.xPct}%` }}
              />
            )}

            {/* Beacon & Halo on Active Point */}
            {activePoint && (
              <>
                <div
                  className="chart-beacon-glow"
                  style={{ left: `${activePoint.xPct}%`, top: `${activePoint.yPct}%` }}
                />
                <div
                  className="chart-beacon-center"
                  style={{ left: `${activePoint.xPct}%`, top: `${activePoint.yPct}%` }}
                />
              </>
            )}

            {/* HTML points stay circular when the chart resizes. */}
            {coords.map((p, idx) => (
              <div
                key={idx}
                className={`chart-point-dot ${hoveredIdx === idx ? 'active' : ''}`}
                style={{
                  left: `${p.xPct}%`,
                  top: `${p.yPct}%`,
                }}
              />
            ))}

            {/* Floating Tooltip with Edge Clamping */}
            {activePoint && (
              <div
                className="chart-floating-tooltip"
                style={{
                  left: `${activePoint.xPct}%`,
                  top: `${activePoint.yPct}%`,
                  transform: tooltipTransform,
                }}
              >
                <div className="chart-tooltip-bubble">
                  <div className="tooltip-top-row">
                    <strong>{activePoint.fullDate}</strong>
                  <span className={`tooltip-badge ${viewMetric === 'percent' && activePoint.val >= goal ? 'goal' : ''}`}>
                      {viewMetric === 'percent' ? activePoint.val >= goal ? 'Target achieved' : 'In progress' : 'Recorded'}
                    </span>
                  </div>
                  <div className="tooltip-stats-row">
                    <strong>{viewMetric === 'percent' ? `${activePoint.val}% completion` : `${activePoint.count} check-ins`}</strong>
                    <span>·</span>
                    <span>{activePoint.count} complete from {activePoint.total} logged updates</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Axis Row - Synchronized X-coordinates */}
        <div className="chart-bottom-axis-row">
          <div className="chart-y-axis-spacer" />
          <div className="chart-x-axis-track">
            {coords.map((p, idx) => {
              return (
                <button
                  type="button"
                  key={idx}
                  className={`chart-axis-btn ${hoveredIdx === idx ? 'active' : ''}`}
                  aria-label={`${p.fullDate}: ${viewMetric === 'percent' ? `${p.val}% completion` : `${p.count} check-ins`}, ${p.count} complete from ${p.total} logged updates`}
                  style={{
                    left: `${p.xPct}%`,
                  }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onFocus={() => setHoveredIdx(idx)}
                  onBlur={() => setHoveredIdx(null)}
                >
                  <span className="axis-btn-day">{p.label}</span>
                  <span className="axis-btn-val">{p.val}{viewMetric === 'percent' ? '%' : ''}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      </>}
    </div>
  )
}

const DEFAULT_HABIT_CATEGORIES = ['Body', 'Mind', 'Wellness', 'Home', 'Focus']
const PROFILE_COLORS = [
  { value: '#477a6b', label: 'Forest' },
  { value: '#5c78ab', label: 'Blue' },
  { value: '#9670aa', label: 'Lavender' },
  { value: '#d66a45', label: 'Terracotta' },
  { value: '#687884', label: 'Slate' },
]
type LegalDocumentKey = 'privacy' | 'terms' | 'data'
const LEGAL_DOCUMENTS: Record<LegalDocumentKey, { title: string; intro: string; sections: { heading: string; copy: string }[] }> = {
  privacy: {
    title: 'Privacy',
    intro: 'Daymark is designed for personal, local-first tracking. Your habits and preferences are stored in the project’s SQLite database rather than in a Daymark cloud account.',
    sections: [
      { heading: 'Information stored', copy: 'Daymark stores the information you choose to enter: habit names, goals, categories, schedules, check-ins, and progress history. It also saves app preferences such as your display name, accent color, theme, week start, reminder time, and dashboard options.' },
      { heading: 'Local processing and network access', copy: 'The app uses its local Node.js service to read and update the SQLite database on this device. The standard setup binds that service to 127.0.0.1. The current app does not use a Daymark account, hosted sync, advertising, analytics, or third-party data sharing. If you change the host or expose the service to a network, other devices with access to that network service may be able to reach it.' },
      { heading: 'Browser notifications', copy: 'If you enable reminders, Daymark asks your browser for notification permission and uses the browser’s notification feature at the time you choose. You can turn reminders off in Settings or revoke permission in your browser or operating system. Notification delivery is controlled by the browser and device.' },
      { heading: 'Retention and your choices', copy: 'Your records remain in the project database until you remove them. Settings lets you export application data, create or manage SQLite backups, import a file, and wipe the database. Wiping also removes the SQLite backups managed by Daymark; copies you previously exported or downloaded must be deleted separately.' },
      { heading: 'Security and access', copy: 'Daymark does not encrypt the SQLite database or backup files itself. Anyone who can access the project folder or your operating-system account may be able to access those files. Protect the device and project folder using your operating system’s account and disk-security controls, and keep separate backups of information you need.' },
    ],
  },
  terms: {
    title: 'Terms of use',
    intro: 'These terms describe the intended use and practical limits of Daymark, a locally run personal habit-tracking application.',
    sections: [
      { heading: 'Personal use and your content', copy: 'You may use Daymark to plan routines and record your own progress. You are responsible for the information you enter, the devices and files where it is stored, and ensuring that your use complies with applicable requirements. Do not use the app to store information you are not authorized to manage.' },
      { heading: 'No professional or emergency advice', copy: 'Daymark’s goals, reminders, streaks, and summaries are organizational tools. They are not medical, mental-health, fitness, legal, or other professional advice; they do not diagnose or treat a condition and are not a substitute for advice from a qualified professional. Do not rely on Daymark for urgent or emergency communications.' },
      { heading: 'Data, imports, and backups', copy: 'You are responsible for maintaining copies of information you want to preserve. An import replaces the current habits, progress, and settings after creating a SQLite backup. Restoring a backup replaces the current state after saving it as a backup. Review files before importing them and keep exported files secure.' },
      { heading: 'Availability and changes', copy: 'Daymark is provided as a self-managed application. Features may depend on your device, browser, operating system, and local configuration. Notification delivery, compatibility, uninterrupted operation, and recovery from file or device failure cannot be guaranteed. Keep the project and its data backed up before moving or updating it.' },
      { heading: 'Warranty and liability', copy: 'To the extent permitted by applicable law, Daymark is provided “as is” and without guarantees that it will be uninterrupted, error-free, or suitable for a particular purpose. Nothing in these terms limits rights or remedies that cannot lawfully be limited.' },
    ],
  },
  data: {
    title: 'Data & storage',
    intro: 'Daymark keeps its primary application data in a SQLite file within the project folder. The standard setup does not sync that data to a cloud service.',
    sections: [
      { heading: 'Storage locations', copy: 'The primary database is stored at data/database.sqlite relative to the project root. Daymark-managed SQLite backups are stored in data/backups/. JSON exports are downloaded by your browser to its configured download location; they are separate files and are not removed when you wipe the database.' },
      { heading: 'What the files contain', copy: 'The database stores habits, schedules, categories, progress and check-in history, and saved application preferences. SQLite backups are database snapshots. JSON exports contain the application state needed to import your habits and preferences, but are not a replacement for a full SQLite snapshot.' },
      { heading: 'Back up and restore', copy: 'Use Settings to create a SQLite backup or export JSON. Before an import or restore, Daymark creates a backup of the current database. Restoring replaces the current application state with the selected snapshot. Keep copies in a separate secure location; a backup on the same device may not survive device loss or disk failure.' },
      { heading: 'Move the project', copy: 'To move your data, stop Daymark first, then copy the project folder including data/database.sqlite. Copy data/backups/ as well if you want to bring Daymark-managed snapshots. Keep the database with the project root; production files under dist/ do not contain the primary database.' },
      { heading: 'Delete data and protect files', copy: 'The Wipe all data control in Settings removes saved habits, settings, progress, and Daymark-managed SQLite backups. It cannot remove JSON exports or copies you placed elsewhere. Database and backup files are not encrypted by Daymark, so protect them with your operating-system account and disk-security settings.' },
    ],
  },
}

function getInitialSettings() {
  return {
    dark: false,
    weekStart: 'Monday',
    reminderTime: '08:00',
    remindersOn: false,
    showStreak: true,
    showActivity: true,
    completionGoal: 80,
    userName: '',
    avatarColor: '#477a6b',
    categories: [...DEFAULT_HABIT_CATEGORIES],
  }
}

function App() {
  const initialSettings = useMemo(() => getInitialSettings(), [])
  const [active, setActive] = useState('Today')
  const [habits, setHabits] = useState<Habit[]>([])
  const [dateOffset, setDateOffset] = useState(0)
  const [dark, setDark] = useState<boolean>(initialSettings.dark)
  const [showAdd, setShowAdd] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showWipeConfirmation, setShowWipeConfirmation] = useState(false)
  const [habitDeleteTarget, setHabitDeleteTarget] = useState<Habit | null>(null)
  const [legalDocument, setLegalDocument] = useState<LegalDocumentKey | null>(null)
  const [categoryDraft, setCategoryDraft] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null)
  const [renameCategoryDraft, setRenameCategoryDraft] = useState('')
  const [categoryDeleteTarget, setCategoryDeleteTarget] = useState<string | null>(null)
  const [categoryReplacement, setCategoryReplacement] = useState('')
  const [categoryManageError, setCategoryManageError] = useState('')
  const [openHabitMenuId, setOpenHabitMenuId] = useState<number | null>(null)
  const [habitSearch, setHabitSearch] = useState('')
  const [habitCategoryFilter, setHabitCategoryFilter] = useState('All categories')
  const [hoveredCell, setHoveredCell] = useState<ActivityCellData | null>(null)
  const [todayDateKey, setTodayDateKey] = useState(() => getDateKey(new Date()))
  const mainScrollRef = useRef<HTMLElement>(null)
  const activityGridRef = useRef<HTMLDivElement>(null)
  const habitsRef = useRef<Habit[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const datePickerRef = useRef<HTMLInputElement>(null)

  // Settings States
  const [weekStart, setWeekStart] = useState(initialSettings.weekStart)
  const [reminderTime, setReminderTime] = useState(initialSettings.reminderTime)
  const [remindersOn, setRemindersOn] = useState(initialSettings.remindersOn)
  const [showStreak, setShowStreak] = useState(initialSettings.showStreak)
  const [showActivity, setShowActivity] = useState(initialSettings.showActivity)
  const [completionGoal, setCompletionGoal] = useState(initialSettings.completionGoal)
  const [userName, setUserName] = useState(initialSettings.userName)
  const [avatarColor, setAvatarColor] = useState(initialSettings.avatarColor)
  const [habitCategoryOptions, setHabitCategoryOptions] = useState<string[]>(initialSettings.categories)
  const [settingsToast, setSettingsToast] = useState('')
  const [databaseReady, setDatabaseReady] = useState(false)
  const [databaseError, setDatabaseError] = useState('')
  const [databaseBusy, setDatabaseBusy] = useState(false)
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const saveTimerRef = useRef<number | null>(null)

  // Edit Habit State
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('dumbbell')
  const [editColor, setEditColor] = useState('#477a6b')
  const [editSchedule, setEditSchedule] = useState<Schedule>(() => createDefaultSchedule(getDateKey(new Date())))
  const [editCategory, setEditCategory] = useState('Body')
  const [editTarget, setEditTarget] = useState(1)
  const habitMenuRef = useRef<HTMLDivElement>(null)

  const applyPersistedData = (data: PersistedData) => {
    setHabits(data.habits)
    setActive(data.activePage)
    setDark(data.settings.dark)
    setWeekStart(data.settings.weekStart)
    setReminderTime(data.settings.reminderTime)
    setRemindersOn(data.settings.remindersOn && 'Notification' in window && Notification.permission === 'granted')
    setShowStreak(data.settings.showStreak)
    setShowActivity(data.settings.showActivity)
    setCompletionGoal(data.settings.completionGoal)
    setUserName(data.settings.userName)
    setAvatarColor(data.settings.avatarColor)
    setHabitCategoryOptions(data.settings.categories)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [dataResponse, backupResponse] = await Promise.all([fetch('/api/data'), fetch('/api/backups')])
        const [data, backupResult] = await Promise.all([dataResponse.json(), backupResponse.json()])
        if (!dataResponse.ok) throw new Error(data.error || 'Could not open the local database.')
        if (!backupResponse.ok) throw new Error(backupResult.error || 'Could not load database backups.')
        if (cancelled) return
        applyPersistedData(data as PersistedData)
        setBackups(backupResult.backups)
        setDatabaseReady(true)
        setDatabaseError('')
      } catch (error) {
        if (cancelled) return
        setDatabaseError(error instanceof Error ? error.message : 'Could not open the local database.')
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!databaseReady) return
    const snapshot: PersistedData = {
      schemaVersion: 1,
      habits,
      settings: { dark, weekStart, reminderTime, remindersOn, showStreak, showActivity, completionGoal, userName, avatarColor, categories: habitCategoryOptions },
      activePage: active,
    }
    const timer = window.setTimeout(() => {
      saveTimerRef.current = null
      saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(async () => {
        try {
          const response = await fetch('/api/data', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(snapshot),
          })
          const result = await response.json()
          if (!response.ok) throw new Error(result.error || 'Could not save to the local database.')
          setDatabaseError('')
        } catch (error) {
          setDatabaseError(error instanceof Error ? error.message : 'Could not save to the local database.')
        }
      })
    }, 180)
    saveTimerRef.current = timer
    return () => {
      window.clearTimeout(timer)
      if (saveTimerRef.current === timer) saveTimerRef.current = null
    }
  }, [databaseReady, habits, active, dark, weekStart, reminderTime, remindersOn, showStreak, showActivity, completionGoal, userName, avatarColor, habitCategoryOptions])

  useEffect(() => {
    habitsRef.current = habits
  }, [habits])

  useEffect(() => {
    let midnightTimer = 0
    const refreshDate = () => {
      setTodayDateKey(getDateKey(new Date()))
      const now = new Date()
      const nextMidnight = new Date(now)
      nextMidnight.setHours(24, 0, 0, 50)
      midnightTimer = window.setTimeout(refreshDate, nextMidnight.getTime() - now.getTime())
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        window.clearTimeout(midnightTimer)
        refreshDate()
      }
    }
    refreshDate()
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearTimeout(midnightTimer)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [])

  useEffect(() => {
    setHabits(current => current.map(habit => {
      const todayRecord = habit.logs?.[todayDateKey]
      const done = todayRecord?.done ?? false
      const progress = todayRecord?.progress ?? 0
      return habit.done === done && habit.progress === progress ? habit : { ...habit, done, progress }
    }))
  }, [todayDateKey])

  // Sync the app theme with native controls and browser chrome.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#151718' : '#f4f6f2')
  }, [dark])

  // Modal accessibility (Escape key and scroll lock)
  useEffect(() => {
    const isModalOpen = showAdd || showArchiveModal || showCategoryModal || showWipeConfirmation || Boolean(habitDeleteTarget) || Boolean(editingHabit) || Boolean(legalDocument)
    if (isModalOpen) {
      const previousOverflow = document.body.style.overflow
      const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const dialog = document.querySelector<HTMLElement>('.modal-backdrop [role="dialog"]')
      const getFocusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []).filter(element => element.getClientRects().length > 0)
      const initialFocus = dialog?.querySelector<HTMLElement>('[autofocus]') ?? getFocusable()[0]
      initialFocus?.focus()
      document.body.style.overflow = 'hidden'
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowAdd(false)
          setShowArchiveModal(false)
          setShowCategoryModal(false)
          setShowWipeConfirmation(false)
          setHabitDeleteTarget(null)
          setEditingHabit(null)
          setLegalDocument(null)
          return
        }
        if (e.key !== 'Tab' || !dialog) return
        const focusable = getFocusable()
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!first || !last) {
          e.preventDefault()
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => {
        document.body.style.overflow = previousOverflow
        window.removeEventListener('keydown', handleKeyDown)
        if (previouslyFocused?.isConnected) previouslyFocused.focus()
      }
    } else {
      document.body.style.overflow = ''
    }
  }, [showAdd, showArchiveModal, showCategoryModal, showWipeConfirmation, habitDeleteTarget, editingHabit, legalDocument])

  useEffect(() => {
    if (openHabitMenuId === null) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!habitMenuRef.current?.contains(event.target as Node)) setOpenHabitMenuId(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenHabitMenuId(null)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [openHabitMenuId])

  const toggleDailyReminders = async () => {
    if (remindersOn) {
      setRemindersOn(false)
      setSettingsToast('Daily reminders turned off.')
      window.setTimeout(() => setSettingsToast(''), 3500)
      return
    }
    if (!supportsNotifications()) {
      setSettingsToast('This browser does not support reminder notifications.')
      window.setTimeout(() => setSettingsToast(''), 3500)
      return
    }
    let permission = Notification.permission
    if (permission === 'default') permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setSettingsToast(permission === 'denied' ? 'Allow notifications for Daymark in your browser settings to turn reminders on.' : 'Notification permission was not granted.')
      window.setTimeout(() => setSettingsToast(''), 4500)
      return
    }
    setRemindersOn(true)
    setSettingsToast('Daily browser reminders are on.')
    window.setTimeout(() => setSettingsToast(''), 3500)
  }

  useEffect(() => {
    if (!databaseReady || !remindersOn || !supportsNotifications() || Notification.permission !== 'granted') return
    let timer = 0
    const scheduleNextReminder = () => {
      const now = new Date()
      const [hour, minute] = reminderTime.split(':').map(Number)
      const reminderAt = new Date(now)
      reminderAt.setHours(hour, minute, 0, 0)
      if (reminderAt <= now) reminderAt.setDate(reminderAt.getDate() + 1)
      timer = window.setTimeout(() => {
        const dateKey = getDateKey(new Date())
        const pending = habitsRef.current.filter(habit => {
          if (habit.archived || !isHabitScheduledForDate(habit, dateKey)) return false
          const record = getHabitDailyRecord(habit, dateKey)
          return !record.done && record.progress < habit.target
        })
        if (pending.length) {
          try {
            new Notification('daymark', {
              body: `${pending.length} ${pending.length === 1 ? 'habit is' : 'habits are'} ready for today.`,
              icon: '/favicon.svg',
              tag: 'daymark-daily-reminder',
            })
          } catch {}
        }
        scheduleNextReminder()
      }, Math.max(0, reminderAt.getTime() - now.getTime()))
    }
    scheduleNextReminder()
    return () => window.clearTimeout(timer)
  }, [databaseReady, remindersOn, reminderTime])

  const flushCurrentState = async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const snapshot: PersistedData = {
      schemaVersion: 1,
      habits,
      settings: { dark, weekStart, reminderTime, remindersOn, showStreak, showActivity, completionGoal, userName, avatarColor, categories: habitCategoryOptions },
      activePage: active,
    }
    const saveOperation = saveQueueRef.current.catch(() => undefined).then(async () => {
      const response = await fetch('/api/data', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not save to the local database.')
      setDatabaseError('')
    }).catch(error => {
      setDatabaseError(error instanceof Error ? error.message : 'Could not save to the local database.')
      throw error
    })
    saveQueueRef.current = saveOperation
    await saveOperation
  }

  const handleExportData = async () => {
    setDatabaseBusy(true)
    try {
      await flushCurrentState()
      window.location.assign('/api/export')
      setSettingsToast('Daymark data exported.')
    } catch (error) {
      setSettingsToast(error instanceof Error ? error.message : 'Could not export Daymark data.')
    } finally {
      setDatabaseBusy(false)
      window.setTimeout(() => setSettingsToast(''), 3500)
    }
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('Import files cannot exceed 25 MB.')
      const imported = JSON.parse(await file.text()) as PersistedData
      if (!imported || imported.schemaVersion !== 1 || !Array.isArray(imported.habits) || !imported.settings) {
        throw new Error('Choose a Daymark JSON export with a supported schema version.')
      }
      if (!window.confirm(`Import ${imported.habits.length} habits and replace the current habits, progress, and settings? A SQLite backup will be created first.`)) return
      setDatabaseBusy(true)
      await flushCurrentState()
      const response = await fetch('/api/data/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(imported),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Import could not be saved.')
      applyPersistedData(result.state as PersistedData)
      setBackups(result.backups)
      setDatabaseError('')
      setSettingsToast('Daymark data imported successfully.')
    } catch (error) {
      try {
        const response = await fetch('/api/backups')
        const result = await response.json()
        if (response.ok) setBackups(result.backups)
      } catch {}
      setSettingsToast(error instanceof Error ? error.message : 'Could not import this file.')
    } finally {
      setDatabaseBusy(false)
      window.setTimeout(() => setSettingsToast(''), 4500)
    }
  }

  const createDatabaseBackup = async () => {
    setDatabaseBusy(true)
    try {
      await flushCurrentState()
      const response = await fetch('/api/backups', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not create a backup.')
      setBackups(result.backups)
      setSettingsToast('SQLite backup created.')
    } catch (error) {
      setSettingsToast(error instanceof Error ? error.message : 'Could not create a backup.')
    } finally {
      setDatabaseBusy(false)
      window.setTimeout(() => setSettingsToast(''), 3500)
    }
  }

  const restoreDatabaseBackup = async (backup: BackupInfo) => {
    if (!window.confirm(`Restore ${backup.filename}? Current data will be saved as a backup first.`)) return
    setDatabaseBusy(true)
    try {
      await flushCurrentState()
      const response = await fetch(`/api/backups/${encodeURIComponent(backup.filename)}/restore`, { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not restore this backup.')
      applyPersistedData(result.state as PersistedData)
      setBackups(result.backups)
      setDatabaseError('')
      setSettingsToast('SQLite backup restored.')
    } catch (error) {
      setSettingsToast(error instanceof Error ? error.message : 'Could not restore this backup.')
    } finally {
      setDatabaseBusy(false)
      window.setTimeout(() => setSettingsToast(''), 3500)
    }
  }

  const deleteDatabaseBackup = async (backup: BackupInfo) => {
    if (!window.confirm(`Permanently delete the backup ${backup.filename}?`)) return
    setDatabaseBusy(true)
    try {
      const response = await fetch(`/api/backups/${encodeURIComponent(backup.filename)}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not delete this backup.')
      setBackups(result.backups)
      setSettingsToast('Backup deleted.')
    } catch (error) {
      setSettingsToast(error instanceof Error ? error.message : 'Could not delete this backup.')
    } finally {
      setDatabaseBusy(false)
      window.setTimeout(() => setSettingsToast(''), 3500)
    }
  }

  const wipeApplicationData = async () => {
    if (databaseBusy) return
    setDatabaseBusy(true)
    try {
      await flushCurrentState()
      const response = await fetch('/api/data/wipe', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not wipe application data.')
      applyPersistedData(result.state as PersistedData)
      setBackups([])
      setDatabaseError('')
      setSettingsToast('All Daymark data has been removed.')
    } catch (error) {
      setSettingsToast(error instanceof Error ? error.message : 'Could not wipe application data.')
    } finally {
      setDatabaseBusy(false)
      window.setTimeout(() => setSettingsToast(''), 4000)
    }
  }

  // Add Habit Form States
  const [newHabitName, setNewHabitName] = useState('')
  const [newHabitSchedule, setNewHabitSchedule] = useState<Schedule>(() => createDefaultSchedule(getDateKey(new Date())))
  const [newHabitCategory, setNewHabitCategory] = useState('Body')
  const [newHabitTarget, setNewHabitTarget] = useState(1)
  const [selectedIcon, setSelectedIcon] = useState('dumbbell')
  const [selectedColor, setSelectedColor] = useState('#477a6b')
  const activeHabits = useMemo(() => habits.filter(h => !h.archived), [habits])
  const archivedHabits = useMemo(() => habits.filter(h => h.archived), [habits])
  const habitCategories = useMemo(() => [...new Set(activeHabits.map(h => h.category))].sort(), [activeHabits])
  const allHabitCategories = useMemo(() => {
    const categories = [...habitCategoryOptions, ...habits.map(habit => habit.category)]
    return [...new Set(categories.map(category => category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }, [habitCategoryOptions, habits])
  const visibleHabits = useMemo(() => {
    const query = habitSearch.trim().toLocaleLowerCase()
    return activeHabits.filter(h => {
      const matchesCategory = habitCategoryFilter === 'All categories' || h.category === habitCategoryFilter
      const matchesQuery = !query || `${h.name} ${h.category} ${h.detail}`.toLocaleLowerCase().includes(query)
      return matchesCategory && matchesQuery
    })
  }, [activeHabits, habitSearch, habitCategoryFilter])
  const appTodayDateKey = todayDateKey

  const todayDueHabits = useMemo(
    () => activeHabits.filter(habit => isHabitScheduledForDate(habit, appTodayDateKey)),
    [activeHabits, appTodayDateKey]
  )
  const streakStatsByHabit = useMemo(
    () => new Map(habits.map(habit => [habit.id, getHabitStreakStats(habit, appTodayDateKey)] as const)),
    [habits, appTodayDateKey]
  )
  const habitStreakStats = (habit: Habit) => streakStatsByHabit.get(habit.id) ?? { current: 0, best: 0 }

  const selectedDate = useMemo(() => {
    const base = new Date(`${todayDateKey}T12:00:00`)
    base.setDate(base.getDate() + dateOffset)
    return base
  }, [todayDateKey, dateOffset])

  const selectedDateKey = useMemo(() => getDateKey(selectedDate), [selectedDate])
  const isFutureDate = selectedDateKey > appTodayDateKey
  const isSelectedToday = dateOffset === 0
  const dueHabits = useMemo(
    () => activeHabits.filter(habit => isHabitScheduledForDate(habit, selectedDateKey)),
    [activeHabits, selectedDateKey]
  )
  const datePickerLabel = isSelectedToday
    ? 'Today'
    : selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  const openDatePicker = () => {
    const input = datePickerRef.current
    if (!input) return
    if ('showPicker' in input && typeof input.showPicker === 'function') input.showPicker()
    else input.click()
  }

  const selectDateFromPicker = (value: string) => {
    if (!value) return
    const [year, month, day] = value.split('-').map(Number)
    const pickedDay = Date.UTC(year, month - 1, day)
    const [todayYear, todayMonth, todayDate] = todayDateKey.split('-').map(Number)
    const baseDay = Date.UTC(todayYear, todayMonth - 1, todayDate)
    setDateOffset(Math.round((pickedDay - baseDay) / 86_400_000))
  }

  const displayDate = useMemo(() => {
    return selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }, [selectedDate])

  const selectedDayStats = useMemo(() => {
    let count = 0
    let progressSum = 0
    dueHabits.forEach(h => {
      const rec = getHabitDailyRecord(h, selectedDateKey)
      if (rec.done || rec.progress >= h.target) count++
      progressSum += Math.min(rec.progress / h.target, 1)
    })
    const rate = dueHabits.length ? Math.round((progressSum / dueHabits.length) * 100) : 0
    return { completed: count, overall: rate }
  }, [dueHabits, selectedDateKey])

  const todayCompleted = useMemo(() => {
    return todayDueHabits.filter(habit => {
      const record = getHabitDailyRecord(habit, appTodayDateKey)
      return record.done || record.progress >= habit.target
    }).length
  }, [todayDueHabits, appTodayDateKey])

  const todayOverall = useMemo(() => {
    return todayDueHabits.length
      ? Math.round((todayDueHabits.reduce((sum, habit) => sum + Math.min(getHabitDailyRecord(habit, appTodayDateKey).progress / habit.target, 1), 0) / todayDueHabits.length) * 100)
      : 0
  }, [todayDueHabits, appTodayDateKey])

  const loggedHabitUpdates = useMemo(
    () => habits.reduce((sum, habit) => sum + Object.keys(habit.logs ?? {}).length, 0),
    [habits]
  )
  const recentCheckIns = useMemo(
    () => habits.reduce((sum, habit) => sum + Object.values(habit.logs ?? {}).filter(record => record.done || record.progress >= habit.target).length, 0),
    [habits]
  )
  const historyConsistency = useMemo(() => {
    return loggedHabitUpdates ? Math.round((recentCheckIns / loggedHabitUpdates) * 100) : 0
  }, [loggedHabitUpdates, recentCheckIns])
  const bestStreakHabit = useMemo(
    () => habits.reduce<Habit | null>((best, habit) => {
      const habitBest = streakStatsByHabit.get(habit.id)?.best ?? 0
      const bestValue = best ? streakStatsByHabit.get(best.id)?.best ?? 0 : -1
      return !best || habitBest > bestValue ? habit : best
    }, null),
    [habits, streakStatsByHabit]
  )
  const bestStreakStats = bestStreakHabit ? habitStreakStats(bestStreakHabit) : null

  const toggleHabitForDate = (id: number, dateKey: string, isToday: boolean) => {
    if (dateKey > appTodayDateKey) return
    setHabits(current =>
      current.map(h => {
        if (h.id !== id) return h
        const currentRec = getHabitDailyRecord(h, dateKey)
        const currentlyComplete = currentRec.done || currentRec.progress >= h.target
        const willBeDone = !currentlyComplete
        const newProgress = willBeDone ? h.target : 0
        const newLogs = {
          ...(h.logs || {}),
          [dateKey]: { done: willBeDone, progress: newProgress },
        }

        const updated = {
          ...h,
          done: isToday ? willBeDone : h.done,
          progress: isToday ? newProgress : h.progress,
          logs: newLogs,
        }
        const streakStats = getHabitStreakStats(updated, appTodayDateKey)
        return { ...updated, streak: streakStats.current, longest: streakStats.best }
      })
    )
  }

  const incrementForDate = (id: number, dateKey: string, isToday: boolean) => {
    if (dateKey > appTodayDateKey) return
    setHabits(current =>
      current.map(h => {
        if (h.id !== id) return h
        const currentRec = getHabitDailyRecord(h, dateKey)
        if (currentRec.progress >= h.target) return h
        const nextProgress = Math.min(h.target, currentRec.progress + 1)
        const willBeDone = nextProgress >= h.target
        const newLogs = {
          ...(h.logs || {}),
          [dateKey]: { done: willBeDone, progress: nextProgress },
        }

        const updated = {
          ...h,
          done: isToday ? willBeDone : h.done,
          progress: isToday ? nextProgress : h.progress,
          logs: newLogs,
        }
        const streakStats = getHabitStreakStats(updated, appTodayDateKey)
        return { ...updated, streak: streakStats.current, longest: streakStats.best }
      })
    )
  }

  const decrementForDate = (id: number, dateKey: string, isToday: boolean) => {
    if (dateKey > appTodayDateKey) return
    setHabits(current =>
      current.map(h => {
        if (h.id !== id) return h
        const currentRec = getHabitDailyRecord(h, dateKey)
        if (currentRec.progress <= 0) return h
        const nextProgress = currentRec.progress - 1
        const willBeDone = nextProgress >= h.target
        const newLogs = {
          ...(h.logs || {}),
          [dateKey]: { done: willBeDone, progress: nextProgress },
        }

        const updated = {
          ...h,
          done: isToday ? willBeDone : h.done,
          progress: isToday ? nextProgress : h.progress,
          logs: newLogs,
        }
        const streakStats = getHabitStreakStats(updated, appTodayDateKey)
        return { ...updated, streak: streakStats.current, longest: streakStats.best }
      })
    )
  }

  const toggleArchiveHabit = (id: number) => {
    setHabits(current =>
      current.map(h => (h.id === id ? { ...h, archived: !h.archived } : h))
    )
  }

  const permanentlyDeleteHabit = (id: number) => {
    const habit = habits.find(item => item.id === id)
    if (habit) setHabitDeleteTarget(habit)
  }

  const confirmPermanentHabitDelete = () => {
    if (!habitDeleteTarget) return
    setHabits(current => current.filter(habit => habit.id !== habitDeleteTarget.id))
    setHabitDeleteTarget(null)
  }

  const startEditHabit = (h: Habit) => {
    setEditingHabit(h)
    setEditName(h.name)
    setEditIcon(h.icon)
    setEditColor(h.color)
    setEditSchedule(getHabitSchedule(h))
    setEditCategory(h.category)
    setEditTarget(h.target)
  }

  const saveEditHabit = () => {
    if (!editingHabit) return
    setHabits(current => current.map(h => {
      if (h.id !== editingHabit.id) return h
      const logs = Object.fromEntries(Object.entries(h.logs ?? {}).map(([dateKey, record]) => {
        const progress = Math.min(record.progress, editTarget)
        const done = record.done || progress >= editTarget
        return [dateKey, { done, progress: done ? editTarget : progress }]
      }))
      const todayRecord = logs[appTodayDateKey] ?? { done: false, progress: 0 }
      return {
        ...h,
        name: editName.trim() || h.name,
        icon: editIcon,
        color: editColor,
        detail: `${formatScheduleSummary(editSchedule, false)} · ${editCategory}`,
        schedule: editSchedule,
        category: editCategory,
        target: editTarget,
        done: todayRecord.done,
        progress: todayRecord.progress,
        logs,
      }
    }))
    setEditingHabit(null)
  }

  const yearlyActivity = useMemo(() => {
    const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const dailyRecords = new Map<string, { completed: number; total: number }>()
    let total = 0
    let activeDays = 0
    let totalRecords = 0
    for (const habit of habits) {
      for (const [dateKey, record] of Object.entries(habit.logs ?? {})) {
        const daily = dailyRecords.get(dateKey) ?? { completed: 0, total: 0 }
        daily.total++
        if (record.done || record.progress >= habit.target) daily.completed++
        dailyRecords.set(dateKey, daily)
      }
    }

    const today = new Date(`${appTodayDateKey}T12:00:00`)
    const firstDayIndex = weekStart === 'Sunday' ? 0 : weekStart === 'Saturday' ? 6 : 1
    const weekOffset = (today.getDay() - firstDayIndex + 7) % 7
    const gridStart = new Date(today)
    gridStart.setDate(today.getDate() - weekOffset - (51 * 7))
    const orderedDayNames = Array.from({ length: 7 }, (_, index) => fullDayNames[(firstDayIndex + index) % 7])
    const weeks: ActivityCellData[][] = Array.from({ length: 52 }, (_, weekIndex) =>
      Array.from({ length: 7 }, (_, dayIndex) => {
        const date = new Date(gridStart)
        date.setDate(gridStart.getDate() + weekIndex * 7 + dayIndex)
        const dateKey = getDateKey(date)
        const daily = dailyRecords.get(dateKey) ?? { completed: 0, total: 0 }
        const isToday = dateKey === appTodayDateKey
        const isFuture = dateKey > appTodayDateKey
        const count = isFuture ? 0 : daily.completed
        const maxHabits = isFuture ? 0 : daily.total
        const percentage = maxHabits ? Math.round((count / maxHabits) * 100) : 0
        const level = isFuture || !count ? 0 : Math.min(4, Math.ceil((count / Math.max(maxHabits, 1)) * 4))
        const dayName = orderedDayNames[dayIndex]
        const fullDate = `${dayName}, ${fullMonthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
        const label = isFuture
          ? `${fullDate} (Upcoming)`
          : !maxHabits
          ? `${fullDate} · No check-ins recorded`
          : `${fullDate} · ${count} completed from ${maxHabits} logged updates (${percentage}%)${isToday ? ' · Today' : ''}`
        return { level, count, maxHabits, isToday, isFuture, dayName, fullDate, label, percentage }
      })
    )

    for (const [dateKey, daily] of dailyRecords) {
      if (dateKey > appTodayDateKey || dateKey < getDateKey(gridStart)) continue
      totalRecords += daily.total
      total += daily.completed
      if (daily.completed > 0) activeDays++
    }

    let currentStreak = 0
    const streakStartOffset = (dailyRecords.get(appTodayDateKey)?.completed ?? 0) > 0 ? 0 : 1
    for (let offset = streakStartOffset; offset < 365; offset++) {
      const date = new Date(today)
      date.setDate(today.getDate() - offset)
      if ((dailyRecords.get(getDateKey(date))?.completed ?? 0) === 0) break
      currentStreak++
    }
    let bestStreak = 0
    let runningStreak = 0
    for (let offset = 363; offset >= 0; offset--) {
      const date = new Date(gridStart)
      date.setDate(gridStart.getDate() + offset)
      if ((dailyRecords.get(getDateKey(date))?.completed ?? 0) > 0) {
        runningStreak++
        bestStreak = Math.max(bestStreak, runningStreak)
      } else runningStreak = 0
    }

    return {
      weeks,
      total,
      activeDays,
      consistencyRate: totalRecords ? Math.round((total / totalRecords) * 100) : 0,
      currentStreak,
      bestStreak,
      hasData: totalRecords > 0,
    }
  }, [habits, appTodayDateKey, weekStart])

  const handleCreateHabit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const name = newHabitName.trim()
    if (!name) return
    const newHabit: Habit = {
      id: Math.max(Date.now(), ...habits.map(h => h.id + 1)),
      name,
      icon: selectedIcon,
      color: selectedColor,
      detail: `${formatScheduleSummary(newHabitSchedule, false)} · ${newHabitCategory}`,
      schedule: newHabitSchedule,
      streak: 0,
      longest: 0,
      done: false,
      progress: 0,
      target: Math.max(1, Math.floor(newHabitTarget)),
      category: newHabitCategory,
    }
    setHabits(prev => [newHabit, ...prev])
    setNewHabitName('')
    setNewHabitTarget(1)
    setShowAdd(false)
  }

  const handleAddHabitCategory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const name = categoryDraft.trim().replace(/\s+/g, ' ')
    if (!name) return
    if (allHabitCategories.some(category => category.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setCategoryError('That category already exists.')
      return
    }
    setHabitCategoryOptions(current => [...current, name].sort((a, b) => a.localeCompare(b)))
    setNewHabitCategory(name)
    setCategoryDraft('')
    setCategoryError('')
  }

  const beginRenameCategory = (category: string) => {
    setRenamingCategory(category)
    setRenameCategoryDraft(category)
    setCategoryDeleteTarget(null)
    setCategoryManageError('')
  }

  const saveCategoryRename = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!renamingCategory) return
    const nextName = renameCategoryDraft.trim().replace(/\s+/g, ' ')
    if (!nextName) {
      setCategoryManageError('Enter a category name.')
      return
    }
    if (allHabitCategories.some(category => category !== renamingCategory && category.toLocaleLowerCase() === nextName.toLocaleLowerCase())) {
      setCategoryManageError('That category already exists.')
      return
    }
    if (nextName === renamingCategory) {
      setRenamingCategory(null)
      setCategoryManageError('')
      return
    }
    const oldName = renamingCategory
    setHabitCategoryOptions(current => current.map(category => category === oldName ? nextName : category).sort((a, b) => a.localeCompare(b)))
    setHabits(current => current.map(habit => habit.category === oldName
      ? { ...habit, category: nextName, detail: replaceCategoryInDetail(habit.detail, oldName, nextName) }
      : habit))
    setNewHabitCategory(current => current === oldName ? nextName : current)
    setEditCategory(current => current === oldName ? nextName : current)
    setHabitCategoryFilter(current => current === oldName ? nextName : current)
    setRenamingCategory(null)
    setCategoryManageError('')
  }

  const beginDeleteCategory = (category: string) => {
    setCategoryDeleteTarget(category)
    setCategoryReplacement(allHabitCategories.find(item => item !== category) || '')
    setRenamingCategory(null)
    setCategoryManageError('')
  }

  const confirmDeleteCategory = () => {
    if (!categoryDeleteTarget) return
    if (allHabitCategories.length <= 1) {
      setCategoryManageError('Add another category before deleting the last one.')
      return
    }
    const category = categoryDeleteTarget
    const replacement = categoryReplacement
    const usesCategory = habits.some(habit => habit.category === category)
    if (usesCategory && (!replacement || replacement === category)) {
      setCategoryManageError('Choose a category for the habits to move to.')
      return
    }
    setHabitCategoryOptions(current => current.filter(item => item !== category))
    if (usesCategory) {
      setHabits(current => current.map(habit => habit.category === category
        ? { ...habit, category: replacement, detail: replaceCategoryInDetail(habit.detail, category, replacement) }
        : habit))
    }
    setNewHabitCategory(current => current === category ? replacement : current)
    setEditCategory(current => current === category ? replacement : current)
    setHabitCategoryFilter(current => current === category ? 'All categories' : current)
    setCategoryDeleteTarget(null)
    setCategoryManageError('')
  }

  const handleNav = (label: string) => {
    setActive(label)
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }

  if (!databaseReady) {
    return (
      <main className="database-loading-screen">
        <span className="brand-mark"><Check size={17} strokeWidth={3} /></span>
        <h1>daymark</h1>
        <p>{databaseError ? 'The local database could not be opened.' : 'Opening your local database…'}</p>
        {databaseError && <><span role="alert">{databaseError}</span><button type="button" className="outline-button" onClick={() => window.location.reload()}>Try again</button></>}
      </main>
    )
  }

  return (
    <div className={`app ${dark ? 'dark' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Check size={17} strokeWidth={3} />
          </span>
          <span>daymark</span>
        </div>
        <div className="side-label">Workspace</div>
        <nav aria-label="Main navigation">
          {nav.map(item => {
            const Icon = item.icon
            const badgeCount =
              item.label === 'Today' ? todayCompleted :
              item.label === 'Habits' ? activeHabits.length : null

            return (
              <button
                type="button"
                key={item.label}
                className={`nav-item ${active === item.label ? 'active' : ''}`}
                aria-current={active === item.label ? 'page' : undefined}
                onClick={() => handleNav(item.label)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {badgeCount !== null && <b>{badgeCount}</b>}
              </button>
            )
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="quote">
            “Small steps, every day.”
            <span>— James Clear</span>
          </div>
          <div className="profile">
            <span className="avatar" style={{ backgroundColor: avatarColor, borderColor: avatarColor, color: '#fff' }}>{userName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'U'}</span>
            <span>
              <strong>{userName || 'User'}</strong>
              <small>{activeHabits.length} active · {todayCompleted} done today</small>
            </span>
          </div>
        </div>
      </aside>

      <main className="main" ref={mainScrollRef}>
        <header className="mobile-header">
          <div className="brand">
            <span className="brand-mark">
              <Check size={17} strokeWidth={3} />
            </span>
            <span>daymark</span>
          </div>
          <button type="button" onClick={() => setDark(!dark)} aria-label="Toggle theme" aria-pressed={dark}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {databaseError && (
          <div className="database-save-banner" role="alert">
            <Shield size={16} aria-hidden="true" />
            <span>{databaseError}</span>
            <button type="button" className="outline-button" disabled={databaseBusy} onClick={() => void flushCurrentState().catch(() => undefined)}>Retry save</button>
          </div>
        )}

        {active === 'Today' && (
          <section className="page-section">
            <div className="topline">
              <div>
                <h1>{displayDate}</h1>
                <p className="subtle">
                  {dateOffset === 0
                    ? 'A little progress is still progress.'
                    : dateOffset < 0
                    ? 'Viewing and logging habits for this past day.'
                    : 'Viewing your schedule for this day.'}
                </p>
              </div>
              <div className="date-actions">
                <button type="button" className="icon-button" onClick={() => setDateOffset(dateOffset - 1)} aria-label="Previous day">
                  <ChevronLeft size={16} />
                </button>
                <div className="date-picker-wrap">
                  <button
                    type="button"
                    className="date-picker-trigger"
                    onClick={openDatePicker}
                    aria-label={`Select date. Currently ${selectedDate.toLocaleDateString()}`}
                    title="Select date"
                  >
                    <CalendarDays size={15} aria-hidden="true" />
                    <span>{datePickerLabel}</span>
                  </button>
                  <input
                    ref={datePickerRef}
                    className="date-picker-native"
                    type="date"
                    value={selectedDateKey}
                    onChange={event => selectDateFromPicker(event.target.value)}
                    aria-label="Choose a date"
                    tabIndex={-1}
                  />
                </div>
                <button type="button" className="icon-button" onClick={() => setDateOffset(dateOffset + 1)} aria-label="Next day">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="progress-card">
              <div className="progress-card-content">
                <div className="progress-primary">
                  <strong>{dueHabits.length ? selectedDayStats.overall : '—'}{dueHabits.length > 0 && <span>%</span>}</strong>
                </div>
                <div className="progress-card-divider" />
                <div className="progress-summary">
                  <strong>
                    {dueHabits.length === 0
                      ? activeHabits.length ? 'Nothing is scheduled for today.' : 'Start with one small routine.'
                      : selectedDayStats.completed === dueHabits.length
                      ? 'Everything, in its time.'
                      : selectedDayStats.completed > 0
                      ? 'A good rhythm is taking shape.'
                      : 'Make a little room for what matters.'}
                  </strong>
                  <span>{dueHabits.length ? `${selectedDayStats.completed} of ${dueHabits.length} scheduled habits complete` : activeHabits.length ? `${activeHabits.length} active ${activeHabits.length === 1 ? 'habit' : 'habits'} in your library` : 'Your progress will appear here'}</span>
                </div>
                <div className="progress-count">
                  <strong>{dueHabits.length ? Math.max(dueHabits.length - selectedDayStats.completed, 0) : '—'}</strong>
                  <span>{dueHabits.length ? `${Math.max(dueHabits.length - selectedDayStats.completed, 0) === 1 ? 'habit' : 'habits'} left` : 'due today'}</span>
                </div>
              </div>
              <div className="progress-track-wrap">
                <div
                  className="progress-line"
                  role={dueHabits.length ? 'progressbar' : undefined}
                  aria-label={dueHabits.length ? 'Daily habit progress' : undefined}
                  aria-valuenow={dueHabits.length ? selectedDayStats.overall : undefined}
                  aria-valuemin={dueHabits.length ? 0 : undefined}
                  aria-valuemax={dueHabits.length ? 100 : undefined}
                >
                  <i
                    style={{
                      width: `${selectedDayStats.overall}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="section-heading">
              <div>
                <h2>
                  {dateOffset === 0
                    ? "Today's habits"
                    : dateOffset === -1
                    ? "Yesterday's habits"
                    : `${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} habits`}
                </h2>
                <span>{selectedDayStats.completed} of {dueHabits.length} scheduled habits completed</span>
              </div>
            </div>

            {dueHabits.length === 0 ? (
              <div className="empty-state-card">
                <p>{activeHabits.length ? 'No habits are scheduled for this day. Enjoy the space or choose another day.' : 'No habits for this day yet. Start with one small routine.'}</p>
                {activeHabits.length === 0 && <button type="button" className="primary-button" onClick={() => setShowAdd(true)}><Plus size={16} /> Create a habit</button>}
              </div>
            ) : (
              <div className="habit-square-grid">
                {dueHabits.map(habit => {
                  const record = getHabitDailyRecord(habit, selectedDateKey)
                  const isDone = record.done || record.progress >= habit.target

                  return (
                    <article
                      className={`habit-square-card ${isDone ? 'is-done' : ''} ${isFutureDate ? 'is-read-only' : ''}`}
                      key={habit.id}
                      style={{ '--habit-accent': habit.color } as React.CSSProperties}
                      role="group"
                      tabIndex={isFutureDate ? -1 : 0}
                      aria-disabled={isFutureDate}
                      aria-label={habit.target > 1
                        ? `${habit.name}, ${record.progress} of ${habit.target}. Press Enter or Space to add one.`
                        : `${habit.name}. Press Enter or Space to ${isDone ? 'mark incomplete' : 'mark complete'}.`}
                      onClick={() => habit.target > 1
                        ? incrementForDate(habit.id, selectedDateKey, isSelectedToday)
                        : toggleHabitForDate(habit.id, selectedDateKey, isSelectedToday)}
                      onKeyDown={event => {
                        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
                        event.preventDefault()
                        if (habit.target > 1) incrementForDate(habit.id, selectedDateKey, isSelectedToday)
                        else toggleHabitForDate(habit.id, selectedDateKey, isSelectedToday)
                      }}
                    >
                      <div className="habit-square-top">
                        <div className="habit-icon" style={{ background: `${habit.color}18`, color: habit.color }}>
                          <HabitIcon name={habit.icon} size={18} />
                        </div>
                        <div className="habit-square-heading">
                          <strong className="habit-square-title">{habit.name}</strong>
                          <span className="habit-square-detail">{getHabitSubtitleForDate(habit, record)}</span>
                        </div>
                      </div>

                      <div className="habit-square-meta-row">
                        <span className="habit-square-cat">{habit.category}</span>
                        {showStreak && (
                          <div className="habit-square-streak-row">
                            <Flame size={18} fill={habitStreakStats(habit).current ? 'currentColor' : 'none'} strokeWidth={2.2} />
                            <span>{habitStreakStats(habit).current}</span>
                          </div>
                        )}
                      </div>

                      <div className="habit-square-footer">
                        {habit.target > 1 ? (
                          <div className={`stepper-square ${record.progress >= habit.target ? 'is-complete' : ''}`}>
                            <button
                              type="button"
                              className="stepper-btn"
                              onClick={event => {
                                event.stopPropagation()
                                decrementForDate(habit.id, selectedDateKey, isSelectedToday)
                              }}
                              disabled={isFutureDate || record.progress <= 0}
                              aria-label={`Subtract one from ${habit.name}`}
                              title="Decrease"
                            >
                              <Minus size={12} strokeWidth={2.5} />
                            </button>
                            <span className="stepper-count">{record.progress}/{habit.target}</span>
                            <button
                              type="button"
                              className="stepper-btn"
                              onClick={event => {
                                event.stopPropagation()
                                incrementForDate(habit.id, selectedDateKey, isSelectedToday)
                              }}
                              disabled={isFutureDate || record.progress >= habit.target}
                              aria-label={`Add one to ${habit.name}`}
                              title="Increase"
                            >
                              <Plus size={12} strokeWidth={2.5} />
                            </button>
                          </div>
                        ) : (
                          <div className="habit-square-status">
                            {isDone ? (
                              <span className="status-done-badge">Completed</span>
                            ) : (
                              <span className="status-pending-badge">Pending</span>
                            )}
                          </div>
                        )}

                        {habit.target > 1 ? (
                          <div className="habit-square-status">
                            <span className={isDone ? 'status-done-badge' : 'status-pending-badge'}>
                              {isFutureDate ? 'Future day' : isDone ? 'Goal reached' : 'Tap card to add one'}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={`check-button-square ${isDone ? 'checked' : ''}`}
                            disabled={isFutureDate}
                            onClick={event => {
                              event.stopPropagation()
                              toggleHabitForDate(habit.id, selectedDateKey, isSelectedToday)
                            }}
                            aria-label={`${isDone ? 'Uncomplete' : 'Complete'} ${habit.name}`}
                            title={isDone ? 'Mark incomplete' : 'Mark complete'}
                          >
                            <Check size={15} strokeWidth={2.75} />
                            <span>{isDone ? 'Done' : 'Mark done'}</span>
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {active === 'Habits' && (
          <section className="page-section">
            <div className="topline">
              <div>
                <h1>All habits</h1>
                <p className="subtle">{activeHabits.length} active {activeHabits.length === 1 ? 'habit' : 'habits'} · {todayCompleted} complete today</p>
              </div>
              <button type="button" className="primary-button habit-page-add-button" onClick={() => setShowAdd(true)}>
                <Plus size={16} /> Add habit
              </button>
            </div>

            {activeHabits.length > 0 && (
              <div className="habit-library-toolbar">
                <label className="habit-search">
                  <Search size={16} />
                  <input
                    type="search"
                    value={habitSearch}
                    onChange={e => setHabitSearch(e.target.value)}
                    placeholder="Search habits"
                    aria-label="Search habits"
                  />
                  {habitSearch && <button type="button" onClick={() => setHabitSearch('')} aria-label="Clear search"><X size={14} /></button>}
                </label>
                <select className="habit-category-filter" value={habitCategoryFilter} onChange={e => setHabitCategoryFilter(e.target.value)} aria-label="Filter habits by category">
                  <option>All categories</option>
                  {habitCategories.map(category => <option key={category}>{category}</option>)}
                </select>
              </div>
            )}
            {activeHabits.length === 0 ? (
              <div className="empty-state-card">
                <p>No habits in your library yet. Create your first one to start building a rhythm.</p>
                <button type="button" className="primary-button" onClick={() => setShowAdd(true)}>
                  <Plus size={16} /> Add your first habit
                </button>
              </div>
            ) : (
              visibleHabits.length === 0 ? (
                <div className="empty-state-card habit-filter-empty">
                  <p>No habits match your search.</p>
                  <button type="button" className="outline-button" onClick={() => { setHabitSearch(''); setHabitCategoryFilter('All categories') }}>Clear filters</button>
                </div>
              ) : (
              <div className="library-grid">
                {visibleHabits.map(h => {
                  const record = getHabitDailyRecord(h, appTodayDateKey)
                  const complete = record.done || record.progress >= h.target
                  const rate = Math.min(100, Math.round((record.progress / h.target) * 100))
                  return (
                  <article className="library-card" key={h.id}>
                    <div className="library-top">
                      <div className="habit-icon large" style={{ background: `${h.color}18`, color: h.color }}>
                        <HabitIcon name={h.icon} size={24} />
                      </div>
                      <div className="library-top-actions">
                        <span className="category">{h.category}</span>
                        <div className="library-menu-anchor" ref={openHabitMenuId === h.id ? habitMenuRef : null}>
                          <button
                            type="button"
                            className={`library-menu-trigger ${openHabitMenuId === h.id ? 'is-open' : ''}`}
                            onClick={() => setOpenHabitMenuId(current => current === h.id ? null : h.id)}
                            aria-label={`More options for ${h.name}`}
                            aria-haspopup="menu"
                            aria-expanded={openHabitMenuId === h.id}
                            title="More options"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                          {openHabitMenuId === h.id && (
                            <div className="library-menu-popover" role="menu" aria-label={`${h.name} options`}>
                              <button type="button" role="menuitem" onClick={() => { setOpenHabitMenuId(null); startEditHabit(h) }}>
                                <Pencil size={14} /> Edit habit
                              </button>
                              <button type="button" role="menuitem" onClick={() => { setOpenHabitMenuId(null); toggleArchiveHabit(h.id) }}>
                                <Archive size={14} /> Archive habit
                              </button>
                              <button type="button" role="menuitem" className="library-menu-delete" onClick={() => { setOpenHabitMenuId(null); permanentlyDeleteHabit(h.id) }}>
                                <Trash2 size={14} /> Delete habit
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="library-card-details">
                      <h3>{h.name}</h3>
                      <p>{h.detail}</p>
                      <Heatmap logs={h.logs} color={h.color} todayKey={appTodayDateKey} />
                    </div>
                    <div className="library-today-progress">
                      <div className="library-progress-label">
                        <span>Today</span>
                        <strong>{record.progress}<i>/</i>{h.target}</strong>
                      </div>
                      <div className="library-progress-track"><i style={{ width: `${rate}%`, background: h.color }} /></div>
                      <div className={`library-target-status ${complete ? 'is-complete' : ''}`} aria-label={`Today: ${record.progress} of ${h.target}, ${complete ? 'complete' : 'in progress'}`}>
                        {h.target > 1
                          ? complete ? 'Goal reached' : `${h.target - record.progress} to go`
                          : complete ? 'Completed today' : 'Not completed today'}
                      </div>
                    </div>
                    <div className="library-foot">
                      <span>
                        <Flame size={14} /> {habitStreakStats(h).current} current
                      </span>
                      <span>
                        {Object.keys(h.logs ?? {}).length
                          ? `${Math.round((Object.values(h.logs ?? {}).filter(record => record.done || record.progress >= h.target).length / Object.keys(h.logs ?? {}).length) * 100)}% consistency`
                          : '— consistency'}
                      </span>
                    </div>
                  </article>
                  )
                })}
              </div>
              )
            )}
          </section>
        )}

        {active === 'Stats' && (
          <section className="page-section">
            <div className="topline">
              <div>
                <h1>Stats</h1>
                <p className="subtle">Archived habits keep their history here. Deleted habits are removed.</p>
              </div>
            </div>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-card-heading">
                  <span>Completion rate</span>
                  <span className="stat-card-icon"><Activity size={17} /></span>
                </div>
                <div className="stat-card-value">
                  <strong>{todayDueHabits.length ? `${todayOverall}%` : '—'}</strong>
                  <span>{todayDueHabits.length ? `${todayCompleted} of ${todayDueHabits.length} scheduled habits completed` : activeHabits.length ? 'No habits scheduled today' : 'Create a habit to start tracking'}</span>
                </div>
                {todayDueHabits.length > 0 && <div className="stat-card-progress" role="progressbar" aria-label="Today's completion rate" aria-valuenow={todayOverall} aria-valuemin={0} aria-valuemax={100}>
                  <i style={{ width: `${todayOverall}%` }} />
                </div>}
                <div className="stat-card-foot">
                  <span>Daily goal <strong>{completionGoal}%</strong></span>
                  <em>{!todayDueHabits.length ? activeHabits.length ? 'No habits scheduled today' : 'Available once tracking begins' : todayOverall >= completionGoal ? 'Goal reached' : `${completionGoal - todayOverall} points to goal`}</em>
                </div>
              </div>
              <div className="stat-card stat-card-streak">
                <div className="stat-card-heading">
                  <span>Best streak</span>
                  <span className="stat-card-icon"><Award size={17} /></span>
                </div>
                <div className="stat-card-value">
                  <strong>{bestStreakStats && bestStreakHabit ? <>{bestStreakStats.best}<em>{getHabitScheduleUnit(bestStreakHabit, bestStreakStats.best)}</em></> : '—'}</strong>
                  <span>{bestStreakHabit?.name || 'Create a habit to begin'}</span>
                </div>
                <div className="stat-card-foot">
                  <span><Flame size={14} /> Current streak</span>
                  <strong>{bestStreakStats && bestStreakHabit ? `${bestStreakStats.current} ${getHabitScheduleUnit(bestStreakHabit, bestStreakStats.current)}` : '—'}</strong>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-heading">
                  <span>Check-ins</span>
                  <span className="stat-card-icon"><CheckCircle2 size={17} /></span>
                </div>
                <div className="stat-card-value">
                  <strong>{loggedHabitUpdates ? recentCheckIns : '—'}</strong>
                  <span>{loggedHabitUpdates ? `Across ${habits.length} saved habits, including archived` : 'Check-ins will appear here'}</span>
                </div>
                <div className="stat-card-foot">
                  <span>Tracked-day consistency</span>
                  <strong>{loggedHabitUpdates ? `${historyConsistency}%` : '—'}</strong>
                </div>
              </div>
            </div>

            {/* Annual contribution graph */}
            {showActivity && (
              <article className="activity-card" aria-label="Habit activity contribution graph">
                <div className="activity-header">
                  <div className="activity-title-group">
                    <div className="activity-title-row">
                      <h3>Annual consistency</h3>
                      <span className="activity-badge">Past 52 weeks</span>
                    </div>
                    <p className="activity-subtitle">
                      {yearlyActivity.hasData ? `${yearlyActivity.total} check-ins in the past year · Hover over a square for details` : 'Your actual check-in history will appear here.'}
                    </p>
                  </div>
                  {yearlyActivity.hasData && <div className="activity-stats-pills">
                    <div className="activity-stat-pill">
                      <span className="stat-pill-label">Active days</span>
                      <strong className="stat-pill-value">{yearlyActivity.activeDays}</strong>
                    </div>
                    <div className="activity-stat-pill">
                      <span className="stat-pill-label">Consistency</span>
                      <strong className="stat-pill-value">{yearlyActivity.consistencyRate}%</strong>
                    </div>
                    <div className="activity-stat-pill">
                      <span className="stat-pill-label">Current streak</span>
                      <strong className="stat-pill-value">{yearlyActivity.currentStreak}d</strong>
                    </div>
                    <div className="activity-stat-pill">
                      <span className="stat-pill-label">Best streak</span>
                      <strong className="stat-pill-value">{yearlyActivity.bestStreak}d</strong>
                    </div>
                  </div>}
                </div>

                {yearlyActivity.hasData ? <>
                <div className="activity-graph-wrapper">
                  <div className="activity-graph">
                    <div className="activity-weeks-grid" role="grid" aria-label="Habit activity over the past 52 weeks" ref={activityGridRef}>
                      {Array.from({ length: 7 }, (_, dayIndex) => (
                        <div key={dayIndex} role="row" aria-rowindex={dayIndex + 1}>
                          {yearlyActivity.weeks.map((week, weekIndex) => {
                            const cell = week[dayIndex]
                            return (
                              <div
                                key={weekIndex}
                                className={`activity-cell ${cell.isToday ? 'is-today' : ''}`}
                                data-level={cell.level}
                                data-grid-index={dayIndex * 52 + weekIndex}
                                title={cell.label}
                                role="gridcell"
                                aria-colindex={weekIndex + 1}
                                aria-label={cell.label}
                                tabIndex={cell.isToday ? 0 : -1}
                                onMouseEnter={() => setHoveredCell(cell)}
                                onMouseLeave={() => setHoveredCell(null)}
                                onFocus={() => setHoveredCell(cell)}
                                onBlur={() => setHoveredCell(null)}
                                onKeyDown={event => {
                                  let nextDay = dayIndex
                                  let nextWeek = weekIndex
                                  if (event.key === 'ArrowLeft' && weekIndex > 0) nextWeek--
                                  else if (event.key === 'ArrowRight' && weekIndex < 51) nextWeek++
                                  else if (event.key === 'ArrowUp' && dayIndex > 0) nextDay--
                                  else if (event.key === 'ArrowDown' && dayIndex < 6) nextDay++
                                  else return
                                  event.preventDefault()
                                  const nextIndex = nextDay * 52 + nextWeek
                                  activityGridRef.current?.querySelector<HTMLElement>(`[data-grid-index="${nextIndex}"]`)?.focus()
                                }}
                              />
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="activity-footer">
                  <div className="activity-footer-text">
                    {hoveredCell ? (
                      <span className="activity-active-hover">
                        <span className="hover-indicator" />
                        <strong>{hoveredCell.fullDate}</strong> — {hoveredCell.isFuture ? 'Upcoming date' : !hoveredCell.maxHabits ? 'No check-ins recorded' : `${hoveredCell.count} of ${hoveredCell.maxHabits} logged updates complete (${hoveredCell.percentage}%)`}{hoveredCell.isToday ? ' · Today' : ''}
                      </span>
                    ) : (
                      <span>{yearlyActivity.consistencyRate}% completion across recorded habit updates · {yearlyActivity.currentStreak}-day current streak</span>
                    )}
                  </div>
                  <div className="activity-legend" aria-label="Activity intensity legend">
                    <span>Less</span>
                    <div className="legend-cells" aria-hidden="true">
                      <span className="legend-cell" data-level="0" title="0 habits" />
                      <span className="legend-cell" data-level="1" title="1 habit" />
                      <span className="legend-cell" data-level="2" title="2 habits" />
                      <span className="legend-cell" data-level="3" title="3 habits" />
                      <span className="legend-cell" data-level="4" title="4 habits" />
                    </div>
                    <span>More</span>
                  </div>
                </div>
                </> : <div className="activity-empty-state">Check in with a habit to start building your annual activity view.</div>}
              </article>
            )}

            {/* Completion trend */}
            <WeeklyAreaChart goal={completionGoal} habits={habits} todayKey={appTodayDateKey} />

            <div className="rank-card">
              <div className="card-title">
                <div>
                  <h2>Habit leaderboard</h2>
                  <span>{habits.length ? 'Ranked by consistency across active and archived habits' : 'Create a habit to see your consistency here'}</span>
                </div>
                <div className="rank-card-count">{habits.length} {habits.length === 1 ? 'habit' : 'habits'}</div>
              </div>
              {!habits.length && <div className="rank-empty-state">Your habits will appear here once you create one.</div>}
              {[...habits]
                .sort((a, b) => {
                  const logsA = Object.values(a.logs ?? {})
                  const logsB = Object.values(b.logs ?? {})
                  const rateA = logsA.length ? logsA.filter(record => record.done || record.progress >= a.target).length / logsA.length : -1
                  const rateB = logsB.length ? logsB.filter(record => record.done || record.progress >= b.target).length / logsB.length : -1
                  return rateB - rateA || habitStreakStats(b).current - habitStreakStats(a).current
                })
                .map((h, i) => {
                  const habitLogs = Object.values(h.logs ?? {})
                  const rate = habitLogs.length
                    ? Math.round((habitLogs.filter(record => record.done || record.progress >= h.target).length / habitLogs.length) * 100)
                    : null
                  return (
                    <div className="rank-row" key={h.id}>
                      <b className={`rank-position ${i === 0 ? 'is-first' : ''}`}>{String(i + 1).padStart(2, '0')}</b>
                      <div className="mini-icon" style={{ color: h.color, background: `${h.color}18` }}>
                        <HabitIcon name={h.icon} size={15} />
                      </div>
                      <div className="rank-habit">
                      <strong>{h.name}{h.archived && <em className="rank-archived-label">Archived</em>}</strong>
                      <span>{h.category} · {habitStreakStats(h).current} {getHabitScheduleUnit(h, habitStreakStats(h).current)} current streak</span>
                      </div>
                      <div className="rank-score">
                        <div className="rank-score-label"><strong>{rate === null ? '—' : `${rate}%`}</strong></div>
                        {rate !== null && <div className="rank-bar" role="progressbar" aria-label={`${h.name} recorded completion rate`} aria-valuenow={rate} aria-valuemin={0} aria-valuemax={100}>
                          <i style={{ width: `${rate}%`, background: h.color }} />
                        </div>}
                      </div>
                    </div>
                  )
                })}
            </div>
          </section>
        )}

        {active === 'Settings' && (
          <section className="page-section settings-page">
            <div className="topline">
              <div>
                <h1>Settings</h1>
                <p className="subtle">Make daymark work for you.</p>
              </div>
            </div>

            {settingsToast && (
              <div className="settings-toast" role="status" aria-live="polite">
                <Check size={16} /> {settingsToast}
              </div>
            )}

            <div className="settings-stack">
              {/* Appearance */}
              <div className="settings-group settings-group-preferences" id="settings-appearance">
                <div className="settings-group-header">
                  <div><h3>Personal preferences</h3></div>
                </div>
                <div className="settings-card">
                  <div className="setting-row">
                    <div>
                      <strong>Dark mode</strong>
                      <span>Switch between light and dark theme.</span>
                    </div>
                    <button
                      type="button"
                      className={`toggle-switch ${dark ? 'on' : ''}`}
                      onClick={() => setDark(!dark)}
                      aria-label="Toggle dark mode"
                      aria-pressed={dark}
                    >
                      <span className="toggle-switch-handle" />
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Week starts on</strong>
                      <span>Set the first day of your week.</span>
                    </div>
                    <select
                      className="setting-select"
                      value={weekStart}
                      onChange={e => setWeekStart(e.target.value)}
                    >
                      <option>Monday</option>
                      <option>Sunday</option>
                      <option>Saturday</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Notifications */}
              <div className="settings-group settings-group-reminders" id="settings-reminders">
                <div className="settings-group-header">
                  <div><h3>Reminders</h3></div>
                </div>
                <div className="settings-card">
                  <div className="setting-row">
                    <div>
                      <strong>Daily reminders</strong>
                      <span>Send a browser reminder while Daymark is open.</span>
                    </div>
                    <button
                      type="button"
                      className={`toggle-switch ${remindersOn ? 'on' : ''}`}
                      onClick={() => void toggleDailyReminders()}
                      aria-label="Toggle daily reminders"
                      aria-pressed={remindersOn}
                    >
                      <span className="toggle-switch-handle" />
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Reminder time</strong>
                      <span>When should we remind you each day?</span>
                    </div>
                    <input
                      type="time"
                      className="setting-time-input"
                      value={reminderTime}
                      onChange={e => setReminderTime(e.target.value)}
                      disabled={!remindersOn}
                      aria-label="Daily reminder time"
                    />
                  </div>
                </div>
              </div>

              {/* Dashboard */}
              <div className="settings-group settings-group-dashboard" id="settings-dashboard">
                <div className="settings-group-header">
                  <div><h3>Dashboard & goals</h3></div>
                </div>
                <div className="settings-card">
                  <div className="setting-row">
                    <div>
                      <strong>Show streaks</strong>
                      <span>Display streak counters on habit cards.</span>
                    </div>
                    <button
                      type="button"
                      className={`toggle-switch ${showStreak ? 'on' : ''}`}
                      onClick={() => setShowStreak(!showStreak)}
                      aria-label="Toggle show streaks"
                      aria-pressed={showStreak}
                    >
                      <span className="toggle-switch-handle" />
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Annual consistency card</strong>
                      <span>Show the yearly 52-week activity contribution grid.</span>
                    </div>
                    <button
                      type="button"
                      className={`toggle-switch ${showActivity ? 'on' : ''}`}
                      onClick={() => setShowActivity(!showActivity)}
                      aria-label="Toggle activity graph"
                      aria-pressed={showActivity}
                    >
                      <span className="toggle-switch-handle" />
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Completion trend goal</strong>
                      <span>Set the target line shown on the Stats chart.</span>
                    </div>
                    <label className="setting-goal-field">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={completionGoal}
                        onChange={event => {
                          const value = event.target.valueAsNumber
                          if (Number.isFinite(value)) setCompletionGoal(Math.max(0, Math.min(100, Math.round(value))))
                        }}
                        aria-label="Completion trend goal percentage"
                      />
                      <span>%</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Habit Categories */}
              <div className="settings-group settings-group-categories" id="settings-categories">
                <div className="settings-group-header">
                  <div><h3>Habit categories</h3></div>
                </div>
                <div className="settings-card">
                  <div className="setting-row">
                    <div>
                      <strong>{allHabitCategories.length} categories</strong>
                      <span>Custom categories are available when creating or editing a habit.</span>
                    </div>
                    <button type="button" className="outline-button" onClick={() => { setCategoryError(''); setCategoryManageError(''); setShowCategoryModal(true) }}>
                      <Plus size={15} /> Manage categories
                    </button>
                  </div>
                  <div className="settings-category-preview" aria-label="Available categories">
                    {allHabitCategories.map(category => <span key={category}>{category}</span>)}
                  </div>
                </div>
              </div>

              {/* Profile */}
              <div className="settings-group settings-group-profile" id="settings-profile">
                <div className="settings-group-header">
                  <div><h3>Profile</h3></div>
                </div>
                <div className="settings-card">
                  <div className="setting-row">
                    <div>
                      <strong>Display name</strong>
                      <span>Shown in your sidebar profile.</span>
                    </div>
                    <input
                      type="text"
                      className="setting-input"
                      value={userName}
                      onChange={event => setUserName(event.target.value.slice(0, 32))}
                      placeholder="Your name"
                      maxLength={32}
                      aria-label="Profile display name"
                    />
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Avatar color</strong>
                      <span>Choose a color for your initials.</span>
                    </div>
                    <div className="profile-color-options" role="group" aria-label="Avatar color">
                      {PROFILE_COLORS.map(color => (
                        <button
                          key={color.value}
                          type="button"
                          className={`profile-color-swatch ${avatarColor === color.value ? 'selected' : ''}`}
                          style={{ backgroundColor: color.value }}
                          onClick={() => setAvatarColor(color.value)}
                          aria-label={color.label}
                          aria-pressed={avatarColor === color.value}
                          title={color.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Archived Habits */}
              <div className="settings-group settings-group-archive" id="settings-archive">
                <div className="settings-group-header">
                  <div><h3>Archived habits</h3></div>
                </div>
                <div className="settings-card">
                  <div className="setting-row">
                    <div>
                      <strong>{archivedHabits.length} archived {archivedHabits.length === 1 ? 'habit' : 'habits'}</strong>
                      <span>Your archived habits keep their history until you remove them.</span>
                    </div>
                    <button type="button" className="outline-button" onClick={() => setShowArchiveModal(true)}>
                      <Archive size={14} /> Manage archive
                    </button>
                  </div>
                </div>
              </div>

              {/* Data & Privacy */}
              <div className="settings-group settings-group-data" id="settings-data">
                <div className="settings-group-header">
                  <div><h3>Data & privacy</h3></div>
                </div>
                <div className="settings-card">
                  <div className="setting-row">
                    <div>
                      <strong>Export & import</strong>
                      <span>Move all habits, progress, categories, and preferences in a JSON file.</span>
                    </div>
                    <div className="setting-actions-row">
                      <button
                        type="button"
                        className="outline-button"
                        disabled={databaseBusy || !databaseReady}
                        onClick={() => void handleExportData()}
                      >
                        <Download size={14} /> Download JSON
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".json,application/json"
                        style={{ display: 'none' }}
                        onChange={handleImportFile}
                      />
                      <button
                        type="button"
                        className="outline-button"
                        disabled={databaseBusy || !databaseReady}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={14} /> Import JSON
                      </button>
                    </div>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>SQLite backups</strong>
                      <span>Create a full database snapshot. Backups are stored in data/backups/.</span>
                    </div>
                    <button type="button" className="outline-button" disabled={databaseBusy || !databaseReady} onClick={() => void createDatabaseBackup()}>
                      <Archive size={14} /> Create backup
                    </button>
                  </div>
                  {backups.length > 0 && (
                    <div className="database-backup-list">
                      {backups.map(backup => (
                        <div className="database-backup-row" key={backup.filename}>
                          <div>
                            <strong>{new Date(backup.createdAt).toLocaleString()}</strong>
                            <span>{backup.filename} · {(backup.size / 1024).toFixed(1)} KB</span>
                          </div>
                          <div className="setting-actions-row">
                            <a className="outline-button" href={`/api/backups/${encodeURIComponent(backup.filename)}/download`} download>
                              <Download size={14} /> Download
                            </a>
                            <button type="button" className="outline-button" disabled={databaseBusy} onClick={() => void restoreDatabaseBackup(backup)}>
                              <ArchiveRestore size={14} /> Restore
                            </button>
                            <button type="button" className="danger-button" disabled={databaseBusy} onClick={() => void deleteDatabaseBackup(backup)}>
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="setting-row">
                    <div>
                      <strong>Reset all progress</strong>
                      <span>Clear check-ins and streaks while keeping your habits and settings.</span>
                    </div>
                    <button
                      type="button"
                      className="danger-button"
                      disabled={databaseBusy || !databaseReady}
                      onClick={() => {
                        if (window.confirm('Reset all progress? Habits and settings will remain, but all check-ins and streak history will be cleared.')) {
                          setHabits(current =>
                            current.map(h => ({
                              ...h,
                              streak: 0,
                              longest: 0,
                              done: false,
                              progress: 0,
                              logs: {},
                            }))
                          )
                          setSettingsToast('All progress has been reset.')
                          setTimeout(() => setSettingsToast(''), 3000)
                        }
                      }}
                    >
                      <RotateCcw size={14} /> Reset progress
                    </button>
                  </div>
                  <div className="setting-row">
                    <div>
                      <strong>Wipe all data</strong>
                      <span>Permanently remove habits, settings, progress, and all SQLite backups.</span>
                    </div>
                <button type="button" className="danger-button" disabled={databaseBusy || !databaseReady} onClick={() => setShowWipeConfirmation(true)}>
                      <Trash2 size={14} /> Wipe all data
                    </button>
                  </div>
                </div>
                <div className="settings-version-row">
                  <div>
                    <Sparkles size={14} />
                    <span>daymark web v{__APP_VERSION__}</span>
                  </div>
                  <span className="muted-pill">Up to date</span>
                </div>
              </div>
            </div>
          </section>
        )}

        <footer className={`app-footer ${active === 'Today' || active === 'Habits' ? 'app-footer-after-scroll' : ''}`}>
          <div className="app-footer-main">
            <div className="app-footer-brand-column">
              <div className="app-footer-brand">
                <span className="brand-mark">
                  <Check size={16} strokeWidth={3} />
                </span>
                <span className="app-footer-brand-copy">
                  <strong>daymark</strong>
                  <small>Small steps, every day.</small>
                </span>
              </div>
              <p>Build a rhythm that feels like yours, one small win at a time.</p>
              <span className="app-footer-local-note"><CheckCircle2 size={14} /> Stored locally on this device</span>
            </div>

            <nav className="app-footer-link-group" aria-label="Explore Daymark">
              <h2>Explore</h2>
              {nav.map(item => (
                <button
                  type="button"
                  key={item.label}
                  className={active === item.label ? 'active' : ''}
                  onClick={() => handleNav(item.label)}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <nav className="app-footer-link-group" aria-label="Privacy and legal information">
              <h2>Privacy &amp; terms</h2>
              <button type="button" onClick={() => setLegalDocument('privacy')}>Privacy</button>
              <button type="button" onClick={() => setLegalDocument('terms')}>Terms of use</button>
              <button type="button" onClick={() => setLegalDocument('data')}>Data &amp; storage</button>
            </nav>
          </div>
          <div className="app-footer-bottom">
            <span>© {new Date().getFullYear()} daymark</span>
            <span>Personal habit tracker <i /> v{__APP_VERSION__}</span>
          </div>
        </footer>
      </main>

      {showWipeConfirmation && (
        <div className="modal-backdrop wipe-confirm-backdrop" onClick={() => setShowWipeConfirmation(false)}>
          <div
            className="modal wipe-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wipe-confirm-title"
            aria-describedby="wipe-confirm-description"
            onClick={event => event.stopPropagation()}
          >
            <div className="wipe-confirm-icon" aria-hidden="true"><Trash2 size={20} /></div>
            <p className="eyebrow">PERMANENT ACTION</p>
            <h2 id="wipe-confirm-title">Wipe all app data?</h2>
            <p id="wipe-confirm-description" className="wipe-confirm-copy">
              This permanently deletes every habit, check-in, saved preference, and SQLite backup stored by Daymark. You can’t undo this.
            </p>
            <div className="wipe-confirm-notice">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Daymark will return to its default settings with an empty habit list.</span>
            </div>
            <div className="wipe-confirm-actions">
              <button
                type="button"
                className="outline-button"
                autoFocus
                onClick={() => setShowWipeConfirmation(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="wipe-confirm-submit"
                disabled={databaseBusy}
                onClick={() => {
                  setShowWipeConfirmation(false)
                  void wipeApplicationData()
                }}
              >
                <Trash2 size={15} /> Wipe all data
              </button>
            </div>
          </div>
        </div>
      )}

      {habitDeleteTarget && (
        <div className="modal-backdrop wipe-confirm-backdrop" onClick={() => setHabitDeleteTarget(null)}>
          <div
            className="modal wipe-confirm-modal habit-delete-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="habit-delete-confirm-title"
            aria-describedby="habit-delete-confirm-description"
            onClick={event => event.stopPropagation()}
          >
            <div className="wipe-confirm-icon" aria-hidden="true"><Trash2 size={20} /></div>
            <p className="eyebrow">PERMANENT ACTION</p>
            <h2 id="habit-delete-confirm-title">Delete “{habitDeleteTarget.name}”?</h2>
            <p id="habit-delete-confirm-description" className="wipe-confirm-copy">
              This permanently deletes the habit, its check-ins, and its stats. This can’t be undone.
            </p>
            <div className="wipe-confirm-notice">
              <Archive size={16} aria-hidden="true" />
              <span>Want to keep its history? Archive the habit instead.</span>
            </div>
            <div className="wipe-confirm-actions">
              <button type="button" className="outline-button" autoFocus onClick={() => setHabitDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="wipe-confirm-submit" onClick={confirmPermanentHabitDelete}>
                <Trash2 size={15} /> Delete habit
              </button>
            </div>
          </div>
        </div>
      )}

      {legalDocument && (
        <div className="modal-backdrop" onClick={() => setLegalDocument(null)}>
          <div className="modal legal-modal" role="dialog" aria-modal="true" aria-labelledby="legal-modal-title" onClick={event => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setLegalDocument(null)} aria-label="Close legal information">
              <X size={17} />
            </button>
            <p className="eyebrow">DAYMARK · INFORMATION</p>
            <h2 id="legal-modal-title">{LEGAL_DOCUMENTS[legalDocument].title}</h2>
            <p className="modal-subtitle">{LEGAL_DOCUMENTS[legalDocument].intro}</p>
            <div className="legal-modal-sections">
              {LEGAL_DOCUMENTS[legalDocument].sections.map(section => (
                <section key={section.heading}>
                  <h3>{section.heading}</h3>
                  <p>{section.copy}</p>
                </section>
              ))}
            </div>
            <div className="modal-footer">
              <button type="button" className="primary-button legal-close-button" onClick={() => setLegalDocument(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Habit Categories Modal */}
      {showCategoryModal && (
        <div className="modal-backdrop" onClick={() => setShowCategoryModal(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="category-modal-title" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setShowCategoryModal(false)} aria-label="Close categories">
              <X size={17} />
            </button>
            <p className="eyebrow">PERSONALIZE</p>
            <h2 id="category-modal-title">Habit categories</h2>
            <p className="modal-subtitle">Add, rename, or delete categories to organize your routines.</p>

            <form className="category-create-form" onSubmit={handleAddHabitCategory}>
              <label className="form-field-label" htmlFor="new-category-name">New category</label>
              <div className="category-create-row">
                <input
                  id="new-category-name"
                  type="text"
                  value={categoryDraft}
                  onChange={e => { setCategoryDraft(e.target.value); setCategoryError('') }}
                  placeholder="e.g. Creativity"
                  maxLength={30}
                  required
                  autoFocus
                />
                <button className="primary-button" type="submit"><Plus size={16} /> Add</button>
              </div>
              {categoryError && <p className="category-form-error" role="alert">{categoryError}</p>}
            </form>

            <div className="category-list-heading">
              <span className="form-field-label">Your categories</span>
              <span>{allHabitCategories.length}</span>
            </div>
            <div className="category-list" aria-label="Your habit categories">
              {allHabitCategories.map(category => {
                const count = habits.filter(habit => habit.category === category).length
                return (
                  <div className="category-list-entry" key={category}>
                    {renamingCategory === category ? (
                      <form className="category-inline-edit" onSubmit={saveCategoryRename}>
                        <span className="category-list-dot" />
                        <input
                          value={renameCategoryDraft}
                          onChange={e => { setRenameCategoryDraft(e.target.value); setCategoryManageError('') }}
                          aria-label={`Rename ${category}`}
                          maxLength={30}
                          autoFocus
                        />
                        <button className="category-icon-action is-save" type="submit" aria-label="Save category name" title="Save">
                          <Check size={15} />
                        </button>
                        <button className="category-icon-action" type="button" onClick={() => { setRenamingCategory(null); setCategoryManageError('') }} aria-label="Cancel rename" title="Cancel">
                          <X size={15} />
                        </button>
                      </form>
                    ) : (
                      <div className="category-list-item">
                        <span className="category-list-dot" />
                        <strong>{category}</strong>
                        <span className="category-list-count">{count} {count === 1 ? 'habit' : 'habits'}</span>
                        <div className="category-item-actions">
                          <button className="category-icon-action" type="button" onClick={() => beginRenameCategory(category)} aria-label={`Edit ${category}`} title="Edit category">
                            <Pencil size={14} />
                          </button>
                          <button className="category-icon-action is-delete" type="button" onClick={() => beginDeleteCategory(category)} aria-label={`Delete ${category}`} title="Delete category">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                    {renamingCategory === category && categoryManageError && <p className="category-form-error" role="alert">{categoryManageError}</p>}
                    {categoryDeleteTarget === category && (
                      <div className="category-delete-panel">
                        {count > 0 ? (
                          <>
                            <label htmlFor="category-replacement">Move {count} {count === 1 ? 'habit' : 'habits'} to</label>
                            <select id="category-replacement" value={categoryReplacement} onChange={e => { setCategoryReplacement(e.target.value); setCategoryManageError('') }}>
                              {allHabitCategories.filter(item => item !== category).map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                          </>
                        ) : (
                          <p>Delete “{category}”? This category has no habits.</p>
                        )}
                        {categoryManageError && <p className="category-form-error" role="alert">{categoryManageError}</p>}
                        <div className="category-delete-actions">
                          <button type="button" className="outline-button" onClick={() => { setCategoryDeleteTarget(null); setCategoryManageError('') }}>Cancel</button>
                          <button type="button" className="category-delete-confirm" onClick={confirmDeleteCategory}>Delete category</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="modal-footer">
              <button type="button" className="primary-button full" onClick={() => setShowCategoryModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <HabitEditorDialog
          mode="create"
          dark={dark}
          name={newHabitName}
          onNameChange={setNewHabitName}
          target={newHabitTarget}
          onTargetChange={setNewHabitTarget}
          category={newHabitCategory}
          onCategoryChange={setNewHabitCategory}
          categories={allHabitCategories}
          schedule={newHabitSchedule}
          onScheduleChange={setNewHabitSchedule}
          icon={selectedIcon}
          onIconChange={setSelectedIcon}
          color={selectedColor}
          onColorChange={setSelectedColor}
          onClose={() => setShowAdd(false)}
          onSubmit={handleCreateHabit}
        />
      )}

      {/* Archived Habits Modal */}
      {showArchiveModal && (
        <div className="modal-backdrop" onClick={() => setShowArchiveModal(false)}>
          <div className="modal archive-modal" role="dialog" aria-modal="true" aria-labelledby="archive-modal-title" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setShowArchiveModal(false)} aria-label="Close archive">
              <X size={17} />
            </button>
            <div className="archive-modal-heading">
              <span className="archive-modal-icon"><Archive size={18} /></span>
              <div>
                <h2 id="archive-modal-title">Habit archive</h2>
                <p className="modal-subtitle">Paused habits stay here until you bring them back or remove them.</p>
              </div>
            </div>
            {archivedHabits.length === 0 ? (
              <div className="archive-empty-state">
                <Archive size={22} />
                <strong>Your archive is empty</strong>
                <span>Archive a habit to keep it off your daily list without losing its history.</span>
              </div>
            ) : (
              <div className="archive-modal-list">
                {archivedHabits.map(h => (
                  <div key={h.id} className="archive-modal-item">
                    <div className="mini-icon" style={{ color: h.color, background: `${h.color}18` }}>
                      <HabitIcon name={h.icon} size={15} />
                    </div>
                    <div className="archive-modal-habit-copy">
                      <strong>{h.name}</strong>
                      <span>{h.category} · {habitStreakStats(h).current} {getHabitScheduleUnit(h, habitStreakStats(h).current)} streak</span>
                    </div>
                    <button type="button" className="outline-button archive-action-button" onClick={() => toggleArchiveHabit(h.id)}>
                      <ArchiveRestore size={14} /> Restore
                    </button>
                    <button type="button" className="archive-delete-button" onClick={() => permanentlyDeleteHabit(h.id)} aria-label={`Delete ${h.name} permanently`} title="Delete permanently">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {nav.map(item => {
          const Icon = item.icon
          return (
            <button
              type="button"
              key={item.label}
              className={`mobile-nav-item ${active === item.label ? 'active' : ''}`}
              aria-current={active === item.label ? 'page' : undefined}
              onClick={() => handleNav(item.label)}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {editingHabit && (
        <HabitEditorDialog
          mode="edit"
          dark={dark}
          name={editName}
          onNameChange={setEditName}
          target={editTarget}
          onTargetChange={setEditTarget}
          category={editCategory}
          onCategoryChange={setEditCategory}
          categories={allHabitCategories}
          schedule={editSchedule}
          onScheduleChange={setEditSchedule}
          icon={editIcon}
          onIconChange={setEditIcon}
          color={editColor}
          onColorChange={setEditColor}
          onClose={() => setEditingHabit(null)}
          onSubmit={event => { event.preventDefault(); saveEditHabit() }}
        />
      )}
    </div>
  )
}

export default App
