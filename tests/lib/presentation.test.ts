import { describe, expect, it } from 'vitest'
import { SLIDE_BACKGROUNDS, buildCss, buildSteps, duplicateSlide, moveSlide, newPresentation, newSlide, normalizePresentation, showStep, slideTitle, strokeHit, strokePath, type SlideData } from '@/lib/presentation'
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

  it('duplicates a slide right after it, with a new id and new block ids', () => {
    const a = newSlide('content', 'A')
    a.content.content![0].attrs = { level: 2, blockId: 'blk1' }
    const b = newSlide('blank')
    const { slides, id } = duplicateSlide([a, b], a.id)
    expect(slides.map((s) => s.id)).toEqual([a.id, id, b.id])
    expect(id).not.toBe(a.id)
    expect(slides[1].content.content![0].attrs!.blockId).toMatch(/./); expect(slides[1].content.content![0].attrs!.blockId).not.toBe('blk1')
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
  it('maps keys to moves', () => {
    for (const k of ['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter', 'n']) expect(presentKey(k)).toBe('next')
    for (const k of ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p']) expect(presentKey(k)).toBe('prev')
    expect(presentKey('Home')).toBe('first')
    expect(presentKey('End')).toBe('last')
    expect(presentKey('x')).toBeNull()
  })
})

describe('click animations', () => {
  const slideWith = (anims: SlideData['animations']): SlideData => ({
    id: 's1',
    layout: 'content',
    background: 'default',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2, blockId: 'h' }, content: [text('Title')] },
        { type: 'bulletList', attrs: { blockId: 'l' }, content: [{ type: 'listItem' }, { type: 'listItem' }, { type: 'listItem' }] },
        { type: 'paragraph', attrs: { blockId: 'p' }, content: [text('End')] },
      ],
    },
    animations: anims,
  })

  it('turns animations into click steps (lists item by item), skipping deleted blocks', () => {
    const s = slideWith([
      { blockId: 'p', effect: 'fade' },
      { blockId: 'l', effect: 'fly-up', byItem: true },
      { blockId: 'gone', effect: 'zoom' },
    ])
    expect(buildSteps(s)).toEqual([
      { block: 2, effect: 'fade' },
      { block: 1, item: 0, effect: 'fly-up' },
      { block: 1, item: 1, effect: 'fly-up' },
      { block: 1, item: 2, effect: 'fly-up' },
    ])
    expect(buildSteps(slideWith([{ blockId: 'l', effect: 'fade' }]))).toEqual([{ block: 1, effect: 'fade' }])
  })

  it('CSS hides what is not revealed yet and animates the last revealed step', () => {
    const steps = buildSteps(slideWith([{ blockId: 'h', effect: 'zoom' }, { blockId: 'l', effect: 'fade', byItem: true }]))
    const css = buildCss('.x', steps, 2)
    expect(css).toContain('.x .ProseMirror > :nth-child(2) > :nth-child(1) { animation: pn-build-fade')
    expect(css).toContain('.x .ProseMirror > :nth-child(2) > :nth-child(2) { visibility: hidden; }')
    expect(css).toContain('.x .ProseMirror > :nth-child(2) > :nth-child(3) { visibility: hidden; }')
    expect(css).not.toContain('pn-build-zoom') // already shown, not replayed
    expect(buildCss('.x', steps, 0)).toContain('.x .ProseMirror > :nth-child(1) { visibility: hidden; }')
    expect(buildCss('.x', steps, 4)).not.toContain('hidden')
    expect(buildCss('.x', [{ block: 0, effect: 'appear' }], 1)).toBe('')
  })

  it('moves through animations before moving to the next slide, and back', () => {
    const a = slideWith([{ blockId: 'h', effect: 'fade' }, { blockId: 'p', effect: 'fade' }])
    const b = { ...slideWith(undefined), id: 's2' }
    const slides = [a, b]
    let pos = { slide: 0, step: 0 }
    const seq: string[] = []
    for (let i = 0; i < 4; i++) {
      pos = showStep(slides, pos, 1)
      seq.push(`${pos.slide}.${pos.step}`)
    }
    expect(seq).toEqual(['0.1', '0.2', '1.0', '1.0'])
    pos = showStep(slides, pos, -1)
    expect(pos).toEqual({ slide: 0, step: 2 }) // back shows the previous slide complete
    expect(showStep(slides, { slide: 0, step: 0 }, -1)).toEqual({ slide: 0, step: 0 })
  })

  it('keeps animations, transitions and ink through normalizing; drops bad ones', () => {
    const p = normalizePresentation({
      type: 'slides',
      slides: [
        {
          id: 'a',
          layout: 'content',
          content: { type: 'doc', content: [] },
          transition: 'push',
          animations: [{ blockId: 'b1', effect: 'fade', byItem: true }, { blockId: 'b1', effect: 'zoom' }, { blockId: 'x', effect: 'explode' }, { blockId: '<x>', effect: 'fade' }],
          ink: [
            { tool: 'pen', color: '#E03E3E', width: 3, points: [1, 2, 3, 4] },
            { tool: 'pen', color: 'red; x', width: 3, points: [1, 2] },
            { tool: 'marker', color: '#000000', width: 3, points: [1, 2] },
            { tool: 'pen', color: '#000000', width: 3, points: [1, 2, 3] },
            { tool: 'highlighter', color: '#fde047', width: 999, points: [0, 0, 'x', 1] },
            { tool: 'highlighter', color: '#fde047', width: 999, points: [0, 0, 5, 5] },
          ],
        },
        { id: 'b', layout: 'content', content: { type: 'doc' }, transition: 'spin', ink: 'nope' },
      ],
    })
    expect(p.slides[0].transition).toBe('push')
    expect(p.slides[0].animations).toEqual([{ blockId: 'b1', effect: 'fade', byItem: true }])
    expect(p.slides[0].ink).toEqual([
      { tool: 'pen', color: '#e03e3e', width: 3, points: [1, 2, 3, 4] },
      { tool: 'highlighter', color: '#fde047', width: 80, points: [0, 0, 5, 5] },
    ])
    expect(p.slides[1].transition).toBeUndefined()
    expect(p.slides[1].ink).toBeUndefined()
  })

  it('duplicated slides keep their animations on the copied blocks', () => {
    const s = slideWith([{ blockId: 'h', effect: 'zoom' }])
    const { slides } = duplicateSlide([s], s.id)
    const copy = slides[1]
    const newH = copy.content.content![0].attrs!.blockId
    expect(newH).not.toBe('h')
    expect(copy.animations).toEqual([{ blockId: newH, effect: 'zoom' }])
    expect(buildSteps(copy)).toEqual([{ block: 0, effect: 'zoom' }])
  })
})

describe('ink', () => {
  it('builds smooth paths and finds strokes under the eraser', () => {
    expect(strokePath([])).toBe('')
    expect(strokePath([1, 2, 3, 4])).toBe('M1 2 L3 4')
    expect(strokePath([0, 0, 10, 0, 20, 10])).toBe('M0 0 Q10 0 15 5 L20 10')
    const s = { tool: 'pen' as const, color: '#000000', width: 4, points: [0, 0, 100, 0] }
    expect(strokeHit(s, 50, 5, 4)).toBe(true)
    expect(strokeHit(s, 50, 30, 4)).toBe(false)
    expect(strokeHit(s, 110, 0, 4)).toBe(false)
  })
})
