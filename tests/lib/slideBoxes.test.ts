import { describe, expect, it } from 'vitest'
import { MAIN_FRAME, MIN_BOX_W, buildCss, buildSteps, cloneBox, duplicateSlide, newBox, normalizePresentation, normalizeRect, slideDocs, snapBox, type SlideData } from '@/lib/presentation'
import { dragRect } from '@/components/Slides/SlideObjects'
import { docToText } from '@/lib/docText'
import { extractLinks } from '@/lib/links'

const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })

describe('slide boxes', () => {
  it('normalizes frames and boxes (bad ones dropped, sizes clamped, ids unique)', () => {
    const p = normalizePresentation({
      type: 'slides',
      slides: [
        {
          id: 's1',
          layout: 'content',
          content: doc('main'),
          frame: { x: 10, y: 20, w: 5, h: 99999 },
          boxes: [
            { id: 'b1', x: 100, y: 200, w: 400, content: doc('chart box') },
            { id: 'b1', x: 0, y: 0, w: 300, content: { type: 'evil' } },
            { id: 'b3', x: 'a', y: 0, w: 300 },
            null,
          ],
        },
      ],
    })
    const s = p.slides[0]
    expect(s.frame).toEqual({ x: 10, y: 20, w: MIN_BOX_W, h: 720 })
    expect(s.boxes).toHaveLength(2)
    expect(s.boxes![0]).toEqual({ id: 'b1', x: 100, y: 200, w: 400, content: doc('chart box') })
    expect(s.boxes![1].id).not.toBe('b1')
    expect(s.boxes![1].content).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [] }] })
    expect(normalizeRect({ x: 1e9, y: -1e9, w: 100, h: 100 })).toEqual({ x: 1260, y: -360, w: 100, h: 100 })
    expect(normalizeRect('x')).toBeNull()
  })

  it('search text, links and docs include every box', () => {
    const slide: SlideData = { id: 's', layout: 'blank', background: 'default', content: doc('Main text'), boxes: [newBox({}, { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { pageId: 'p9', label: 'Budget' } }, { type: 'text', text: ' Box text' }] }] })] }
    expect(slideDocs(slide)).toHaveLength(2)
    const pres = { type: 'slides', slides: [slide] }
    expect(docToText(pres as never)).toContain('Box text')
    expect(extractLinks(pres as never)).toContain('p9')
  })

  it('whole boxes can animate; main-area selectors stay inside the main area', () => {
    const box = newBox({}, doc('x'))
    const slide: SlideData = {
      id: 's',
      layout: 'content',
      background: 'default',
      content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 2, blockId: 'h' } }] },
      boxes: [box],
      animations: [{ blockId: box.id, effect: 'zoom' }, { blockId: 'h', effect: 'fade' }],
    }
    const steps = buildSteps(slide)
    expect(steps).toEqual([{ block: -1, box: box.id, effect: 'zoom' }, { block: 0, effect: 'fade' }])
    const css = buildCss('.x', steps, 1)
    expect(css).toContain(`.x [data-box-id="${box.id}"] { animation: pn-build-zoom`)
    expect(css).toContain('.x .slide-main .ProseMirror > :nth-child(1) { visibility: hidden; }')
  })

  it('duplicating a slide or a box gives new ids (animations follow)', () => {
    const box = newBox({}, { type: 'doc', content: [{ type: 'paragraph', attrs: { blockId: 'inner' } }] })
    const slide: SlideData = { id: 's', layout: 'blank', background: 'default', content: doc('m'), boxes: [box], animations: [{ blockId: box.id, effect: 'fade' }] }
    const { slides } = duplicateSlide([slide], 's')
    const copy = slides[1]
    expect(copy.boxes![0].id).not.toBe(box.id)
    expect(copy.animations).toEqual([{ blockId: copy.boxes![0].id, effect: 'fade' }])
    expect(copy.boxes![0].content.content![0].attrs!.blockId).not.toBe('inner')
    const c = cloneBox(box)
    expect(c.id).not.toBe(box.id)
    expect([c.x, c.y]).toEqual([box.x + 24, box.y + 24])
  })

  it('snaps to the slide center, margins and other boxes', () => {
    // Centered horizontally (box center 643 → 640) and top edge to the margin (66 → 64).
    const s = snapBox({ x: 443, y: 66, w: 400, h: 100 }, [])
    expect([s.x, s.y]).toEqual([440, 64])
    expect(s.guides).toEqual([{ axis: 'x', at: 640 }, { axis: 'y', at: 64 }])
    // Left edge to another box's right edge.
    expect(snapBox({ x: 505, y: 300, w: 100, h: 50 }, [{ x: 100, y: 0, w: 400, h: 50 }]).x).toBe(500)
    // Far from everything: unchanged.
    expect(snapBox({ x: 222, y: 420, w: 100, h: 50 }, [])).toEqual({ x: 222, y: 420, guides: [] })
  })

  it('drag maths: move, resize from any side, minimum size, boxes keep auto height', () => {
    const r = { ...MAIN_FRAME }
    expect(dragRect(r, 'move', 10.4, -5.6, false)).toEqual({ ...r, x: r.x + 10, y: r.y - 6 })
    expect(dragRect(r, 'e', 50, 0, false).w).toBe(r.w + 50)
    expect(dragRect(r, 'w', 50, 0, false)).toMatchObject({ x: r.x + 50, w: r.w - 50 })
    expect(dragRect(r, 'se', 0, -9999, false).h).toBe(60)
    expect(dragRect(r, 'nw', 9999, 0, false).w).toBe(MIN_BOX_W)
    expect(dragRect({ x: 0, y: 0, w: 300, h: 100 }, 's', 0, 200, true).h).toBe(100)
  })
})
