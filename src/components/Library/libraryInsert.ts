import type { LibraryItem } from '@/lib/libraries'

type El = Record<string, unknown> & { id: string; x: number; y: number; width?: number; height?: number }

const newId = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4)

/**
 * Copies a library item's elements with fresh ids (keeping groups, bound text and
 * arrow bindings connected) and moves them so they're centered on (cx, cy).
 */
export function cloneItemElements(item: Pick<LibraryItem, 'elements'>, cx: number, cy: number): El[] {
  const src = item.elements as El[]
  const ids = new Map<string, string>()
  const groups = new Map<string, string>()
  for (const e of src) ids.set(e.id, newId())
  const map = (id: unknown) => (typeof id === 'string' ? (ids.get(id) ?? id) : id)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const e of src) {
    minX = Math.min(minX, e.x)
    minY = Math.min(minY, e.y)
    maxX = Math.max(maxX, e.x + (e.width ?? 0))
    maxY = Math.max(maxY, e.y + (e.height ?? 0))
  }
  const dx = cx - (minX + maxX) / 2
  const dy = cy - (minY + maxY) / 2

  return src.map((e) => {
    const c: El = { ...e, id: ids.get(e.id)!, x: e.x + dx, y: e.y + dy, seed: Math.floor(Math.random() * 2 ** 31), version: 1, versionNonce: Math.floor(Math.random() * 2 ** 31) }
    if (Array.isArray(e.groupIds)) c.groupIds = (e.groupIds as string[]).map((g) => groups.get(g) ?? (groups.set(g, newId()), groups.get(g)!))
    if (Array.isArray(e.boundElements)) c.boundElements = (e.boundElements as Array<{ id: string; type: string }>).map((b) => ({ ...b, id: map(b.id) as string }))
    if (e.containerId) c.containerId = map(e.containerId)
    if (e.frameId) c.frameId = map(e.frameId)
    for (const key of ['startBinding', 'endBinding'] as const) {
      const b = e[key] as { elementId?: string } | null | undefined
      if (b?.elementId) c[key] = { ...b, elementId: map(b.elementId) }
    }
    return c
  })
}
