import { describe, expect, it } from 'vitest'
import { applyTableWidths, normalizeTableWidths } from '@/components/Editor/markdown/markdownTables'
import { markdownToHtml } from '@/lib/markdown'
import { makeEditor } from './helpers'

const TABLES = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\ntext\n\n| X | Y | Z |\n| - | - | - |\n| a | b | c |\n'

describe('Markdown table column widths', () => {
  it('keeps only valid widths, clamped', () => {
    expect(normalizeTableWidths(null)).toBeNull()
    expect(normalizeTableWidths([1, 2])).toBeNull()
    expect(normalizeTableWidths({ 0: [10, 120.4, 99999], x: [100], 1: ['a'] })).toEqual({ 0: [40, 120, 2000] })
  })
  it('applies widths to the matching table, wraps tables in a scroll box, and resets', () => {
    const root = document.createElement('div')
    root.innerHTML = markdownToHtml(TABLES)
    applyTableWidths(root, { 1: [100, 200, 300], 0: [50] /* wrong column count: ignored */ })
    const [t0, t1] = [...root.querySelectorAll('table')]
    expect(root.querySelectorAll('.md-table-scroll > table')).toHaveLength(2)
    expect(t0.style.tableLayout).toBe('')
    expect(t1.style.tableLayout).toBe('fixed')
    expect(t1.style.width).toBe('600px')
    expect([...t1.rows[0].cells].map((c) => c.style.width)).toEqual(['100px', '200px', '300px'])
    applyTableWidths(root, null)
    expect(t1.style.tableLayout).toBe('')
    expect(t1.rows[0].cells[0].style.width).toBe('')
    expect(root.querySelectorAll('.md-table-scroll')).toHaveLength(2) // not wrapped twice
  })
  it('is stored on the Markdown block', () => {
    const editor = makeEditor({ type: 'doc', content: [{ type: 'markdown', attrs: { source: TABLES, tableWidths: { 0: [80, 160] } } }] })
    expect(editor.getJSON().content![0].attrs?.tableWidths).toEqual({ 0: [80, 160] })
    expect(editor.getHTML()).toContain('data-table-widths')
  })
})
