import type { Task, TaskSettings, TaskUpdate } from '@/types'

export const REMINDER_PRESETS: Array<{ minutes: number; label: string; short: string }> = [
  { minutes: 0, label: 'At due time', short: 'At due time' },
  { minutes: 5, label: '5 minutes before', short: '5m' },
  { minutes: 15, label: '15 minutes before', short: '15m' },
  { minutes: 30, label: '30 minutes before', short: '30m' },
  { minutes: 60, label: '1 hour before', short: '1h' },
  { minutes: 180, label: '3 hours before', short: '3h' },
  { minutes: 1440, label: '1 day before', short: '1d' },
  { minutes: 10080, label: '1 week before', short: '1w' },
]

export const DEFAULT_TASK_SETTINGS: TaskSettings = {
  defaultReminders: [0, 15],
  runInBackground: true,
}

/** Missed reminders older than this (e.g. the computer was off for weeks) are dropped silently. */
const MISSED_GRACE_MS = 7 * 24 * 60 * 60 * 1000

export type Quadrant = 'do' | 'schedule' | 'delegate' | 'eliminate'

export const QUADRANTS: Array<{
  id: Quadrant
  important: boolean
  urgent: boolean
  title: string
  hint: string
}> = [
  { id: 'do', important: true, urgent: true, title: 'Do first', hint: 'Important & urgent — do it now' },
  { id: 'schedule', important: true, urgent: false, title: 'Schedule', hint: 'Important, not urgent — plan a time' },
  { id: 'delegate', important: false, urgent: true, title: 'Delegate', hint: 'Urgent, not important — who can help?' },
  { id: 'eliminate', important: false, urgent: false, title: 'Eliminate', hint: 'Neither — drop it or do it later' },
]

export function quadrantOf(t: Pick<Task, 'important' | 'urgent'>): Quadrant {
  return QUADRANTS.find((q) => q.important === t.important && q.urgent === t.urgent)!.id
}

const reminderKey = (dueAt: number, offset: number) => `${dueAt}:${offset}`
const fireTime = (dueAt: number, offset: number) => dueAt - offset * 60_000

export function newTask(id: string, init: Partial<Task>, settings: TaskSettings, now = Date.now()): Task {
  return applyTaskUpdate(
    null,
    {
      id,
      title: '',
      notes: '',
      important: true,
      urgent: true,
      dueAt: null,
      reminders: [...settings.defaultReminders],
      completed: false,
      completedAt: null,
      order: now,
      ...init,
    },
    now,
  )
}

/**
 * Applies an update to a task. Reminders whose time is already in the past
 * when a due date/reminder is set are marked as sent, so setting a due date
 * of "5 minutes ago" doesn't immediately fire a burst of notifications.
 */
export function applyTaskUpdate(prev: Task | null, update: TaskUpdate, now = Date.now()): Task {
  const base: Task = prev ?? {
    id: update.id,
    title: '',
    notes: '',
    important: true,
    urgent: true,
    dueAt: null,
    reminders: [],
    completed: false,
    completedAt: null,
    order: now,
    createdAt: now,
    updatedAt: now,
    sentReminders: [],
  }
  const clean = Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined)) as TaskUpdate
  const next: Task = { ...base, ...clean, id: base.id, updatedAt: now }
  next.title = String(next.title ?? '').slice(0, 500)
  next.notes = String(next.notes ?? '').slice(0, 10_000)
  next.important = !!next.important
  next.urgent = !!next.urgent
  next.dueAt = typeof next.dueAt === 'number' && Number.isFinite(next.dueAt) ? next.dueAt : null
  next.reminders = [...new Set((next.reminders ?? []).map(Number).filter((m) => Number.isFinite(m) && m >= 0))].sort((a, b) => a - b)
  if (next.completed && !base.completed) next.completedAt = now
  if (!next.completed) next.completedAt = null

  const scheduleChanged = !prev || prev.dueAt !== next.dueAt || prev.reminders.join() !== next.reminders.join()
  if (scheduleChanged) {
    // Keep only keys for the current due date, and pre-mark reminders already in the past.
    const sent = new Set(base.sentReminders.filter((k) => next.dueAt !== null && k.startsWith(`${next.dueAt}:`)))
    if (next.dueAt !== null) {
      for (const offset of next.reminders) {
        if (fireTime(next.dueAt, offset) <= now) sent.add(reminderKey(next.dueAt, offset))
      }
    }
    next.sentReminders = [...sent]
  }
  return next
}

export interface DueNotification {
  task: Task
  /** True when the reminder time passed while the app wasn't running/checking. */
  missed: boolean
}

/**
 * Finds reminders that are due. Returns at most one notification per task
 * (the most recent due reminder) and the tasks with their sent keys updated.
 */
export function collectDueReminders(tasks: Task[], now: number, checkIntervalMs: number) {
  const notifications: DueNotification[] = []
  const changed: Task[] = []
  for (const task of tasks) {
    if (task.completed || task.dueAt === null || task.reminders.length === 0) continue
    const sent = new Set(task.sentReminders)
    let latest: number | null = null
    let added = false
    for (const offset of task.reminders) {
      const key = reminderKey(task.dueAt, offset)
      const at = fireTime(task.dueAt, offset)
      if (at > now || sent.has(key)) continue
      sent.add(key)
      added = true
      if (now - at <= MISSED_GRACE_MS && (latest === null || at > latest)) latest = at
    }
    if (!added) continue
    const updated = { ...task, sentReminders: [...sent] }
    changed.push(updated)
    if (latest !== null) notifications.push({ task: updated, missed: now - latest > checkIntervalMs * 2 + 5000 })
  }
  return { notifications, changed }
}

const QUADRANT_TITLE: Record<Quadrant, string> = Object.fromEntries(QUADRANTS.map((q) => [q.id, q.title])) as Record<Quadrant, string>

/** Title/body for a reminder notification. */
export function notificationText({ task, missed }: DueNotification, now: number) {
  const due = task.dueAt!
  const diff = due - now
  let title: string
  if (diff > 60_000) title = `⏰ Due in ${formatDuration(diff)}`
  else if (diff > -60_000) title = '⏰ Due now'
  else title = `⚠️ Overdue by ${formatDuration(-diff)}`
  if (missed && diff <= 60_000) title += ' (missed reminder)'
  const body = `${task.title || 'Untitled task'}\n${QUADRANT_TITLE[quadrantOf(task)]} · due ${formatDueDate(due, now)}`
  return { title, body }
}

export function formatDuration(ms: number) {
  const min = Math.round(ms / 60_000)
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} hour${h === 1 ? '' : 's'}`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'}`
}

/** "Today 17:00", "Tomorrow 09:30", "Mon, 12 Nov 17:00", with the year when it differs. */
export function formatDueDate(ts: number, now = Date.now()) {
  const d = new Date(ts)
  const today = new Date(now)
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(d) - startOf(today)) / 86_400_000)
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (days === 0) return `Today ${time}`
  if (days === 1) return `Tomorrow ${time}`
  if (days === -1) return `Yesterday ${time}`
  const date = d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== today.getFullYear() && { year: 'numeric' }),
  })
  return `${date} ${time}`
}
