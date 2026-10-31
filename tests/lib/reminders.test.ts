import { describe, expect, it } from 'vitest'
import {
  applyTaskUpdate,
  collectDueReminders,
  DEFAULT_TASK_SETTINGS,
  formatDueDate,
  formatDuration,
  newTask,
  notificationText,
  quadrantOf,
  QUADRANTS,
} from '@/lib/reminders'

const M = 60_000
const NOW = new Date(2026, 9, 31, 12, 0).getTime()
const settings = { defaultReminders: [0, 15], runInBackground: true }

describe('quadrants', () => {
  it('maps important × urgent to the four quadrants', () => {
    expect(quadrantOf({ important: true, urgent: true })).toBe('do')
    expect(quadrantOf({ important: true, urgent: false })).toBe('schedule')
    expect(quadrantOf({ important: false, urgent: true })).toBe('delegate')
    expect(quadrantOf({ important: false, urgent: false })).toBe('eliminate')
    expect(QUADRANTS).toHaveLength(4)
  })
})

describe('newTask / applyTaskUpdate', () => {
  it('creates a task with the default reminders', () => {
    const t = newTask('a', { title: 'Write report' }, settings, NOW)
    expect(t).toMatchObject({ id: 'a', title: 'Write report', important: true, urgent: true, reminders: [0, 15], completed: false })
    expect(t.createdAt).toBe(NOW)
  })

  it('sanitises fields (dedupes/sorts reminders, drops invalid values)', () => {
    const t = applyTaskUpdate(null, { id: 'x', reminders: [15, 0, 15, -5, NaN as never], dueAt: Infinity as never, title: 'a'.repeat(600) }, NOW)
    expect(t.reminders).toEqual([0, 15])
    expect(t.dueAt).toBeNull()
    expect(t.title).toHaveLength(500)
  })

  it('records completion time and clears it when reopened', () => {
    const t = newTask('a', {}, settings, NOW)
    const done = applyTaskUpdate(t, { id: 'a', completed: true }, NOW + 1000)
    expect(done.completedAt).toBe(NOW + 1000)
    expect(applyTaskUpdate(done, { id: 'a', completed: false }, NOW + 2000).completedAt).toBeNull()
  })

  it('pre-marks reminders that are already in the past (no burst)', () => {
    const t = newTask('a', { dueAt: NOW + 10 * M }, settings, NOW)
    expect(t.sentReminders).toEqual([`${NOW + 10 * M}:15`])
  })

  it('keeps sent keys when unrelated fields change, resets them when rescheduled', () => {
    let t = newTask('a', { dueAt: NOW + 10 * M }, settings, NOW)
    t = applyTaskUpdate(t, { id: 'a', title: 'renamed' }, NOW)
    expect(t.sentReminders).toHaveLength(1)
    t = applyTaskUpdate(t, { id: 'a', dueAt: NOW + 60 * M }, NOW)
    expect(t.sentReminders).toEqual([])
  })

  it('ignores id changes in updates', () => {
    const t = newTask('a', {}, settings, NOW)
    expect(applyTaskUpdate(t, { id: 'b' } as never, NOW).id).toBe('a')
  })
})

describe('collectDueReminders', () => {
  it('fires each reminder once, at the right time', () => {
    let t = newTask('a', { title: 'Report', dueAt: NOW + 20 * M }, settings, NOW)
    expect(collectDueReminders([t], NOW, 15_000).notifications).toHaveLength(0)

    let r = collectDueReminders([t], NOW + 5 * M, 15_000)
    expect(r.notifications).toHaveLength(1)
    expect(r.notifications[0].missed).toBe(false)
    t = r.changed[0]
    expect(collectDueReminders([t], NOW + 6 * M, 15_000).notifications).toHaveLength(0)

    r = collectDueReminders([t], NOW + 20 * M + 1000, 15_000)
    expect(r.notifications).toHaveLength(1)
  })

  it('sends one "missed" notification when several reminders passed while closed', () => {
    const t = newTask('a', { dueAt: NOW + 30 * M }, settings, NOW)
    const r = collectDueReminders([t], NOW + 2 * 60 * M, 15_000)
    expect(r.notifications).toHaveLength(1)
    expect(r.notifications[0].missed).toBe(true)
    expect(r.changed[0].sentReminders).toHaveLength(2)
  })

  it('never notifies for completed tasks or tasks without a due date', () => {
    const done = applyTaskUpdate(newTask('a', { dueAt: NOW + 5 * M }, settings, NOW), { id: 'a', completed: true }, NOW)
    const undated = newTask('b', {}, settings, NOW)
    expect(collectDueReminders([done, undated], NOW + 10 * M, 15_000)).toEqual({ notifications: [], changed: [] })
  })

  it('drops reminders older than 7 days silently but marks them sent', () => {
    const t = newTask('a', { dueAt: NOW + 5 * M }, settings, NOW)
    const r = collectDueReminders([t], NOW + 30 * 24 * 60 * M, 15_000)
    expect(r.notifications).toHaveLength(0)
    expect(r.changed).toHaveLength(1)
  })
})

describe('text helpers', () => {
  it('formats durations', () => {
    expect(formatDuration(15 * M)).toBe('15 min')
    expect(formatDuration(60 * M)).toBe('1 hour')
    expect(formatDuration(5 * 60 * M)).toBe('5 hours')
    expect(formatDuration(3 * 24 * 60 * M)).toBe('3 days')
  })

  it('formats due dates relative to today', () => {
    expect(formatDueDate(NOW + 60 * M, NOW)).toMatch(/^Today /)
    expect(formatDueDate(NOW + 24 * 60 * M, NOW)).toMatch(/^Tomorrow /)
    expect(formatDueDate(NOW - 24 * 60 * M, NOW)).toMatch(/^Yesterday /)
    expect(formatDueDate(new Date(2027, 2, 3, 9).getTime(), NOW)).toMatch(/2027/)
  })

  it('builds notification titles for upcoming, due and overdue tasks', () => {
    const t = { ...newTask('a', { title: 'Report', dueAt: NOW + 15 * M }, settings, NOW) }
    expect(notificationText({ task: t, missed: false }, NOW).title).toBe('⏰ Due in 15 min')
    expect(notificationText({ task: t, missed: false }, NOW + 15 * M).title).toBe('⏰ Due now')
    const late = notificationText({ task: t, missed: true }, NOW + 135 * M)
    expect(late.title).toBe('⚠️ Overdue by 2 hours (missed reminder)')
    expect(late.body).toContain('Report')
    expect(late.body).toContain('Do first')
  })

  it('has sane defaults', () => {
    expect(DEFAULT_TASK_SETTINGS.defaultReminders).toEqual([0, 15])
  })
})
