import { useRef, useState } from 'react'
import { widthFromDrag, widthLabel, type PageWidth } from '@/lib/pageWidth'
import { cn } from '@/lib/utils'

interface Props {
  /** The content column being resized (centered with mx-auto). */
  columnRef: React.RefObject<HTMLDivElement>
  /** Called continuously while dragging (preview). */
  onPreview: (width: PageWidth | undefined) => void
  /** Called once when the drag ends (save). */
  onCommit: (width: PageWidth) => void
}

/**
 * Drag handles on the left and right edge of the page column. Dragging either edge
 * resizes the column symmetrically; double-click resets to the default width.
 */
export function WidthHandles({ columnRef, onPreview, onCommit }: Props) {
  const [dragging, setDragging] = useState<PageWidth | undefined>(undefined)
  const state = useRef<{ center: number; available: number; last: PageWidth } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    const col = columnRef.current
    const scroller = col?.parentElement?.closest('#canvas-scroll') as HTMLElement | null
    if (!col) return
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const r = col.getBoundingClientRect()
    const available = scroller?.clientWidth ?? window.innerWidth
    state.current = { center: r.left + r.width / 2, available, last: null }
    setDragging(widthFromDrag(state.current.center, e.clientX, available))
    document.body.style.cursor = 'ew-resize'
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const s = state.current
    if (!s) return
    const w = widthFromDrag(s.center, e.clientX, s.available)
    s.last = w
    setDragging(w)
    onPreview(w)
  }
  const onPointerUp = () => {
    const s = state.current
    state.current = null
    document.body.style.cursor = ''
    setDragging(undefined)
    if (s) onCommit(s.last)
    onPreview(undefined)
  }

  const handle = (side: 'left' | 'right') => (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize page width (${side} edge)`}
      title="Drag to change page width · double-click to reset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={() => onCommit(null)}
      className={cn(
        'group/wh absolute bottom-0 top-0 z-10 flex w-4 cursor-ew-resize justify-center',
        side === 'left' ? 'left-0' : 'right-0',
      )}
    >
      <div
        className={cn(
          'sticky top-[35vh] h-24 w-1 rounded-full bg-black/15 opacity-0 transition-opacity group-hover/wh:opacity-100 dark:bg-white/20',
          dragging !== undefined && 'bg-blue-500 opacity-100 dark:bg-blue-400',
        )}
      />
    </div>
  )

  return (
    <>
      {handle('left')}
      {handle('right')}
      {dragging !== undefined && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-md bg-[#2f2f2f] px-2.5 py-1 text-xs text-white shadow-lg dark:bg-[#ebebea] dark:text-[#191919]">
          {widthLabel(dragging)}
        </div>
      )}
    </>
  )
}
