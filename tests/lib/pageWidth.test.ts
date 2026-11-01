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
    // Default is 1200px (what used to be "Wide").
    // Non-full widths keep a side gutter so they never look like Full on small windows.
    expect(widthStyle(null)).toEqual({ maxWidth: 'min(1200px, calc(100% - min(160px, 12%)))' })
    expect(widthStyle(undefined)).toEqual(widthStyle(null))
    expect(widthStyle(1500)).toEqual({ maxWidth: 'min(1500px, calc(100% - min(160px, 12%)))' })
    expect(widthStyle('full')).toEqual({ maxWidth: 'none' })
  })

  it('computes the width from an edge drag (symmetric) and snaps to full width', () => {
    expect(widthFromDrag(1000, 1500, 1800)).toBe(1000) // 2 × 500
    expect(widthFromDrag(1000, 500, 1800)).toBe(1000) // left edge works the same
    expect(widthFromDrag(1000, 1600, 1800)).toBeNull() // 1200 = the default width
    expect(widthFromDrag(1000, 1100, 1800)).toBe(600) // clamped to the minimum
    expect(widthFromDrag(1000, 1890, 1800)).toBe('full') // dragged to the window edge
  })

  it('reports the width actually used and a label', () => {
    expect(effectiveWidth('full', 1660)).toBe(1660)
    expect(effectiveWidth(null, 1660)).toBe(1200)
    // Regression: on a small/zoomed window Default used to equal Full (slider at the end).
    expect(effectiveWidth(null, 873)).toBe(768) // 873 − 12%
    expect(effectiveWidth(null, 873)).toBeLessThan(effectiveWidth('full', 873))
    expect(effectiveWidth(1400, 1000)).toBe(880) // can't be wider than the window minus its gutter
    expect(effectiveWidth(null, 1500)).toBe(1200) // big window: the real default
    expect(widthLabel(null)).toBe('Default')
    expect(widthLabel(900)).toBe('Narrow')
    expect(widthLabel(1500)).toBe('Wide')
    expect(widthLabel('full')).toBe('Full width')
    expect(widthLabel(1040)).toBe('1040 px')
  })
})
