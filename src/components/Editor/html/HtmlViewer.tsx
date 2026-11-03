import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Minus, Monitor, Plus, Smartphone, Tablet, X, Maximize } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SANDBOX_ESCAPE } from './HtmlSandbox'

/** Page widths to view a big HTML block at (null = the window's width). */
export const VIEW_WIDTHS: Array<{ id: string; label: string; width: number | null; icon: typeof Monitor }> = [
  { id: 'fit', label: 'Fit window', width: null, icon: Maximize },
  { id: 'desktop', label: 'Desktop (1280)', width: 1280, icon: Monitor },
  { id: 'tablet', label: 'Tablet (768)', width: 768, icon: Tablet },
  { id: 'mobile', label: 'Mobile (390)', width: 390, icon: Smartphone },
]
const ZOOMS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]

/** Next zoom step up (+1) or down (-1) from `z`. */
export function stepZoom(z: number, dir: 1 | -1): number {
  if (dir === 1) return ZOOMS.find((v) => v > z + 0.001) ?? ZOOMS[ZOOMS.length - 1]
  return [...ZOOMS].reverse().find((v) => v < z - 0.001) ?? ZOOMS[0]
}

/**
 * Full-window view of an HTML block (a whole web page, a dashboard, an app…): pick a page
 * width like a browser's device toolbar, zoom, scroll; Esc closes. `children` renders the
 * block (it fills the area given to it).
 */
export function HtmlViewer({ title = 'HTML', onClose, children }: { title?: string; onClose: () => void; children: (fill: true) => React.ReactNode }) {
  const [width, setWidth] = useState<string>('fit')
  const [zoom, setZoom] = useState(1)
  const w = VIEW_WIDTHS.find((v) => v.id === width)?.width ?? null

  useEffect(() => {
    // The editor and the app's shortcuts stay out of the way while the viewer is open.
    document.body.classList.add('drawing-open')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        setZoom((z) => stepZoom(z, 1))
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault()
        setZoom((z) => stepZoom(z, -1))
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault()
        setZoom(1)
      }
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener(SANDBOX_ESCAPE, onClose)
    return () => {
      document.body.classList.remove('drawing-open')
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener(SANDBOX_ESCAPE, onClose)
    }
  }, [onClose])

  const btn = 'flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-2 text-sm hover:bg-black/5 dark:hover:bg-white/10'

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} data-testid="html-viewer" className="fixed inset-0 z-[400] flex flex-col bg-canvas-light text-ink-light dark:bg-canvas-dark dark:text-ink-dark">
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-black/10 px-3 dark:border-white/10">
        <span className="mr-auto truncate text-sm font-medium">{title}</span>
        <div className="flex items-center rounded-lg bg-black/[0.04] p-0.5 dark:bg-white/[0.06]" role="radiogroup" aria-label="Page width">
          {VIEW_WIDTHS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={width === v.id}
              aria-label={v.label}
              title={v.label}
              onClick={() => setWidth(v.id)}
              className={cn('flex h-7 items-center gap-1 rounded-md px-2 text-xs', width === v.id ? 'bg-white shadow-sm dark:bg-[#333]' : 'opacity-70 hover:opacity-100')}
            >
              <v.icon size={14} /> <span className="hidden md:inline">{v.label.replace(/ \(.*\)/, '')}</span>
            </button>
          ))}
        </div>
        <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
        <button type="button" className={btn} aria-label="Zoom out" title="Zoom out (Ctrl −)" onClick={() => setZoom((z) => stepZoom(z, -1))}>
          <Minus size={16} />
        </button>
        <button type="button" className={cn(btn, 'w-14 tabular-nums')} aria-label="Reset zoom" title="Reset zoom (Ctrl 0)" onClick={() => setZoom(1)}>
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className={btn} aria-label="Zoom in" title="Zoom in (Ctrl +)" onClick={() => setZoom((z) => stepZoom(z, 1))}>
          <Plus size={16} />
        </button>
        <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
        <button type="button" className={btn} aria-label="Close" title="Close (Esc)" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <div className={cn('min-h-0 flex-1 overflow-auto', w !== null && 'bg-black/[0.04] dark:bg-white/[0.03]')} data-testid="html-viewer-area">
        <div
          className={cn('mx-auto flex min-h-full flex-col', w !== null ? 'my-4 bg-canvas-light shadow-[0_2px_20px_rgba(0,0,0,0.15)] dark:bg-canvas-dark' : 'w-full')}
          style={{ width: w ? w * zoom : undefined, minHeight: w ? 'calc(100% - 2rem)' : undefined }}
        >
          <div className="flex min-h-0 flex-1 flex-col" style={{ zoom }} data-testid="html-viewer-page" data-width={w ?? 'fit'}>
            {children(true)}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
