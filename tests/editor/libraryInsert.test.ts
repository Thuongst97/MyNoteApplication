import { describe, expect, it } from 'vitest'
import { cloneItemElements } from '@/components/Library/libraryInsert'

describe('cloneItemElements', () => {
  const elements = [
    { id: 'box', type: 'rectangle', x: 0, y: 0, width: 100, height: 50, groupIds: ['g1'], boundElements: [{ id: 'label', type: 'text' }, { id: 'arrow', type: 'arrow' }] },
    { id: 'label', type: 'text', x: 10, y: 10, width: 80, height: 20, groupIds: ['g1'], containerId: 'box' },
    { id: 'arrow', type: 'arrow', x: 100, y: 25, width: 100, height: 0, groupIds: [], startBinding: { elementId: 'box', focus: 0 }, endBinding: null },
  ]

  it('gives fresh ids but keeps groups, labels and arrow bindings connected', () => {
    const out = cloneItemElements({ elements }, 0, 0)
    const [box, label, arrow] = out
    expect(new Set(out.map((e) => e.id)).size).toBe(3)
    expect(out.some((e) => ['box', 'label', 'arrow'].includes(e.id))).toBe(false)
    expect(label.containerId).toBe(box.id)
    expect(box.boundElements).toEqual([{ id: label.id, type: 'text' }, { id: arrow.id, type: 'arrow' }])
    expect((arrow.startBinding as { elementId: string }).elementId).toBe(box.id)
    expect(box.groupIds).toEqual(label.groupIds)
    expect((box.groupIds as string[])[0]).not.toBe('g1')
  })

  it('centers the copy on the given point', () => {
    const out = cloneItemElements({ elements }, 1000, 500)
    // original bounds: x 0..200, y 0..50 → center (100, 25)
    expect(out[0].x).toBe(900)
    expect(out[0].y).toBe(475)
    // the source is not modified
    expect(elements[0].x).toBe(0)
  })
})
