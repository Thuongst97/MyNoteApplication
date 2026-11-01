import { describe, expect, it } from 'vitest'
import { dropIndexFromY, orderForIndex, sortByPriority } from '@/lib/taskOrder'
import type { Task } from '@/types'

const t = (id: string, order: number, extra: Partial<Task> = {}): Task =>
  ({ id, title: id, notes: '', important: true, urgent: true, dueAt: null, reminders: [], completed: false, completedAt: null, order, createdAt: 0, updatedAt: 0, sentReminders: [], ...extra }) as Task

describe('task priority order', () => {
  it('sorts open tasks by manual order, completed tasks last', () => {
    const list = [t('c', 30), t('done', 1, { completed: true, completedAt: 5 }), t('a', 10), t('b', 20, { dueAt: 1 })]
    expect(list.sort(sortByPriority).map((x) => x.id)).toEqual(['a', 'b', 'c', 'done'])
  })

  it('computes an order between neighbours, at the start, at the end and in an empty list', () => {
    const list = [{ order: 10 }, { order: 20 }, { order: 30 }]
    expect(orderForIndex(list, 0)).toBe(9)
    expect(orderForIndex(list, 1)).toBe(15)
    expect(orderForIndex(list, 3)).toBe(31)
    expect(orderForIndex(list, 99)).toBe(31)
    expect(orderForIndex([], 0, 1234)).toBe(1234)
    // Many moves into the same gap keep strictly increasing values.
    let lo = 10
    for (let i = 0; i < 40; i++) {
      const o = orderForIndex([{ order: lo }, { order: 11 }], 1)
      expect(o).toBeGreaterThan(lo)
      expect(o).toBeLessThan(11)
      lo = o
    }
  })

  it('finds the drop position from the pointer', () => {
    const rows = [{ top: 0, height: 40 }, { top: 48, height: 40 }, { top: 96, height: 40 }]
    expect(dropIndexFromY(rows, 5)).toBe(0)
    expect(dropIndexFromY(rows, 30)).toBe(1)
    expect(dropIndexFromY(rows, 70)).toBe(2) // past the middle of row 1
    expect(dropIndexFromY(rows, 130)).toBe(3)
    expect(dropIndexFromY([], 10)).toBe(0)
  })
})
