import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { clampRowHeight, ROW_MAX, ROW_MIN } from '@/components/Editor/table/rowResize'
import { formatTick, formatValue, labelPositionOf, labelPositions, rechartsLabelPosition, normalizeFormat, normalizeSpec, DEFAULT_CHART, type ChartSpec } from '@/components/Editor/chart/chartModel'
import ChartRender from '@/components/Editor/chart/ChartRender'
import { ChartFormatPanel } from '@/components/Editor/chart/ChartFormatPanel'
import { makeEditor } from './helpers'

describe('table row heights and column widths', () => {
  it('row heights are kept within limits', () => {
    expect(clampRowHeight(null)).toBeNull()
    expect(clampRowHeight(NaN)).toBeNull()
    expect(clampRowHeight(5)).toBe(ROW_MIN)
    expect(clampRowHeight(99999)).toBe(ROW_MAX)
    expect(clampRowHeight(80.6)).toBe(81)
  })

  it('stores row height and column widths, and reads them back from HTML', () => {
    const editor = makeEditor({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            { type: 'tableRow', attrs: { height: 90 }, content: [{ type: 'tableCell', attrs: { colwidth: [220] }, content: [{ type: 'paragraph' }] }, { type: 'tableCell', content: [{ type: 'paragraph' }] }] },
            { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colwidth: [220] }, content: [{ type: 'paragraph' }] }, { type: 'tableCell', content: [{ type: 'paragraph' }] }] },
          ],
        },
      ],
    })
    const html = editor.getHTML()
    expect(html).toMatch(/<tr style="height: 90px;?">/)
    expect(html).toContain('colwidth="220"')
    const again = makeEditor(html)
    const rows = again.getJSON().content![0].content!
    expect(rows[0].attrs!.height).toBe(90)
    expect(rows[1].attrs!.height).toBeNull()
    expect(rows[0].content![0].attrs!.colwidth).toEqual([220])
    editor.destroy()
    again.destroy()
  })
})

