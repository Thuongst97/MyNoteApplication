import { describe, expect, it } from 'vitest'
import { CHART_TYPES, DEFAULT_CHART, formatNumber, MAX_PARTS, MAX_SERIES, MAX_SLICES, normalizeSpec, parseTable, partColor, partsOf, SERIES_COLORS, seriesColor, textOn, toNumber } from '@/components/Editor/chart/chartModel'

describe('chart model', () => {
  it('parses tab-separated data pasted from a spreadsheet', () => {
    expect(parseTable('Month\tSales\tTarget\nJan\t120\t100\nFeb\t1,350\t\n')).toEqual({
      labels: ['Jan', 'Feb'],
      series: [
        { name: 'Sales', values: [120, 1350] },
        { name: 'Target', values: [100, null] },
      ],
    })
  })

  it('parses CSV with quoted cells and semicolon CSV', () => {
    expect(parseTable('Area,Budget\n"Sales, EMEA",150\nOps,"1,200"')).toEqual({
      labels: ['Sales, EMEA', 'Ops'],
      series: [{ name: 'Budget', values: [150, 1200] }],
    })
    expect(parseTable('a;b\nx;5')!.series[0].values).toEqual([5])
  })

  it('rejects input without a header and a data row', () => {
    expect(parseTable('only one line')).toBeNull()
    expect(parseTable('Label\nrow')).toBeNull()
  })

  it('caps the number of series', () => {
    const header = ['Label', ...Array.from({ length: 12 }, (_, i) => `S${i}`)].join('\t')
    expect(parseTable(`${header}\nx\t${'1\t'.repeat(12)}`)!.series).toHaveLength(MAX_SERIES)
  })

  it('converts numbers loosely and safely', () => {
    expect(toNumber('$1,234.5')).toBe(1234.5)
    expect(toNumber('45%')).toBe(45)
    expect(toNumber('')).toBeNull()
    expect(toNumber('abc')).toBeNull()
    expect(toNumber(7)).toBe(7)
  })

  it('normalises stored specs (aligns values to labels, fixes bad types)', () => {
    const spec = normalizeSpec({ type: 'nope', title: 5, labels: ['a', 'b'], series: [{ name: 'S', values: [1] }] })
    expect(spec).toEqual({ type: 'bar', title: '5', labels: ['a', 'b'], series: [{ name: 'S', values: [1, null] }], border: true })
    // Missing spec → default data (and an empty title)
    expect(normalizeSpec(null)).toEqual({ ...DEFAULT_CHART, title: '', border: true })
  })

  it('folds small parts into "Other" for parts-of-a-whole', () => {
    const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const parts = partsOf({ type: 'parts', title: '', labels, series: [{ name: 'x', values: [80, 70, 60, 50, 40, 30, 20, -5] }] })
    expect(parts).toHaveLength(MAX_PARTS)
    expect(parts.at(-1)).toEqual({ label: 'Other', value: 50, index: -1 })
    expect(parts[0]).toEqual({ label: 'A', value: 80, index: 0 })
  })

  it('has one color per series slot in both themes and six chart types', () => {
    expect(SERIES_COLORS.light).toHaveLength(MAX_SERIES)
    expect(SERIES_COLORS.dark).toHaveLength(MAX_SERIES)
    expect(CHART_TYPES.map((t) => t.id)).toEqual(['bar', 'hbar', 'line', 'area', 'pie', 'parts'])
    expect(formatNumber(null)).toBe('–')
    expect(formatNumber(1234.567)).toMatch(/1.?234.57/)
  })
})

describe('pie charts and custom colors', () => {
  const task2 = {
    type: 'pie' as const,
    title: 'Writing Task 2',
    labels: ['Introduction', 'Body 1', 'Body 2', 'Conclusion'],
    series: [{ name: 'Words', values: [40, 100, 100, 30] }],
  }

  it('keeps pie, donut and valid colors when normalizing', () => {
    const spec = normalizeSpec({ ...task2, donut: true, seriesColors: ['#ff0000', 'red'], labelColors: ['#00ff00', null, 'javascript:x', '#0000FF', '#123456'] })
    expect(spec.type).toBe('pie')
    expect(spec.donut).toBe(true)
    // Only #rrggbb is accepted; lists line up with series / rows.
    expect(spec.seriesColors).toEqual(['#ff0000'])
    expect(spec.labelColors).toEqual(['#00ff00', null, null, '#0000FF'])
    // No custom colors → no color lists stored.
    const plain = normalizeSpec(task2)
    expect(plain.seriesColors).toBeUndefined()
    expect(plain.labelColors).toBeUndefined()
    expect(plain.donut).toBeUndefined()
  })

  it('pie slices are sorted by size and keep their row index', () => {
    const parts = partsOf(normalizeSpec(task2))
    expect(parts.map((p) => [p.label, p.index])).toEqual([
      ['Body 1', 1],
      ['Body 2', 2],
      ['Introduction', 0],
      ['Conclusion', 3],
    ])
  })

  it('pies show up to 8 slices before folding into "Other"', () => {
    const labels = Array.from({ length: 10 }, (_, i) => `L${i}`)
    const spec = normalizeSpec({ type: 'pie', title: '', labels, series: [{ name: 'x', values: labels.map((_, i) => 100 - i) }] })
    const parts = partsOf(spec)
    expect(parts).toHaveLength(MAX_SLICES)
    expect(parts.at(-1)).toMatchObject({ label: 'Other', index: -1, value: 93 + 92 + 91 })
  })

  it('uses custom colors, falling back to the palette', () => {
    const spec = normalizeSpec({ ...task2, type: 'bar', seriesColors: ['#123456'], labelColors: [null, '#abcdef'] })
    expect(seriesColor(spec, 0, 'light')).toBe('#123456')
    expect(seriesColor(spec, 1, 'dark')).toBe(SERIES_COLORS.dark[1])
    expect(partColor(spec, 1, 0, 'light')).toBe('#abcdef')
    expect(partColor(spec, 0, 2, 'light')).toBe(SERIES_COLORS.light[2])
    expect(partColor(spec, -1, 7, 'light')).not.toBe(SERIES_COLORS.light[7]) // "Other" is neutral
  })

  it('picks readable label text for any slice color', () => {
    expect(textOn('#1f2937')).toBe('#ffffff')
    expect(textOn('#2a78d6')).toBe('#ffffff')
    expect(textOn('#eda100')).toBe('#1f1f1f')
    expect(textOn('#ffffff')).toBe('#1f1f1f')
    expect(textOn('nope')).toBe('#ffffff')
  })
})

describe('chart border', () => {
  it('is on by default (new and older charts) and only off when turned off', () => {
    expect(normalizeSpec(DEFAULT_CHART).border).toBe(true)
    expect(normalizeSpec({ ...DEFAULT_CHART, border: undefined }).border).toBe(true)
    expect(normalizeSpec({ ...DEFAULT_CHART, border: 'yes' }).border).toBe(true)
    expect(normalizeSpec({ ...DEFAULT_CHART, border: false }).border).toBe(false)
  })
})
