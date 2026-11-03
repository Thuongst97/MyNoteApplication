import type { JSONContent } from '@tiptap/react'

/**
 * Presentation pages (PowerPoint-like): a list of slides, each a small rich-text document
 * (all the editor's blocks work on a slide) with a layout and a background.
 */
export type SlideLayout = 'title' | 'content' | 'blank'
export type SlideBackground = 'default' | 'white' | 'sand' | 'blue' | 'green' | 'purple' | 'pink' | 'navy' | 'charcoal'

export interface SlideData {
  id: string
  layout: SlideLayout
  background: SlideBackground
  content: JSONContent
}

export interface PresentationContent {
  type: 'slides'
  slides: SlideData[]
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
    slides.push({ id, layout, background, content })
  }
  return { type: 'slides', slides: slides.length ? slides : newPresentation().slides }
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

/** Copy of a document without block ids (a duplicated block gets a fresh id when edited). */
function withoutBlockIds(n: JSONContent): JSONContent {
  const out: JSONContent = { ...n }
  if (n.attrs && 'blockId' in n.attrs) {
    const { blockId: _drop, ...attrs } = n.attrs
    out.attrs = attrs
  }
  if (n.content) out.content = n.content.map(withoutBlockIds)
  return out
}

/** Inserts a copy of slide `id` right after it. */
export function duplicateSlide(slides: SlideData[], id: string): { slides: SlideData[]; id: string | null } {
  const i = slides.findIndex((s) => s.id === id)
  if (i < 0) return { slides, id: null }
  const copy: SlideData = { ...slides[i], id: rid(), content: withoutBlockIds(structuredClone(slides[i].content)) }
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
