import type { JSONContent } from '@tiptap/react'
import { slideTheme, type ThemeId } from './slideThemes'

/**
 * Presentation pages (PowerPoint-like): a list of slides, each a small rich-text document
 * (all the editor's blocks work on a slide) with a layout and a background.
 */
export type SlideLayout = 'title' | 'content' | 'blank'
export type SlideBackground = 'default' | 'white' | 'sand' | 'blue' | 'green' | 'purple' | 'pink' | 'navy' | 'charcoal'

export type SlideTransition = 'none' | 'fade' | 'push' | 'wipe' | 'zoom'
export type AnimEffect = 'appear' | 'fade' | 'fly-up' | 'fly-left' | 'zoom'

/** A block that appears on click while presenting (lists can appear item by item). */
export interface SlideAnimation {
  blockId: string
  effect: AnimEffect
  byItem?: boolean
}

/** A pen or highlighter stroke, in slide coordinates (1280×720): points = [x0, y0, x1, y1, …]. */
export interface InkStroke {
  tool: 'pen' | 'highlighter'
  color: string
  width: number
  points: number[]
}

/** A rectangle on the slide, in slide coordinates (1280×720). */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * A movable object on a slide (PowerPoint "shape"): its own blocks (text, chart, code,
 * diagram…) at a position. Its height follows its content.
 */
export interface SlideBox {
  id: string
  x: number
  y: number
  w: number
  content: JSONContent
}

export const SLIDE_W = 1280
export const SLIDE_H = 720
export const PAD_X = 88
export const PAD_Y = 64
/** Where a slide's main text area is unless moved. */
export const MAIN_FRAME: Rect = { x: PAD_X, y: PAD_Y, w: SLIDE_W - PAD_X * 2, h: SLIDE_H - PAD_Y * 2 }
export const MIN_BOX_W = 80
export const MIN_BOX_H = 60
const MAX_BOXES = 100

export interface SlideData {
  id: string
  layout: SlideLayout
  background: SlideBackground
  /** The main text area (title, bullets…). */
  content: JSONContent
  /** Position of the main text area (default MAIN_FRAME). */
  frame?: Rect
  /** Other objects on the slide, back to front. */
  boxes?: SlideBox[]
  /** Skipped when presenting. */
  hidden?: boolean
  /** Speaker notes. */
  notes?: string
  transition?: SlideTransition
  animations?: SlideAnimation[]
  ink?: InkStroke[]
}

/** Footer shown on every slide (PowerPoint's "Header & Footer"). */
export interface FooterSettings {
  /** "03 / 12" at the bottom right. */
  slideNumbers: boolean
  /** Text at the bottom left (e.g. the deck title or a company name). */
  text?: string
  /** Date shown next to the text. */
  date?: string
  /** Not on title slides (default on). */
  hideOnTitle?: boolean
}

export interface PresentationContent {
  type: 'slides'
  slides: SlideData[]
  /** Look of the whole deck (see slideThemes.ts); none = plain. */
  theme?: ThemeId
  footer?: FooterSettings
}

export const LAYOUTS: Array<{ id: SlideLayout; label: string }> = [
  { id: 'title', label: 'Title slide' },
  { id: 'content', label: 'Title & content' },
  { id: 'blank', label: 'Blank' },
]

/** Slide backgrounds; `dark` ones use light text. */
export const SLIDE_BACKGROUNDS: Record<SlideBackground, { label: string; color: string | null; dark?: boolean }> = {
  default: { label: 'Default', color: null },
  white: { label: 'White', color: '#ffffff' },
  sand: { label: 'Sand', color: '#f4ece6' },
  blue: { label: 'Blue', color: '#e7f3f8' },
  green: { label: 'Green', color: '#edf3ec' },
  purple: { label: 'Purple', color: '#f3eefa' },
  pink: { label: 'Pink', color: '#fbeef3' },
  navy: { label: 'Navy', color: '#1e293b', dark: true },
  charcoal: { label: 'Charcoal', color: '#262626', dark: true },
}

export const TRANSITIONS: Array<{ id: SlideTransition; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'fade', label: 'Fade' },
  { id: 'push', label: 'Push' },
  { id: 'wipe', label: 'Wipe' },
  { id: 'zoom', label: 'Zoom' },
]

export const ANIM_EFFECTS: Array<{ id: AnimEffect; label: string }> = [
  { id: 'appear', label: 'Appear' },
  { id: 'fade', label: 'Fade in' },
  { id: 'fly-up', label: 'Fly in (up)' },
  { id: 'fly-left', label: 'Fly in (side)' },
  { id: 'zoom', label: 'Zoom' },
]

