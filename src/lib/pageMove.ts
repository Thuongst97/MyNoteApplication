import type { PageMeta } from '@/types'

/** Where a dragged page lands relative to the row under the pointer. */
export type DropPosition = 'before' | 'after' | 'inside'

/** Which part of a row the pointer is over: top/bottom quarter → before/after, middle → inside. */
export function dropPositionAt(offsetY: number, height: number): DropPosition {
  const f = height > 0 ? offsetY / height : 0.5
  return f < 0.25 ? 'before' : f > 0.75 ? 'after' : 'inside'
}

/** Whether `id` is `ancestorId` or lies under it. */
export function isWithin(pages: PageMeta[], id: string | null, ancestorId: string): boolean {
  const byId = new Map(pages.map((p) => [p.id, p]))
  for (let cur = id, guard = 0; cur && guard < 10000; guard++) {
    if (cur === ancestorId) return true
    cur = byId.get(cur)?.parentId ?? null
  }
  return false
}

const sortedChildren = (pages: PageMeta[], parentId: string | null, without: string) =>
  pages.filter((p) => p.parentId === parentId && p.id !== without).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)

/**
 * The new parent and sort order of page `dragId` dropped on `targetId` (null target: the end
 * of the top level). Null when the move is impossible (onto itself or into its own sub-pages)
 * or changes nothing.
 */
export function planMove(pages: PageMeta[], dragId: string, targetId: string | null, position: DropPosition): { parentId: string | null; order: number } | null {
  const drag = pages.find((p) => p.id === dragId)
  if (!drag) return null
  if (targetId === null) {
    const roots = sortedChildren(pages, null, dragId)
    const last = roots[roots.length - 1]
    return { parentId: null, order: last ? last.order + 1000 : drag.order }
  }
  const target = pages.find((p) => p.id === targetId)
  if (!target || targetId === dragId) return null
  const parentId = position === 'inside' ? target.id : target.parentId
  if (parentId && isWithin(pages, parentId, dragId)) return null

  let order: number
  if (position === 'inside') {
    const kids = sortedChildren(pages, target.id, dragId)
    order = kids.length ? kids[kids.length - 1].order + 1000 : Date.now()
  } else {
    const sibs = sortedChildren(pages, parentId, dragId)
    const i = sibs.findIndex((p) => p.id === target.id)
    const prev = position === 'before' ? sibs[i - 1] : target
    const next = position === 'before' ? target : sibs[i + 1]
    order = prev && next ? (prev.order + next.order) / 2 : prev ? prev.order + 1000 : next ? next.order - 1000 : Date.now()
  }
  if (parentId === drag.parentId) {
    // Same place as before: nothing to do.
    const sibs = sortedChildren(pages, parentId, dragId)
    const before = sibs.filter((p) => p.order < drag.order || (p.order === drag.order && p.createdAt < drag.createdAt)).length
    const after = sibs.filter((p) => p.order < order).length
    if (before === after) return null
  }
  return { parentId, order }
}
