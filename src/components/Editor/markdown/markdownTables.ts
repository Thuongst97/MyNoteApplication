/**
 * Column widths for tables in Markdown blocks. Markdown has no syntax for widths, so they are
 * kept on the block (`tableWidths`: per table, in order, a width in px per column) and applied
 * to the rendered tables. Dragging a column's right border changes it; double-click resets.
 */

export type TableWidths = Record<string, number[]>

export const MIN_COL = 40
export const MAX_COL = 2000
const EDGE = 6

/** Cleans stored widths (anything invalid is dropped). */
export function normalizeTableWidths(v: unknown): TableWidths | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const out: TableWidths = {}
  for (const [k, w] of Object.entries(v as Record<string, unknown>)) {
    if (!/^\d{1,3}$/.test(k) || !Array.isArray(w) || w.length === 0 || w.length > 64) continue
    if (!w.every((n) => typeof n === 'number' && Number.isFinite(n))) continue
    out[k] = w.map((n) => Math.round(Math.min(MAX_COL, Math.max(MIN_COL, n))))
  }
  return Object.keys(out).length ? out : null
}

const headCells = (table: HTMLTableElement) => Array.from(table.rows[0]?.cells ?? [])

function setWidths(table: HTMLTableElement, widths: number[]) {
  table.style.tableLayout = 'fixed'
  table.style.width = `${widths.reduce((a, b) => a + b, 0)}px`
  headCells(table).forEach((c, i) => (c.style.width = `${widths[i]}px`))
}

/** Wraps each table in a scroll box and applies the stored widths (when the column count matches). */
export function applyTableWidths(root: HTMLElement, widths: TableWidths | null) {
  root.querySelectorAll<HTMLTableElement>('table').forEach((table, i) => {
    if (!table.parentElement?.classList.contains('md-table-scroll')) {
      const box = document.createElement('div')
      box.className = 'md-table-scroll'
      table.replaceWith(box)
      box.append(table)
    }
    const w = widths?.[String(i)]
    if (w && w.length === headCells(table).length) setWidths(table, w)
    else if (table.style.tableLayout) {
      // Reset: back to automatic widths.
      table.style.tableLayout = ''
      table.style.width = ''
      headCells(table).forEach((c) => (c.style.width = ''))
    }
  })
}

/** The column whose right border is under the pointer, or null. */
function edgeAt(e: MouseEvent, root: HTMLElement): { table: HTMLTableElement; index: number } | null {
  const cell = (e.target as HTMLElement).closest?.('td, th') as HTMLTableCellElement | null
  if (!cell || !root.contains(cell)) return null
  const table = cell.closest('table') as HTMLTableElement
  const r = cell.getBoundingClientRect()
  const scale = r.width / (cell.offsetWidth || r.width || 1) // the page may be zoomed
  let index = -1
  if (r.right - e.clientX <= EDGE * scale) index = cell.cellIndex
  else if (e.clientX - r.left <= EDGE * scale && cell.cellIndex > 0) index = cell.cellIndex - 1
  return index < 0 ? null : { table, index }
}

/**
 * Lets the user drag column borders of the rendered tables. `save` receives the new widths for
 * the table (null resets it). Returns the cleanup.
 */
export function enableTableResize(root: HTMLElement, current: () => TableWidths | null, save: (next: TableWidths | null) => void) {
  const onMove = (e: MouseEvent) => {
    if (e.buttons) return
    root.classList.toggle('md-col-edge', !!edgeAt(e, root))
  }
  const onLeave = () => root.classList.remove('md-col-edge')
  const tableIndex = (table: HTMLTableElement) => Array.from(root.querySelectorAll('table')).indexOf(table)

  const onDown = (e: MouseEvent) => {
    if (e.button !== 0) return
    const hit = edgeAt(e, root)
    if (!hit) return
    e.preventDefault()
    e.stopPropagation()
    const { table, index } = hit
    const cells = headCells(table)
    const scale = table.getBoundingClientRect().width / (table.offsetWidth || 1) || 1
    const start = cells.map((c) => c.offsetWidth)
    const x0 = e.clientX
    let widths = start.slice()
    setWidths(table, widths)
    root.classList.add('md-resizing')
    const move = (ev: MouseEvent) => {
      widths = start.slice()
      widths[index] = Math.round(Math.min(MAX_COL, Math.max(MIN_COL, start[index] + (ev.clientX - x0) / scale)))
      setWidths(table, widths)
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      root.classList.remove('md-resizing')
      if (widths.some((w, i) => w !== start[i])) save({ ...(current() ?? {}), [String(tableIndex(table))]: widths })
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const onDbl = (e: MouseEvent) => {
    const hit = edgeAt(e, root)
    if (!hit) return
    e.preventDefault()
    e.stopPropagation()
    const next = { ...(current() ?? {}) }
    delete next[String(tableIndex(hit.table))]
    save(Object.keys(next).length ? next : null)
  }

  root.addEventListener('mousemove', onMove)
  root.addEventListener('mouseleave', onLeave)
  root.addEventListener('mousedown', onDown, true)
  root.addEventListener('dblclick', onDbl, true)
  return () => {
    root.removeEventListener('mousemove', onMove)
    root.removeEventListener('mouseleave', onLeave)
    root.removeEventListener('mousedown', onDown, true)
    root.removeEventListener('dblclick', onDbl, true)
  }
}