describe('chart format', () => {
  it('keeps known options and drops the rest', () => {
    expect(normalizeFormat(null)).toBeUndefined()
    expect(normalizeFormat({ legend: 'diagonal', numberFormat: 'roman', decimals: 9, currency: 'BTC' })).toBeUndefined()
    expect(normalizeFormat({ legend: 'left', dataLabels: true, pieLabel: 'both', gridlines: false, xTitle: ' Month ', yTitle: '', numberFormat: 'currency', currency: '€', decimals: 1, stacked: true, smooth: 'yes', height: 'large' })).toEqual({
      legend: 'left',
      dataLabels: true,
      pieLabel: 'both',
      gridlines: false,
      xTitle: ' Month ',
      numberFormat: 'currency',
      currency: '€',
      decimals: 1,
      stacked: true,
      height: 'large',
    })
    expect(normalizeSpec({ ...DEFAULT_CHART, format: { legend: 'bottom' } }).format).toEqual({ legend: 'bottom' })
    expect(normalizeSpec(DEFAULT_CHART).format).toBeUndefined()
  })

  it('formats values like a spreadsheet', () => {
    expect(formatValue(1234.567, undefined)).toBe((1234.57).toLocaleString())
    expect(formatValue(null, undefined)).toBe('–')
    expect(formatValue(12, { numberFormat: 'percent' })).toBe('12%')
    expect(formatValue(-1500, { numberFormat: 'currency', currency: '€', decimals: 0 })).toBe(`-€${(1500).toLocaleString()}`)
    expect(formatValue(2, { decimals: 2 })).toBe((2).toLocaleString(undefined, { minimumFractionDigits: 2 }))
    expect(formatValue(1500, { numberFormat: 'compact' })).toMatch(/1\.5K/i)
    expect(formatTick(250000, { numberFormat: 'currency' })).toMatch(/^\$250K$/i)
    expect(formatTick(50, { numberFormat: 'percent', decimals: 2 })).toBe('50%')
  })

  const spec = (format: ChartSpec['format'], type: ChartSpec['type'] = 'bar'): ChartSpec => ({ ...normalizeSpec(DEFAULT_CHART), type, format })

  it('puts the legend where asked (or hides it)', () => {
    for (const pos of ['top', 'bottom', 'left', 'right'] as const) {
      const { container, unmount } = render(<ChartRender spec={spec({ legend: pos })} theme="light" />)
      expect(container.querySelector(`[data-legend="${pos}"]`)).not.toBeNull()
      const kids = [...container.querySelector(`[data-legend="${pos}"]`)!.children]
      const legendFirst = kids[0].getAttribute('data-testid') === 'chart-legend'
      expect(legendFirst).toBe(pos === 'top' || pos === 'left')
      unmount()
    }
    const { container } = render(<ChartRender spec={spec({ legend: 'none' })} theme="light" />)
    expect(container.querySelector('[data-testid="chart-legend"]')).toBeNull()
  })

  it('pie legend position and parts values in the legend', () => {
    const { container, unmount } = render(<ChartRender spec={spec({ legend: 'none' }, 'pie')} theme="light" />)
    expect(container.querySelector('[data-testid="chart-legend"]')).toBeNull()
    unmount()
    render(<ChartRender spec={spec({ dataLabels: true, numberFormat: 'currency' }, 'parts')} theme="light" />)
    expect(screen.getByText(/Q4 · \$210/)).toBeInTheDocument()
  })

  it('format panel edits the format', () => {
    let f: ChartSpec['format'] = undefined
    const { rerender } = render(<ChartFormatPanel draft={spec(f)} onChange={(x) => (f = x)} />)
    fireEvent.click(screen.getByRole('radio', { name: /Left/ }))
    expect(f).toEqual({ legend: 'left' })
    rerender(<ChartFormatPanel draft={spec(f)} onChange={(x) => (f = x)} />)
    fireEvent.click(screen.getByLabelText('Show values on the chart'))
    fireEvent.change(screen.getByLabelText('Number format'), { target: { value: 'percent' } })
    expect(f).toMatchObject({ legend: 'left', numberFormat: 'percent' })
    rerender(<ChartFormatPanel draft={spec(f)} onChange={(x) => (f = x)} />)
    fireEvent.change(screen.getByLabelText('Vertical axis title'), { target: { value: 'Share' } })
    rerender(<ChartFormatPanel draft={spec(f)} onChange={(x) => (f = x)} />)
    fireEvent.click(screen.getByLabelText(/Stacked/))
    expect(f).toMatchObject({ yTitle: 'Share', stacked: true })
    // Pie: slice label choice instead of axis options.
    rerender(<ChartFormatPanel draft={spec({ dataLabels: true }, 'pie')} onChange={(x) => (f = x)} />)
    expect(screen.queryByLabelText('Vertical axis title')).toBeNull()
    fireEvent.change(screen.getByLabelText('Slice labels show'), { target: { value: 'value' } })
    expect(f).toMatchObject({ pieLabel: 'value' })
  })

  it('data labels can sit outside, inside the end, centered or at the base', () => {
    expect(labelPositions('bar').map((p) => p.id)).toEqual(['outside', 'inside-end', 'center', 'inside-base'])
    expect(labelPositions('line').map((p) => p.label)).toEqual(['Above', 'On the point', 'Below'])
    expect(rechartsLabelPosition('bar', 'outside')).toBe('top')
    expect(rechartsLabelPosition('bar', 'inside-end')).toBe('insideTop')
    expect(rechartsLabelPosition('bar', 'inside-base')).toBe('insideBottom')
    expect(rechartsLabelPosition('hbar', 'outside')).toBe('right')
    expect(rechartsLabelPosition('hbar', 'inside-end')).toBe('insideRight')
    expect(rechartsLabelPosition('hbar', 'inside-base')).toBe('insideLeft')
    expect(rechartsLabelPosition('line', 'inside-base')).toBe('bottom')
    // Defaults: outside; stacked bars and pies in the middle; options that don't fit the type fall back.
    expect(labelPositionOf({ type: 'bar' })).toBe('outside')
    expect(labelPositionOf({ type: 'bar', format: { stacked: true } })).toBe('center')
    expect(labelPositionOf({ type: 'pie' })).toBe('center')
    expect(labelPositionOf({ type: 'line', format: { labelPosition: 'inside-end' } })).toBe('outside')
    expect(normalizeFormat({ labelPosition: 'inside-base' })).toEqual({ labelPosition: 'inside-base' })
    expect(normalizeFormat({ labelPosition: 'somewhere' })).toBeUndefined()
  })

  it('format panel: label position choice follows the chart type', () => {
    let f: ChartSpec['format'] = { dataLabels: true }
    render(<ChartFormatPanel draft={spec(f)} onChange={(x) => (f = x)} />)
    fireEvent.change(screen.getByLabelText('Label position'), { target: { value: 'inside-end' } })
    expect(f).toMatchObject({ dataLabels: true, labelPosition: 'inside-end' })
  })
})
