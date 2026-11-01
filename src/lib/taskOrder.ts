import type { Task } from '@/types'

/**
 * Manual priority order inside a quadrant: open tasks by `order` (ascending, the user's
 * priority 1, 2, 3…), completed tasks after them (most recently completed first).
 */
export function sortByPriority(a: Task, b: Task) {
  if (a.completed !== b.completed) return a.completed ? 1 : -1
  if (a.completed && b.completed) return (b.completedAt ?? 0) - (a.completedAt ?? 0)
  return a.order - b.order || a.createdAt - b.createdAt
}

/**
 * The `order` value that puts a task at position `index` among `list` (the open tasks of
 * the target quadrant, sorted, *without* the task being moved). Fractional values between
 * neighbours mean only the moved task needs saving.
 */
export function orderForIndex(list: Pick<Task, 'order'>[], index: number, now = Date.now()): number {
  const i = Math.max(0, Math.min(index, list.length))
  const prev = list[i - 1]?.order
  const next = list[i]?.order
  if (prev !== undefined && next !== undefined) return prev + (next - prev) / 2
  if (prev !== undefined) return prev + 1
  if (next !== undefined) return next - 1
  return now
}

/** Index where a dragged task lands, from the pointer's Y position and the rows' boxes. */
export function dropIndexFromY(rowRects: Array<{ top: number; height: number }>, y: number): number {
  const i = rowRects.findIndex((r) => y < r.top + r.height / 2)
  return i === -1 ? rowRects.length : i
}
