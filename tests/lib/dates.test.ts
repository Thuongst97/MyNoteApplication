import { afterEach, describe, expect, it, vi } from 'vitest'
import { atHour, fromLocalInput, nextWeek, toLocalInput } from '@/lib/dates'

describe('date helpers', () => {
  afterEach(() => vi.useRealTimers())

  it('round-trips datetime-local values in local time', () => {
    const ts = new Date(2026, 0, 5, 9, 7).getTime()
    expect(toLocalInput(ts)).toBe('2026-01-05T09:07')
    expect(fromLocalInput('2026-01-05T09:07')).toBe(ts)
  })

  it('returns null for empty/invalid input', () => {
    expect(fromLocalInput('')).toBeNull()
    expect(fromLocalInput('not a date')).toBeNull()
  })

  it('computes quick picks', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 28, 15, 30)) // Wednesday
    expect(new Date(atHour(0, 17)).getHours()).toBe(17)
    expect(new Date(atHour(1, 9)).getDate()).toBe(29)
    const nw = new Date(nextWeek(9))
    expect(nw.getDay()).toBe(1) // Monday
    expect(nw.getDate()).toBe(2)
  })
})
