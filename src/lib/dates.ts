const pad = (n: number) => String(n).padStart(2, '0')

/** ms timestamp → value for <input type="datetime-local"> (local time). */
export function toLocalInput(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** <input type="datetime-local"> value → ms timestamp (local time), or null. */
export function fromLocalInput(value: string): number | null {
  if (!value) return null
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : null
}

/** Today/tomorrow/next week at a given hour, for quick due-date buttons. */
export function atHour(daysFromToday: number, hour: number) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}

/** Next Monday at `hour`. */
export function nextWeek(hour: number) {
  const d = new Date()
  const add = ((8 - d.getDay()) % 7) || 7
  d.setDate(d.getDate() + add)
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}
