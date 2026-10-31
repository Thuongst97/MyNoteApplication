import { describe, expect, it } from 'vitest'
import { CHART_TYPES, DEFAULT_CHART, formatNumber, MAX_PARTS, MAX_SERIES, normalizeSpec, parseTable, partsOf, SERIES_COLORS, toNumber } from '@/components/Editor/chart/chartModel'

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
    expect(spec).toEqual({ type: 'bar', title: '5', labels: ['a', 'b'], series: [{ name: 'S', values: [1, null] }] })
    // Missing spec → default data (and an empty title)
    expect(normalizeSpec(null)).toEqual({ ...DEFAULT_CHART, title: '' })
  })

  it('folds small parts into "Other" for parts-of-a-whole', () => {
    const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const parts = partsOf({ type: 'parts', title: '', labels, series: [{ name: 'x', values: [80, 70, 60, 50, 40, 30, 20, -5] }] })
    expect(parts).toHaveLength(MAX_PARTS)
    expect(parts.at(-1)).toEqual({ label: 'Other', value: 50 })
    expect(parts[0]).toEqual({ label: 'A', value: 80 })
  })

  it('has one color per series slot in both themes and five chart types', () => {
    expect(SERIES_COLORS.light).toHaveLength(MAX_SERIES)
    expect(SERIES_COLORS.dark).toHaveLength(MAX_SERIES)
    expect(CHART_TYPES.map((t) => t.id)).toEqual(['bar', 'hbar', 'line', 'area', 'parts'])
    expect(formatNumber(null)).toBe('–')
    expect(formatNumber(1234.567)).toMatch(/1.?234.57/)
  })
})
