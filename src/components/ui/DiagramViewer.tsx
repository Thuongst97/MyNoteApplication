import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Maximize, Minus, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const MIN_ZOOM = 0.05
const MAX_ZOOM = 8
const PAD = 48

interface View {
  x: number
  y: number
  k: number
}

/** Natural size of an SVG (viewBox, else width/height attributes, else its box). */
export function svgSize(svg: SVGSVGElement): { w: number; h: number } {
  const vb = svg.viewBox?.baseVal
  if (vb && vb.width > 0 && vb.height > 0) return { w: vb.width, h: vb.height }
  const w = parseFloat(svg.getAttribute('width') ?? '')
  const h = parseFloat(svg.getAttribute('height') ?? '')
  if (w > 0 && h > 0 && !String(svg.getAttribute('width')).includes('%')) return { w, h }
  const r = svg.getBoundingClientRect()
  return { w: r.width || 800, h: r.height || 600 }
}

/** Scale and offset that show a w×h diagram whole and centered in a W×H area. */
export function fitView(w: number, h: number, W: number, H: number): View {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((W - PAD * 2) / w, (H - PAD * 2) / h)))
  return { k, x: (W - w * k) / 2, y: (H - h * k) / 2 }
}

/** Zoom to `k` keeping the point (px, py) of the viewport in place. */
export function zoomAt(v: View, k: number, px: number, py: number): View {
  const nk = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k))
  return { k: nk, x: px - ((px - v.x) * nk) / v.k, y: py - ((py - v.y) * nk) / v.k }
}

/**
 * Full-window viewer for a large diagram (Mermaid, PlantUML…): drag to pan, wheel to zoom
 * around the cursor, Fit / 100%, keyboard + − 0 1 and arrows, Esc to close.
 * `svg` must already be safe markup (it's what the block itself shows).
 */
export function DiagramViewer({ svg, title, onClose }: { svg: string; title?: string; onClose: () => void }) {
  const areaRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const size = useRef({ w: 800, h: 600 })
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const [grabbing, setGrabbing] = useState(false)

  const area = () => areaRef.current!.getBoundingClientRect()
  const fit = useCallback(() => {
    const r = areaRef.current?.getBoundingClientRect()
    if (r) setView(fitView(size.current.w, size.current.h, r.width, r.height))
  }, [])
  const actualSize = () => {
    const r = area()
    setView({ k: 1, x: (r.width - size.current.w) / 2, y: Math.max(PAD, (r.height - size.current.h) / 2) })
  }
  const zoomBy = (f: number) => {
    const r = area()
    setView((v) => zoomAt(v, v.k * f, r.width / 2, r.height / 2))
  }

  // Put the diagram in at its natural size, then fit it to the window.
  useLayoutEffect(() => {
    const box = contentRef.current
    if (!box) return
    box.innerHTML = svg
    const el = box.querySelector('svg')
    if (el) {
      const s = svgSize(el)
      size.current = s
      el.setAttribute('width', String(s.w))
      el.setAttribute('height', String(s.h))
      el.style.maxWidth = 'none'
      el.style.width = `${s.w}px`
      el.style.height = `${s.h}px`
    }
    fit()
  }, [svg, fit])

  useEffect(() => {
    // The editor and the app's shortcuts stay out of the way while the viewer is open.
    document.body.classList.add('drawing-open')
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation()
      const step = 60
      if (e.key === 'Escape') onClose()
      else if (e.key === '+' || e.key === '=') zoomBy(1.25)
      else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.25)
      else if (e.key === '0') fit()
      else if (e.key === '1') actualSize()
      else if (e.key === 'ArrowLeft') setView((v) => ({ ...v, x: v.x + step }))
      else if (e.key === 'ArrowRight') setView((v) => ({ ...v, x: v.x - step }))
      else if (e.key === 'ArrowUp') setView((v) => ({ ...v, y: v.y + step }))
      else if (e.key === 'ArrowDown') setView((v) => ({ ...v, y: v.y - step }))
      else return
      e.preventDefault()
    }
    const onResize = () => fit()
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.body.classList.remove('drawing-open')
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, fit])

  // Wheel zooms around the cursor (a non-passive listener so the page doesn't scroll).
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015))
      setView((v) => zoomAt(v, v.k * f, e.clientX - r.left, e.clientY - r.top))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setGrabbing(true)
    let last = { x: e.clientX, y: e.clientY }
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - last.x
      const dy = ev.clientY - last.y
      last = { x: ev.clientX, y: ev.clientY }
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
    }
    const up = () => {
      setGrabbing(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const btn = 'flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-2 text-sm hover:bg-black/5 dark:hover:bg-white/10'

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title ?? 'Diagram'} className="fixed inset-0 z-[400] flex flex-col bg-canvas-light text-ink-light dark:bg-canvas-dark dark:text-ink-dark">
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-black/10 px-3 dark:border-white/10">
        <span className="mr-auto truncate text-sm font-medium">{title ?? 'Diagram'}</span>
        <span className="mr-2 hidden text-xs opacity-45 md:inline">Drag to move · scroll to zoom · Esc to close</span>
        <button type="button" className={btn} aria-label="Zoom out" title="Zoom out (−)" onClick={() => zoomBy(1 / 1.25)}>
          <Minus size={16} />
        </button>
        <button type="button" className={cn(btn, 'w-16 tabular-nums')} aria-label="Actual size" title="Actual size (1)" onClick={actualSize}>
          {Math.round(view.k * 100)}%
        </button>
        <button type="button" className={btn} aria-label="Zoom in" title="Zoom in (+)" onClick={() => zoomBy(1.25)}>
          <Plus size={16} />
        </button>
        <button type="button" className={btn} aria-label="Fit to window" title="Fit to window (0)" onClick={fit}>
          <Maximize size={15} /> Fit
        </button>
        <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
        <button type="button" className={btn} aria-label="Close" title="Close (Esc)" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <div
        ref={areaRef}
        data-testid="diagram-viewer-area"
        className={cn('relative min-h-0 flex-1 select-none overflow-hidden', grabbing ? 'cursor-grabbing' : 'cursor-grab')}
        onPointerDown={onPointerDown}
        onDoubleClick={(e) => {
          // Double-click: fit, or show 100% around the clicked spot when already fitted.
          const r = area()
          const fitted = fitView(size.current.w, size.current.h, r.width, r.height)
          if (Math.abs(view.k - fitted.k) < 0.01) setView((v) => zoomAt(v, 1, e.clientX - r.left, e.clientY - r.top))
          else fit()
        }}
      >
        <div
          ref={contentRef}
          className="diagram-viewer-content absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
        />
      </div>
    </div>,
    document.body,
  )
}
