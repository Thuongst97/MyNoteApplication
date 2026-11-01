import type { JSONContent } from '@tiptap/react'

export interface MindNode {
  id: string
  text: string
  /** Free-form notes for documenting the topic. */
  note?: string
  /** Branch color override (index into the categorical palette). */
  color?: number
  collapsed?: boolean
  children: MindNode[]
}

export type MindLayout = 'balanced' | 'right'

export interface MindMap {
  root: MindNode
  layout: MindLayout
}

let counter = 0
export const nodeId = () => `n${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function newNode(text = '', children: MindNode[] = []): MindNode {
  return { id: nodeId(), text, children }
}

export function newMindMap(rootText = 'Central topic', branches: string[] = []): MindMap {
  return { root: newNode(rootText, branches.map((b) => newNode(b))), layout: 'balanced' }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function findNode(node: MindNode, id: string): MindNode | null {
  if (node.id === id) return node
  for (const c of node.children) {
    const hit = findNode(c, id)
    if (hit) return hit
  }
  return null
}

export function findParent(node: MindNode, id: string): MindNode | null {
  for (const c of node.children) {
    if (c.id === id) return node
    const hit = findParent(c, id)
    if (hit) return hit
  }
  return null
}

export function isDescendant(ancestor: MindNode, id: string): boolean {
  return ancestor.children.some((c) => c.id === id || isDescendant(c, id))
}

export function countNodes(node: MindNode): number {
  return 1 + node.children.reduce((n, c) => n + countNodes(c), 0)
}

/** All topic text and notes (for search). */
export function mindMapText(map: MindMap | null | undefined): string {
  if (!map?.root) return ''
  const out: string[] = []
  const walk = (n: MindNode) => {
    if (n.text) out.push(n.text)
    if (n.note) out.push(n.note)
    n.children.forEach(walk)
  }
  walk(map.root)
  return out.join('\n')
}

/** Accepts anything stored in a document and returns a valid mind map. */
export function normalizeMindMap(raw: unknown): MindMap {
  const r = raw as Partial<MindMap> | null
  const fix = (n: Partial<MindNode> | null | undefined, depth: number): MindNode => ({
    id: typeof n?.id === 'string' && n.id ? n.id : nodeId(),
    text: String(n?.text ?? ''),
    ...(n?.note ? { note: String(n.note) } : {}),
    ...(typeof n?.color === 'number' ? { color: n.color } : {}),
    ...(n?.collapsed ? { collapsed: true } : {}),
    children: depth > 50 || !Array.isArray(n?.children) ? [] : n!.children.map((c) => fix(c, depth + 1)),
  })
  return { root: fix(r?.root ?? { text: 'Central topic' }, 0), layout: r?.layout === 'right' ? 'right' : 'balanced' }
}

// ---------------------------------------------------------------------------
// Edits (immutable: every function returns a new map)
// ---------------------------------------------------------------------------

function edit(map: MindMap, fn: (draft: MindMap) => void): MindMap {
  const draft = structuredClone(map)
  fn(draft)
  return draft
}

export function addChild(map: MindMap, parentId: string, text = ''): { map: MindMap; id: string } {
  const child = newNode(text)
  return {
    id: child.id,
    map: edit(map, (d) => {
      const parent = findNode(d.root, parentId)
      if (!parent) return
      parent.collapsed = false
      parent.children.push(child)
    }),
  }
}

/** Adds a topic after `id` at the same level (for the root, adds a child). */
export function addSibling(map: MindMap, id: string, text = ''): { map: MindMap; id: string } {
  if (id === map.root.id) return addChild(map, id, text)
  const sib = newNode(text)
  return {
    id: sib.id,
    map: edit(map, (d) => {
      const parent = findParent(d.root, id)
      if (!parent) return
      parent.children.splice(parent.children.findIndex((c) => c.id === id) + 1, 0, sib)
    }),
  }
}

export function updateNode(map: MindMap, id: string, patch: Partial<Pick<MindNode, 'text' | 'note' | 'color' | 'collapsed'>>): MindMap {
  return edit(map, (d) => {
    const n = findNode(d.root, id)
    if (!n) return
    Object.assign(n, patch)
    if (patch.note === '') delete n.note
    if (patch.color === undefined && 'color' in patch) delete n.color
  })
}

/** Removes a topic and its sub-topics. Returns the topic to select next. The root can't be removed. */
export function removeNode(map: MindMap, id: string): { map: MindMap; select: string } {
  if (id === map.root.id) return { map, select: id }
  const parent = findParent(map.root, id)
  if (!parent) return { map, select: map.root.id }
  const i = parent.children.findIndex((c) => c.id === id)
  const next = parent.children[i + 1] ?? parent.children[i - 1] ?? parent
  return {
    select: next.id,
    map: edit(map, (d) => {
      const p = findNode(d.root, parent.id)!
      p.children.splice(i, 1)
    }),
  }
}

/**
 * Moves a topic under another topic (at `index`, default last). Refuses to move the root
 * or to move a topic into its own sub-tree.
 */
export function moveNode(map: MindMap, id: string, newParentId: string, index?: number): MindMap {
  if (id === map.root.id || id === newParentId) return map
  const node = findNode(map.root, id)
  if (!node || isDescendant(node, newParentId)) return map
  return edit(map, (d) => {
    const oldParent = findParent(d.root, id)!
    const oldIndex = oldParent.children.findIndex((c) => c.id === id)
    const [moved] = oldParent.children.splice(oldIndex, 1)
    const target = findNode(d.root, newParentId)!
    target.collapsed = false
    let at = index ?? target.children.length
    if (target === oldParent && oldIndex < at) at -= 1
    target.children.splice(Math.max(0, Math.min(at, target.children.length)), 0, moved)
  })
}

/** Moves a topic one place up/down among its siblings. */
export function reorderNode(map: MindMap, id: string, delta: -1 | 1): MindMap {
  const parent = findParent(map.root, id)
  if (!parent) return map
  const i = parent.children.findIndex((c) => c.id === id)
  const j = i + delta
  if (j < 0 || j >= parent.children.length) return map
  return edit(map, (d) => {
    const p = findNode(d.root, parent.id)!
    ;[p.children[i], p.children[j]] = [p.children[j], p.children[i]]
  })
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export interface LaidOutNode {
  id: string
  text: string
  lines: string[]
  note?: string
  depth: number
  side: 1 | -1
  /** Center */
  x: number
  y: number
  w: number
  h: number
  /** Index into the categorical palette for this branch (-1 for the root). */
  color: number
  parentId: string | null
  hiddenChildren: number
}

export interface MindLayoutResult {
  nodes: LaidOutNode[]
  byId: Map<string, LaidOutNode>
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

export type Measure = (text: string, font: string) => number

const STYLE = [
  { font: '600 18px ui-sans-serif, -apple-system, "Segoe UI", sans-serif', size: 18, padX: 18, padY: 12, lineH: 24 },
  { font: '600 15px ui-sans-serif, -apple-system, "Segoe UI", sans-serif', size: 15, padX: 14, padY: 8, lineH: 20 },
  { font: '400 14px ui-sans-serif, -apple-system, "Segoe UI", sans-serif', size: 14, padX: 10, padY: 6, lineH: 19 },
]
export const levelStyle = (depth: number) => STYLE[Math.min(depth, 2)]

const MAX_TEXT_W = 220
const H_GAP = 56
const V_GAP = 14
export const PALETTE_SIZE = 8

let ctx: CanvasRenderingContext2D | null | undefined
/** Text width in px (canvas when available, otherwise an estimate). */
export const defaultMeasure: Measure = (text, font) => {
  if (ctx === undefined) {
    try {
      ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null
    } catch {
      ctx = null
    }
  }
  if (ctx) {
    ctx.font = font
    return ctx.measureText(text).width
  }
  const size = Number(/(\d+)px/.exec(font)?.[1] ?? 14)
  return text.length * size * 0.55
}

/** Word-wraps text to MAX_TEXT_W. */
export function wrapText(text: string, font: string, measure: Measure): string[] {
  const words = (text || ' ').split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const tryLine = line ? `${line} ${w}` : w
    if (line && measure(tryLine, font) > MAX_TEXT_W) {
      lines.push(line)
      line = w
    } else line = tryLine
  }
  lines.push(line)
  return lines.slice(0, 6)
}

/**
 * Lays the map out as a horizontal tree around the root. In "balanced" mode first-level
 * branches are split between the right and left side by size.
 */
export function layoutMindMap(map: MindMap, measure: Measure = defaultMeasure): MindLayoutResult {
  const nodes: LaidOutNode[] = []
  const sized = new Map<string, { w: number; h: number; lines: string[] }>()
  const size = (n: MindNode, depth: number) => {
    let s = sized.get(n.id)
    if (!s) {
      const st = levelStyle(depth)
      const lines = wrapText(n.text || (depth === 0 ? 'Central topic' : 'Topic'), st.font, measure)
      const textW = Math.max(...lines.map((l) => measure(l, st.font)))
      s = { w: Math.max(depth === 0 ? 120 : 56, Math.ceil(textW) + st.padX * 2), h: lines.length * st.lineH + st.padY * 2, lines }
      sized.set(n.id, s)
    }
    return s
  }
  const visibleChildren = (n: MindNode) => (n.collapsed ? [] : n.children)
  const subtreeH = (n: MindNode, depth: number): number => {
    const kids = visibleChildren(n)
    const own = size(n, depth).h
    if (!kids.length) return own
    const sum = kids.reduce((t, c) => t + subtreeH(c, depth + 1), 0) + V_GAP * (kids.length - 1)
    return Math.max(own, sum)
  }

  const place = (n: MindNode, depth: number, side: 1 | -1, anchorX: number, cy: number, color: number, parentId: string | null) => {
    const s = size(n, depth)
    const x = anchorX + (side * s.w) / 2
    nodes.push({ id: n.id, text: n.text, lines: s.lines, note: n.note, depth, side, x, y: cy, w: s.w, h: s.h, color, parentId, hiddenChildren: n.collapsed ? countNodes(n) - 1 : 0 })
    placeChildren(visibleChildren(n), depth + 1, side, x + (side * s.w) / 2 + side * H_GAP, cy, color, n.id)
  }
  // Sub-topics inherit their branch's color.
  const placeChildren = (kids: MindNode[], depth: number, side: 1 | -1, anchorX: number, cy: number, color: number, parentId: string) => {
    const heights = kids.map((k) => subtreeH(k, depth))
    const total = heights.reduce((a, b) => a + b, 0) + V_GAP * Math.max(0, kids.length - 1)
    let y = cy - total / 2
    kids.forEach((k, i) => {
      place(k, depth, side, anchorX, y + heights[i] / 2, color, parentId)
      y += heights[i] + V_GAP
    })
  }

  const root = map.root
  const rs = size(root, 0)
  nodes.push({ id: root.id, text: root.text, lines: rs.lines, note: root.note, depth: 0, side: 1, x: 0, y: 0, w: rs.w, h: rs.h, color: -1, parentId: null, hiddenChildren: root.collapsed ? countNodes(root) - 1 : 0 })

  const kids = visibleChildren(root)
  // Assign first-level colors by original index so colors stay put when sides change.
  const colored = kids.map((k, i) => ({ k, color: (typeof k.color === 'number' ? k.color : i) % PALETTE_SIZE }))
  let right = colored
  let left: typeof colored = []
  if (map.layout === 'balanced' && kids.length > 1) {
    const total = colored.reduce((t, c) => t + subtreeH(c.k, 1), 0)
    let acc = 0
    const cut = colored.findIndex((c) => (acc += subtreeH(c.k, 1)) >= total / 2)
    right = colored.slice(0, Math.max(1, cut + 1))
    left = colored.slice(right.length)
  }
  const side = (list: typeof colored, dir: 1 | -1) => {
    const heights = list.map((c) => subtreeH(c.k, 1))
    const total = heights.reduce((a, b) => a + b, 0) + V_GAP * Math.max(0, list.length - 1)
    let y = -total / 2
    list.forEach((c, i) => {
      place(c.k, 1, dir, (dir * rs.w) / 2 + dir * H_GAP, y + heights[i] / 2, c.color, root.id)
      y += heights[i] + V_GAP
    })
  }
  side(right, 1)
  side(left.reverse(), -1) // left side reads top-to-bottom in reverse so it wraps around the root

  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const n of nodes) {
    bounds.minX = Math.min(bounds.minX, n.x - n.w / 2)
    bounds.maxX = Math.max(bounds.maxX, n.x + n.w / 2)
    bounds.minY = Math.min(bounds.minY, n.y - n.h / 2)
    bounds.maxY = Math.max(bounds.maxY, n.y + n.h / 2)
  }
  return { nodes, byId: new Map(nodes.map((n) => [n.id, n])), bounds }
}

/** Arrow-key navigation over the laid-out map. */
export function navigate(map: MindMap, layout: MindLayoutResult, id: string, key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'): string {
  const cur = layout.byId.get(id)
  if (!cur) return map.root.id
  const node = findNode(map.root, id)!
  const parentId = cur.parentId
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    // Nearest visible topic above/below on the same side and level, otherwise any level.
    const dir = key === 'ArrowUp' ? -1 : 1
    const candidates = layout.nodes.filter((n) => n.id !== id && n.side === cur.side && n.depth > 0 && (n.y - cur.y) * dir > 0)
    const sameDepth = candidates.filter((n) => n.depth === cur.depth)
    const pool = sameDepth.length ? sameDepth : candidates
    pool.sort((a, b) => Math.abs(a.y - cur.y) - Math.abs(b.y - cur.y))
    return pool[0]?.id ?? id
  }
  const outward = (key === 'ArrowRight' ? 1 : -1) === cur.side
  if (cur.depth === 0) {
    // From the root: go to the first branch on that side.
    const side = key === 'ArrowRight' ? 1 : -1
    const first = layout.nodes.filter((n) => n.depth === 1 && n.side === side).sort((a, b) => Math.abs(a.y) - Math.abs(b.y))[0]
    return first?.id ?? id
  }
  if (outward) {
    const kids = node.collapsed ? [] : node.children
    if (!kids.length) return id
    const laid = kids.map((k) => layout.byId.get(k.id)!).filter(Boolean)
    laid.sort((a, b) => Math.abs(a.y - cur.y) - Math.abs(b.y - cur.y))
    return laid[0]?.id ?? id
  }
  return parentId ?? id
}

// ---------------------------------------------------------------------------
// Conversion to/from lists (documents)
// ---------------------------------------------------------------------------

const LIST_TYPES = new Set(['bulletList', 'orderedList', 'taskList'])

function inlineText(node: JSONContent | undefined): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'mention') return String(node.attrs?.label || '')
  if (node.type === 'hardBreak') return ' '
  return (node.content ?? []).map(inlineText).join('')
}

/** Turns a (nested) bulleted/numbered/to-do list into a mind map. */
export function listToMindMap(list: JSONContent, rootText = 'Central topic'): MindMap {
  const fromItems = (items: JSONContent[] = []): MindNode[] =>
    items.map((item) => {
      const blocks = item.content ?? []
      const text = blocks.filter((b) => !LIST_TYPES.has(b.type ?? '')).map(inlineText).join(' ').trim()
      const sub = blocks.filter((b) => LIST_TYPES.has(b.type ?? '')).flatMap((b) => fromItems(b.content))
      return newNode(text, sub)
    })
  const branches = fromItems(list.content)
  // A list with a single top item becomes that item's map.
  if (branches.length === 1 && branches[0].children.length) return { root: branches[0], layout: 'balanced' }
  return { root: newNode(rootText, branches), layout: 'balanced' }
}

/** Turns a mind map into a heading-less outline: the root as a bold line followed by a nested bullet list. */
export function mindMapToList(map: MindMap): JSONContent[] {
  const items = (nodes: MindNode[]): JSONContent => ({
    type: 'bulletList',
    content: nodes.map((n) => ({
      type: 'listItem',
      content: [
        { type: 'paragraph', content: n.text ? [{ type: 'text', text: n.text }] : [] },
        ...(n.children.length ? [items(n.children)] : []),
      ],
    })),
  })
  const root: JSONContent = { type: 'paragraph', content: map.root.text ? [{ type: 'text', text: map.root.text, marks: [{ type: 'bold' }] }] : [] }
  return map.root.children.length ? [root, items(map.root.children)] : [root]
}
