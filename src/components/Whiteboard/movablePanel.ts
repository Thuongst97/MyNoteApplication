import { useEffect, type RefObject } from 'react'

/**
 * Lets the user drag Excalidraw's shape-properties panel (stroke, background, fill…)
 * out of the way: it opens on the left and can cover the shapes being edited.
 *
 * Excalidraw renders the panel itself (and re-creates it whenever the selection
 * changes), so we watch for it, add a grip bar on top, and move it with the CSS
 * `translate` property. The position is remembered (also across app restarts);
 * double-click the grip to put it back.
 */

const PANEL = 'section.selected-shape-actions'
const STORAGE_KEY = 'premiumnote:shape-panel-offset'
/** Keep at least this much of the panel inside the canvas. */
const MARGIN = 8

export interface Offset {
  x: number
  y: number
}
export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

function loadOffset(): Offset {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) return { x: v.x, y: v.y }
  } catch {
    // ignore
  }
  return { x: 0, y: 0 }
}

let offset: Offset = { x: 0, y: 0 }
let loaded = false

function saveOffset(o: Offset) {
  offset = o
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(o))
  } catch {
    // ignore (storage full / unavailable)
  }
}

/**
 * Clamps `wanted` so the panel (whose un-moved box is `base`) stays inside `bounds`:
 * fully visible horizontally and vertically when it fits, otherwise its top-left
 * stays in view (the panel scrolls).
 */
export function clampOffset(wanted: Offset, base: Box, bounds: Box): Offset {
  const w = base.right - base.left
  const h = base.bottom - base.top
  const minX = bounds.left + MARGIN - base.left
  const maxX = Math.max(minX, bounds.right - MARGIN - w - base.left)
  const minY = bounds.top + MARGIN - base.top
  const maxY = Math.max(minY, bounds.bottom - MARGIN - Math.min(h, 120) - base.top)
  return {
    x: Math.round(Math.min(maxX, Math.max(minX, wanted.x))),
    y: Math.round(Math.min(maxY, Math.max(minY, wanted.y))),
  }
}

function apply(panel: HTMLElement, o: Offset) {
  panel.style.translate = o.x || o.y ? `${o.x}px ${o.y}px` : ''
}

/** Box the panel would have without our offset. */
function baseBox(panel: HTMLElement, o: Offset): Box {
  const r = panel.getBoundingClientRect()
  return { left: r.left - o.x, top: r.top - o.y, right: r.right - o.x, bottom: r.bottom - o.y }
}

function decorate(panel: HTMLElement, host: HTMLElement) {
  if (panel.dataset.movable) return
  panel.dataset.movable = '1'
  const grip = document.createElement('div')
  grip.className = 'pn-panel-grip'
  grip.title = 'Drag to move · double-click to reset'
  grip.setAttribute('aria-label', 'Move panel')
  grip.innerHTML = '<span></span>'
  panel.prepend(grip)

  // Keep the remembered position on screen (the window may be smaller now).
  const fit = () => {
    const b = host.getBoundingClientRect()
    const o = clampOffset(offset, baseBox(panel, offset), b)
    apply(panel, o)
  }
  fit()

  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    grip.setPointerCapture(e.pointerId)
    panel.classList.add('pn-panel-moving')
    const start = { x: e.clientX, y: e.clientY }
    const from = { ...offset }
    const base = baseBox(panel, offset)
    const bounds = host.getBoundingClientRect()
    let current = from
    const move = (ev: PointerEvent) => {
      current = clampOffset({ x: from.x + ev.clientX - start.x, y: from.y + ev.clientY - start.y }, base, bounds)
      apply(panel, current)
    }
    const up = () => {
      grip.removeEventListener('pointermove', move)
      grip.removeEventListener('pointerup', up)
      grip.removeEventListener('pointercancel', up)
      panel.classList.remove('pn-panel-moving')
      saveOffset(current)
    }
    grip.addEventListener('pointermove', move)
    grip.addEventListener('pointerup', up)
    grip.addEventListener('pointercancel', up)
  })
  grip.addEventListener('dblclick', (e) => {
    e.stopPropagation()
    saveOffset({ x: 0, y: 0 })
    apply(panel, offset)
  })
}

/** Makes the shape-properties panel inside `hostRef` draggable. */
export function useMovableShapePanel(hostRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (!loaded) {
      offset = loadOffset()
      loaded = true
    }
    const scan = () => host.querySelectorAll<HTMLElement>(PANEL).forEach((p) => decorate(p, host))
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(host, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [hostRef])
}

/** For tests. */
export function resetMovablePanel() {
  offset = { x: 0, y: 0 }
  loaded = false
}