export const INK_COLORS = ['#1f1f1f', '#e03e3e', '#2383e2', '#0f9d58', '#f59e0b', '#9333ea', '#ffffff']
export const HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#7dd3fc', '#f9a8d4', '#fdba74']
const MAX_STROKES = 1000
const MAX_POINTS = 20000
const HEX = /^#[0-9a-f]{6}$/i

const ID = /^[A-Za-z0-9_-]{1,64}$/
const rid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`)

const heading = (level: number, text: string): JSONContent => ({ type: 'heading', attrs: { level }, content: text ? [{ type: 'text', text }] : [] })
const paragraph = (text = ''): JSONContent => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })

/** A new slide with starter content for its layout. */
export function newSlide(layout: SlideLayout = 'content', title = ''): SlideData {
  const content: JSONContent =
    layout === 'title'
      ? { type: 'doc', content: [heading(1, title), paragraph()] }
      : layout === 'content'
        ? { type: 'doc', content: [heading(2, title), { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph()] }] }] }
        : { type: 'doc', content: [paragraph()] }
  return { id: rid(), layout, background: 'default', content }
}

/** A new presentation: a title slide and one content slide. */
export function newPresentation(title = ''): PresentationContent {
  return { type: 'slides', slides: [newSlide('title', title), newSlide('content')] }
}

/** Makes stored or imported presentation content safe to use (unknown values → defaults). */
export function normalizePresentation(raw: unknown): PresentationContent {
  const r = raw as { type?: unknown; slides?: unknown } | null
  const list = r && r.type === 'slides' && Array.isArray(r.slides) ? r.slides : []
  const seen = new Set<string>()
  const slides: SlideData[] = []
  for (const s of list as Array<Partial<SlideData>>) {
    if (!s || typeof s !== 'object') continue
    let id = typeof s.id === 'string' && ID.test(s.id) ? s.id : rid()
    if (seen.has(id)) id = rid()
    seen.add(id)
    const layout: SlideLayout = s.layout === 'title' || s.layout === 'blank' ? s.layout : 'content'
    const background: SlideBackground = typeof s.background === 'string' && s.background in SLIDE_BACKGROUNDS ? (s.background as SlideBackground) : 'default'
    const content: JSONContent = s.content && typeof s.content === 'object' && (s.content as JSONContent).type === 'doc' ? (s.content as JSONContent) : { type: 'doc', content: [paragraph()] }
    const slide: SlideData = { id, layout, background, content }
    if (typeof s.transition === 'string' && TRANSITIONS.some((t) => t.id === s.transition) && s.transition !== 'none') slide.transition = s.transition
    const anims = normalizeAnimations(s.animations)
    if (anims.length) slide.animations = anims
    const ink = normalizeInk(s.ink)
    if (ink.length) slide.ink = ink
    const frame = normalizeRect(s.frame)
    if (frame) slide.frame = frame
    const boxes = normalizeBoxes(s.boxes, seen)
    if (boxes.length) slide.boxes = boxes
    if (s.hidden === true) slide.hidden = true
    if (typeof s.notes === 'string' && s.notes) slide.notes = s.notes.slice(0, 20000)
    slides.push(slide)
  }
  const out: PresentationContent = { type: 'slides', slides: slides.length ? slides : newPresentation().slides }
  const theme = slideTheme((r as { theme?: unknown } | null)?.theme)
  if (theme) out.theme = theme.id
  const footer = normalizeFooter((r as { footer?: unknown } | null)?.footer)
  if (footer) out.footer = footer
  return out
}

function textOf(n: JSONContent | undefined): string {
  if (!n) return ''
  if (n.type === 'text') return n.text ?? ''
  return (n.content ?? []).map(textOf).join(n.content?.some((c) => c.type !== 'text') ? ' ' : '')
}

/** A slide's title (its first heading, else its first text) for thumbnails and the outline. */
export function slideTitle(slide: SlideData, index: number): string {
  const blocks = slide.content.content ?? []
  const h = blocks.find((b) => b.type === 'heading')
  const t = textOf(h ?? blocks.find((b) => textOf(b).trim())).trim()
  return t || `Slide ${index + 1}`
}

/** Copy of a document whose block ids are replaced by new ones (old → new recorded in `map`). */
function withNewBlockIds(n: JSONContent, map: Map<string, string>): JSONContent {
  const out: JSONContent = { ...n }
  if (n.attrs && 'blockId' in n.attrs) {
    const { blockId, ...attrs } = n.attrs
    if (typeof blockId === 'string' && blockId) {
      const fresh = rid()
      map.set(blockId, fresh)
      out.attrs = { ...attrs, blockId: fresh }
    } else out.attrs = attrs
  }
  if (n.content) out.content = n.content.map((c) => withNewBlockIds(c, map))
  return out
}

/** Inserts a copy of slide `id` right after it. */
export function duplicateSlide(slides: SlideData[], id: string): { slides: SlideData[]; id: string | null } {
  const i = slides.findIndex((s) => s.id === id)
  if (i < 0) return { slides, id: null }
  // Block ids must stay unique in the page; the copy's animations follow its new ids.
  const map = new Map<string, string>()
  const src = slides[i]
  const copy: SlideData = { ...structuredClone(src), id: rid(), content: withNewBlockIds(structuredClone(src.content), map) }
  if (src.boxes)
    copy.boxes = src.boxes.map((b) => {
      const id = rid()
      map.set(b.id, id)
      return { ...b, id, content: withNewBlockIds(structuredClone(b.content), map) }
    })
  if (src.animations) copy.animations = src.animations.flatMap((a) => (map.has(a.blockId) ? [{ ...a, blockId: map.get(a.blockId)! }] : []))
  return { slides: [...slides.slice(0, i + 1), copy, ...slides.slice(i + 1)], id: copy.id }
}

/** Moves slide `id` to position `to` (in the list without it). */
export function moveSlide(slides: SlideData[], id: string, to: number): SlideData[] {
  const from = slides.findIndex((s) => s.id === id)
  if (from < 0) return slides
  const next = [...slides]
  const [s] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(next.length, to)), 0, s)
  return next
}

function normalizeAnimations(raw: unknown): SlideAnimation[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: SlideAnimation[] = []
  for (const a of raw as Array<Partial<SlideAnimation>>) {
    if (!a || typeof a.blockId !== 'string' || !ID.test(a.blockId) || seen.has(a.blockId)) continue
    if (!ANIM_EFFECTS.some((e) => e.id === a.effect)) continue
    seen.add(a.blockId)
    out.push({ blockId: a.blockId, effect: a.effect as AnimEffect, ...(a.byItem === true && { byItem: true }) })
  }
  return out.slice(0, 200)
}

/** Keeps only well-formed strokes (bounded in number and size). */
export function normalizeInk(raw: unknown): InkStroke[] {
  if (!Array.isArray(raw)) return []
  const out: InkStroke[] = []
  for (const s of raw as Array<Partial<InkStroke>>) {
    if (!s || (s.tool !== 'pen' && s.tool !== 'highlighter') || typeof s.color !== 'string' || !HEX.test(s.color)) continue
    const width = Number(s.width)
    if (!Number.isFinite(width) || width <= 0) continue
    if (!Array.isArray(s.points) || s.points.length < 2) continue
    const points = s.points.slice(0, MAX_POINTS - (MAX_POINTS % 2)).map((v) => Math.round(Number(v) * 10) / 10)
    if (points.length % 2 || points.some((v) => !Number.isFinite(v) || Math.abs(v) > 10000)) continue
    out.push({ tool: s.tool, color: s.color.toLowerCase(), width: Math.min(80, width), points })
    if (out.length >= MAX_STROKES) break
  }
  return out
}

/** One click while presenting: reveal a block (or one item of a list block). */
export interface BuildStep {
  /** Index of the block among the main text area's top-level blocks (-1 for a whole box). */
  block: number
  /** A whole box that appears (its id). */
  box?: string
  /** Index of the list item (when a list appears item by item). */
  item?: number
  effect: AnimEffect
}

/** The clicks of a slide's animations, in order (animations of deleted blocks are skipped). */
export function buildSteps(slide: SlideData): BuildStep[] {
  const blocks = slide.content.content ?? []
  const steps: BuildStep[] = []
  const boxIds = new Set((slide.boxes ?? []).map((b) => b.id))
  for (const a of slide.animations ?? []) {
    if (boxIds.has(a.blockId)) {
      steps.push({ block: -1, box: a.blockId, effect: a.effect })
      continue
    }
    const block = blocks.findIndex((b) => b.attrs?.blockId === a.blockId)
    if (block < 0) continue
    const items = blocks[block].content?.length ?? 0
    const isList = ['bulletList', 'orderedList', 'taskList'].includes(blocks[block].type ?? '')
    if (a.byItem && isList && items > 0) for (let i = 0; i < items; i++) steps.push({ block, item: i, effect: a.effect })
    else steps.push({ block, effect: a.effect })
  }
  return steps
}

/**
 * CSS for a slide shown at `shown` revealed steps (out of `steps`): later steps are hidden,
 * the last revealed one plays its effect. Selectors are scoped under `scope`.
 */
export function buildCss(scope: string, steps: BuildStep[], shown: number, animate = true): string {
  const sel = (s: BuildStep) =>
    s.box
      ? `${scope} [data-box-id="${s.box}"]`
      : `${scope} .slide-main .ProseMirror > :nth-child(${s.block + 1})${s.item !== undefined ? ` > :nth-child(${s.item + 1})` : ''}`
  const rules: string[] = []
  steps.forEach((s, i) => {
    if (i >= shown) rules.push(`${sel(s)} { visibility: hidden; }`)
    else if (animate && i === shown - 1 && s.effect !== 'appear') rules.push(`${sel(s)} { animation: pn-build-${s.effect} 520ms cubic-bezier(.2,.7,.2,1) both; }`)
  })
  // A list whose items appear one by one: the list itself is visible, its items aren't.
  return rules.join('\n')
}

/** Next position (slide, step) when moving forward/back through a show. */
export function showStep(slides: SlideData[], pos: { slide: number; step: number }, dir: 1 | -1): { slide: number; step: number } {
  const steps = buildSteps(slides[pos.slide] ?? slides[0]).length
  if (dir === 1) {
    if (pos.step < steps) return { slide: pos.slide, step: pos.step + 1 }
    return pos.slide < slides.length - 1 ? { slide: pos.slide + 1, step: 0 } : pos
  }
  if (pos.step > 0) return { slide: pos.slide, step: pos.step - 1 }
  if (pos.slide === 0) return pos
  // Back to the previous slide shows it complete.
  return { slide: pos.slide - 1, step: buildSteps(slides[pos.slide - 1]).length }
}

/** SVG path for a stroke (smoothed through the midpoints). */
export function strokePath(points: number[]): string {
  const n = points.length / 2
  if (n === 0) return ''
  const p = (i: number) => `${points[i * 2]} ${points[i * 2 + 1]}`
  if (n === 1) return `M${p(0)} L${points[0] + 0.1} ${points[1]}`
  if (n === 2) return `M${p(0)} L${p(1)}`
  let d = `M${p(0)}`
  for (let i = 1; i < n - 1; i++) {
    const mx = (points[i * 2] + points[i * 2 + 2]) / 2
    const my = (points[i * 2 + 1] + points[i * 2 + 3]) / 2
    d += ` Q${p(i)} ${Math.round(mx * 10) / 10} ${Math.round(my * 10) / 10}`
  }
  return `${d} L${p(n - 1)}`
}

/** Does the eraser at (x, y) with radius r touch the stroke? */
export function strokeHit(s: InkStroke, x: number, y: number, r: number): boolean {
  const reach = r + s.width / 2
  const pts = s.points
  for (let i = 0; i < pts.length; i += 2) {
    const ax = pts[i], ay = pts[i + 1]
    const bx = pts[i + 2] ?? ax, by = pts[i + 3] ?? ay
    // Distance from the point to segment a–b.
    const dx = bx - ax, dy = by - ay
    const len = dx * dx + dy * dy
    const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0
    const cx = ax + t * dx - x, cy = ay + t * dy - y
    if (cx * cx + cy * cy <= reach * reach) return true
  }
  return false
}

const clampNum = (v: unknown, lo: number, hi: number): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(Math.max(lo, Math.min(hi, n))) : null
}

/** A well-formed rectangle that stays (mostly) on the slide, or null. */
export function normalizeRect(raw: unknown): Rect | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<Rect>
  const w = clampNum(r.w, MIN_BOX_W, SLIDE_W)
  const h = clampNum(r.h, MIN_BOX_H, SLIDE_H)
  const x = clampNum(r.x, -SLIDE_W / 2, SLIDE_W - 20)
  const y = clampNum(r.y, -SLIDE_H / 2, SLIDE_H - 20)
  return w === null || h === null || x === null || y === null ? null : { x, y, w, h }
}

function normalizeBoxes(raw: unknown, seen: Set<string>): SlideBox[] {
  if (!Array.isArray(raw)) return []
  const out: SlideBox[] = []
  for (const b of raw as Array<Partial<SlideBox>>) {
    if (!b || typeof b !== 'object') continue
    const rect = normalizeRect({ x: b.x, y: b.y, w: b.w, h: MIN_BOX_H })
    if (!rect) continue
    let id = typeof b.id === 'string' && ID.test(b.id) ? b.id : rid()
    if (seen.has(id)) id = rid()
    seen.add(id)
    const content = b.content && typeof b.content === 'object' && (b.content as JSONContent).type === 'doc' ? (b.content as JSONContent) : { type: 'doc', content: [paragraph()] }
    out.push({ id, x: rect.x, y: rect.y, w: rect.w, content })
    if (out.length >= MAX_BOXES) break
  }
  return out
}

/** Every block document of a slide: the main text area, then the boxes. */
export function slideDocs(slide: Pick<SlideData, 'content' | 'boxes'>): JSONContent[] {
  return [slide.content, ...(slide.boxes ?? []).map((b) => b.content)]
}

/** A new box (default: a text box in the middle of the slide). */
export function newBox(at: Partial<Pick<SlideBox, 'x' | 'y' | 'w'>> = {}, content?: JSONContent): SlideBox {
  const w = at.w ?? 560
  return { id: rid(), x: at.x ?? Math.round((SLIDE_W - w) / 2), y: at.y ?? 260, w, content: content ?? { type: 'doc', content: [paragraph()] } }
}

/** Snap distance (slide px) for moving boxes. */
export const SNAP = 8

/**
 * Snaps a box being moved to the slide's center lines and edges and to other boxes' edges and
 * centers. Returns the snapped position and the guide lines to draw.
 */
export function snapBox(
  box: Rect,
  others: Rect[],
): { x: number; y: number; guides: Array<{ axis: 'x' | 'y'; at: number }> } {
  const xs = [0, SLIDE_W / 2, SLIDE_W, PAD_X, SLIDE_W - PAD_X, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])]
  const ys = [0, SLIDE_H / 2, SLIDE_H, PAD_Y, SLIDE_H - PAD_Y, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])]
  const pick = (pos: number, size: number, lines: number[]) => {
    let best: { d: number; to: number; at: number } | null = null
    for (const edge of [0, size / 2, size]) {
      for (const l of lines) {
        const d = Math.abs(pos + edge - l)
        if (d <= SNAP && (!best || d < best.d)) best = { d, to: l - edge, at: l }
      }
    }
    return best
  }
  const gx = pick(box.x, box.w, xs)
  const gy = pick(box.y, box.h, ys)
  const guides: Array<{ axis: 'x' | 'y'; at: number }> = []
  if (gx) guides.push({ axis: 'x', at: gx.at })
  if (gy) guides.push({ axis: 'y', at: gy.at })
  return { x: Math.round(gx ? gx.to : box.x), y: Math.round(gy ? gy.to : box.y), guides }
}

/** A copy of a box (new id and block ids), shifted a little so both are visible. */
export function cloneBox(box: SlideBox, offset = 24): SlideBox {
  return { ...box, id: rid(), x: box.x + offset, y: box.y + offset, content: withNewBlockIds(structuredClone(box.content), new Map()) }
}

/** A stored footer setting with unknown values dropped (null: no footer). */
export function normalizeFooter(raw: unknown): FooterSettings | null {
  if (!raw || typeof raw !== 'object') return null
  const f = raw as Partial<FooterSettings>
  const out: FooterSettings = { slideNumbers: f.slideNumbers === true }
  if (typeof f.text === 'string' && f.text.trim()) out.text = f.text.slice(0, 120)
  if (typeof f.date === 'string' && f.date.trim()) out.date = f.date.slice(0, 60)
  if (f.hideOnTitle === false) out.hideOnTitle = false
  return out.slideNumbers || out.text || out.date ? out : null
}

/** Does the footer show on this slide? */
export function footerShown(footer: FooterSettings | undefined | null, slide: Pick<SlideData, 'layout'>): boolean {
  if (!footer || !(footer.slideNumbers || footer.text || footer.date)) return false
  return !(slide.layout === 'title' && footer.hideOnTitle !== false)
}

export type AlignHow = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

/** Where a rectangle goes when aligned to the slide (margins for edges, the middle for centers). */
export function alignRect(r: Rect, how: AlignHow): { x: number; y: number } {
  switch (how) {
    case 'left':
      return { x: PAD_X, y: r.y }
    case 'center':
      return { x: Math.round((SLIDE_W - r.w) / 2), y: r.y }
    case 'right':
      return { x: SLIDE_W - PAD_X - r.w, y: r.y }
    case 'top':
      return { x: r.x, y: PAD_Y }
    case 'middle':
      return { x: r.x, y: Math.round((SLIDE_H - r.h) / 2) }
    case 'bottom':
      return { x: r.x, y: SLIDE_H - PAD_Y - r.h }
  }
}
