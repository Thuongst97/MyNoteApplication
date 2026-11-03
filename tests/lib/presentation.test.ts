import { describe, expect, it } from 'vitest'
import { SLIDE_BACKGROUNDS, duplicateSlide, moveSlide, newPresentation, newSlide, normalizePresentation, slideTitle, type SlideData } from '@/lib/presentation'
import { normalizeKind } from '@/lib/pageMeta'
import { docToText } from '@/lib/docText'
import { extractLinks } from '@/lib/links'
import { presentKey } from '@/components/Slides/PresentMode'

const text = (t: string) => ({ type: 'text', text: t })

describe('presentation model', () => {
  it('starts new slides with content for their layout', () => {
    const title = newSlide('title', 'Kickoff')
    expect(title.layout).toBe('title')
    expect(title.background).toBe('default')
    expect(title.content.content![0]).toMatchObject({ type: 'heading', attrs: { level: 1 }, content: [text('Kickoff')] })
    expect(newSlide('content').content.content!.map((b) => b.type)).toEqual(['heading', 'bulletList'])
    expect(newSlide('blank').content.content!.map((b) => b.type)).toEqual(['paragraph'])
    expect(newSlide().id).not.toBe(newSlide().id)
  })

  it('new presentations have a title slide and a content slide', () => {
    const p = newPresentation('Roadmap')
    expect(p.type).toBe('slides')
    expect(p.slides.map((s) => s.layout)).toEqual(['title', 'content'])
    expect(slideTitle(p.slides[0], 0)).toBe('Roadmap')
  })

  it('normalizes stored content: bad values become defaults, duplicate ids are replaced', () => {
    const p = normalizePresentation({
      type: 'slides',
      slides: [
        { id: 'a', layout: 'title', background: 'navy', content: { type: 'doc', content: [] } },
        { id: 'a', layout: 'weird', background: 'url(evil)', content: { type: 'script' } },
        { id: '../x', layout: 'blank' },
        null,
        'junk',
      ],
    })
    expect(p.slides).toHaveLength(3)
    expect(p.slides[0]).toMatchObject({ id: 'a', layout: 'title', background: 'navy' })
    expect(p.slides[1].id).not.toBe('a')
    expect(p.slides[1]).toMatchObject({ layout: 'content', background: 'default', content: { type: 'doc' } })
    expect(p.slides[2].id).not.toBe('../x')
    expect(p.slides[2].layout).toBe('blank')
  })

  it('opens damaged or empty content as a fresh presentation', () => {
    for (const bad of [null, undefined, 42, { type: 'doc' }, { type: 'slides', slides: [] }, { type: 'slides', slides: 'x' }])
      expect(normalizePresentation(bad).slides.length).toBeGreaterThan(0)
  })

  it('every background is a safe color value', () => {
    for (const b of Object.values(SLIDE_BACKGROUNDS)) if (b.color) expect(b.color).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('titles come from the first heading, else the first text, else the number', () => {
    const s = (content: unknown[]): SlideData => ({ id: 'x', layout: 'content', background: 'default', content: { type: 'doc', content } as never })
    expect(slideTitle(s([{ type: 'paragraph', content: [text('Intro')] }, { type: 'heading', content: [text('Agenda')] }]), 0)).toBe('Agenda')
    expect(slideTitle(s([{ type: 'paragraph' }, { type: 'paragraph', content: [text('Body')] }]), 0)).toBe('Body')
    expect(slideTitle(s([{ type: 'paragraph' }]), 4)).toBe('Slide 5')
  })

  it('duplicates a slide right after it, with a new id and without block ids', () => {
    const a = newSlide('content', 'A')
    a.content.content![0].attrs = { level: 2, blockId: 'blk1' }
    const b = newSlide('blank')
    const { slides, id } = duplicateSlide([a, b], a.id)
    expect(slides.map((s) => s.id)).toEqual([a.id, id, b.id])
    expect(id).not.toBe(a.id)
    expect(slides[1].content.content![0].attrs).toEqual({ level: 2 })
    expect(a.content.content![0].attrs!.blockId).toBe('blk1') // original untouched
    expect(duplicateSlide([a], 'missing')).toEqual({ slides: [a], id: null })
  })

  it('moves slides', () => {
    const [a, b, c] = [newSlide(), newSlide(), newSlide()]
    expect(moveSlide([a, b, c], a.id, 2).map((s) => s.id)).toEqual([b.id, c.id, a.id])
    expect(moveSlide([a, b, c], c.id, 0).map((s) => s.id)).toEqual([c.id, a.id, b.id])
    expect(moveSlide([a, b, c], b.id, 99).map((s) => s.id)).toEqual([a.id, c.id, b.id])
    expect(moveSlide([a, b], 'nope', 0)).toEqual([a, b])
  })
})

describe('presentations elsewhere in the app', () => {
  it('is a page kind of its own', () => {
    expect(normalizeKind('slides')).toBe('slides')
    expect(normalizeKind('whiteboard')).toBe('whiteboard')
    expect(normalizeKind('evil')).toBe('doc')
  })

  it('search text and links include every slide', () => {
    const p = newPresentation('Quarterly review')
    p.slides[1].content = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [text('Revenue up'), { type: 'mention', attrs: { pageId: 'target1', label: 'Budget' } }] }],
    }
    const t = docToText(p as never)
    expect(t).toContain('Quarterly review')
    expect(t).toContain('Revenue up')
    expect(extractLinks(p as never)).toContain('target1')
  })
})

describe('present mode keys', () => {
  it('moves forward, back and to the ends, staying in range', () => {
    for (const k of ['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter', 'n']) expect(presentKey(k, 1, 5)).toBe(2)
    for (const k of ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p']) expect(presentKey(k, 1, 5)).toBe(0)
    expect(presentKey('ArrowRight', 4, 5)).toBe(4)
    expect(presentKey('ArrowLeft', 0, 5)).toBe(0)
    expect(presentKey('Home', 3, 5)).toBe(0)
    expect(presentKey('End', 0, 5)).toBe(4)
    expect(presentKey('x', 2, 5)).toBeNull()
  })
})
