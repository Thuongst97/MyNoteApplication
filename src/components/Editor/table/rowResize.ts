import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { TableRow } from '@tiptap/extension-table'

/** Table rows with an optional height (px) set by dragging their bottom border. */
export const ResizableTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      height: {
        default: null,
        parseHTML: (el) => {
          const h = parseFloat((el as HTMLElement).style.height)
          return Number.isFinite(h) && h > 0 ? Math.round(h) : null
        },
        renderHTML: (attrs) => (attrs.height ? { style: `height: ${attrs.height}px` } : {}),
      },
    }
  },
})

export const ROW_MIN = 28
export const ROW_MAX = 1200
const EDGE = 4

/** A clamped row height, or null for "automatic". */
export function clampRowHeight(h: number | null | undefined): number | null {
  if (h == null || !Number.isFinite(h)) return null
  return Math.max(ROW_MIN, Math.min(ROW_MAX, Math.round(h)))
}

/** The table row whose bottom border is under the pointer (within a few px), if any. */
function rowEdgeAt(view: EditorView, e: MouseEvent): HTMLTableRowElement | null {
  const target = e.target as HTMLElement | null
  const cell = target?.closest?.('td, th') as HTMLElement | null
  if (!cell || !view.dom.contains(cell)) return null
  const tr = cell.parentElement as HTMLTableRowElement
  const r = tr.getBoundingClientRect()
  if (e.clientY >= r.bottom - EDGE && e.clientY <= r.bottom + 1) return tr
  // Just under the top edge of a row: that's the bottom edge of the row above.
  if (e.clientY <= r.top + EDGE - 1 && tr.previousElementSibling) return tr.previousElementSibling as HTMLTableRowElement
  return null
}

/** Document position of the tableRow node shown by `tr`. */
function rowPos(view: EditorView, tr: HTMLTableRowElement): number | null {
  const cell = tr.firstElementChild
  if (!cell) return null
  let inside: number
  try {
    inside = view.posAtDOM(cell, 0)
  } catch {
    return null
  }
  if (inside < 0 || inside > view.state.doc.content.size) return null
  const $p = view.state.doc.resolve(inside)
  for (let d = $p.depth; d > 0; d--) if ($p.node(d).type.name === 'tableRow') return $p.before(d)
  return null
}

function setRowHeight(view: EditorView, tr: HTMLTableRowElement, height: number | null) {
  const pos = rowPos(view, tr)
  if (pos === null) return
  view.dispatch(view.state.tr.setNodeAttribute(pos, 'height', clampRowHeight(height)))
}

/**
 * Drag a row's bottom border to change its height (double-click the border: automatic
 * height again). Column widths are handled by the table's own column resizing.
 */
export const RowResize = Extension.create({
  name: 'rowResize',
  addProseMirrorPlugins() {
    const editor = this.editor
    let dragging = false
    return [
      new Plugin({
        key: new PluginKey('rowResize'),
        props: {
          handleDOMEvents: {
            mousemove: (view, e) => {
              if (dragging || !editor.isEditable) return false
              view.dom.classList.toggle('row-resize-cursor', !!rowEdgeAt(view, e))
              return false
            },
            mouseleave: (view) => {
              if (!dragging) view.dom.classList.remove('row-resize-cursor')
              return false
            },
            dblclick: (view, e) => {
              if (!editor.isEditable) return false
              const tr = rowEdgeAt(view, e)
              if (!tr) return false
              e.preventDefault()
              setRowHeight(view, tr, null)
              return true
            },
            mousedown: (view, e) => {
              if (!editor.isEditable || e.button !== 0) return false
              const tr = rowEdgeAt(view, e)
              if (!tr) return false
              e.preventDefault()
              dragging = true
              // The editor may be drawn scaled (slides): convert screen px to CSS px.
              const rect = tr.getBoundingClientRect()
              const scale = rect.height / (tr.offsetHeight || 1) || 1
              const startY = e.clientY
              const startH = tr.offsetHeight
              let h = startH
              // The row itself can't change until the drop (the editor redraws it), so a guide
              // line shows where its bottom will be.
              const table = (tr.closest('table') ?? tr).getBoundingClientRect()
              const guide = document.createElement('div')
              guide.className = 'row-resize-guide'
              Object.assign(guide.style, { position: 'fixed', left: `${table.left}px`, width: `${table.width}px`, top: `${rect.bottom - 1}px`, height: '2px', background: '#2383e2', zIndex: '400', pointerEvents: 'none' })
              document.body.appendChild(guide)
              const move = (ev: MouseEvent) => {
                h = clampRowHeight(startH + (ev.clientY - startY) / scale)!
                guide.style.top = `${rect.top + h * scale - 1}px`
              }
              const up = () => {
                window.removeEventListener('mousemove', move)
                window.removeEventListener('mouseup', up)
                guide.remove()
                dragging = false
                view.dom.classList.remove('row-resize-cursor')
                if (h !== startH) setRowHeight(view, tr, h)
              }
              window.addEventListener('mousemove', move)
              window.addEventListener('mouseup', up)
              return true
            },
          },
        },
      }),
    ]
  },
})
