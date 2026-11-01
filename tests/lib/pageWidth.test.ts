import { describe, expect, it } from 'vitest'
import { DEFAULT_PAGE_WIDTH, effectiveWidth, normalizeWidth, widthFromDrag, widthLabel, widthStyle } from '@/lib/pageWidth'

describe('page width', () => {
  it('normalises stored values', () => {
    expect(normalizeWidth('full')).toBe('full')
    expect(normalizeWidth(1234)).toBe(1230)
    expect(normalizeWidth(100)).toBe(600) // min
    expect(normalizeWidth(99999)).toBe(2400) // max
    expect(normalizeWidth(DEFAULT_PAGE_WIDTH)).toBeNull() // default is stored as null
    for (const bad of [null, undefined, 'wide', NaN, {}]) expect(normalizeWidth(bad)).toBeNull()
  })

  it('produces the column max-width', () => {
    expect(widthStyle(null)).toEqual({ maxWidth: '900px' })
    expect(widthStyle(undefined)).toEqual({ maxWidth: '900px' })
    expect(widthStyle(1200)).toEqual({ maxWidth: '1200px' })
    expect(widthStyle('full')).toEqual({ maxWidth: 'none' })
  })

  it('computes the width from an edge drag (symmetric) and snaps to full width', () => {
    expect(widthFromDrag(1000, 1600, 1800)).toBe(1200) // 2 × 600
    expect(widthFromDrag(1000, 400, 1800)).toBe(1200) // left edge works the same
    expect(widthFromDrag(1000, 1100, 1800)).toBe(600) // clamped to the minimum
    expect(widthFromDrag(1000, 1890, 1800)).toBe('full') // dragged to the window edge
  })

  it('reports the width actually used and a label', () => {
    expect(effectiveWidth('full', 1660)).toBe(1660)
    expect(effectiveWidth(null, 1660)).toBe(900)
    expect(effectiveWidth(1400, 1000)).toBe(1000) // can't be wider than the window
    expect(widthLabel(null)).toBe('Default')
    expect(widthLabel(720)).toBe('Narrow')
    expect(widthLabel('full')).toBe('Full width')
    expect(widthLabel(1040)).toBe('1040 px')
  })
})
