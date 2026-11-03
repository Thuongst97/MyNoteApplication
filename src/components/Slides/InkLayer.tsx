import { useRef, useState } from 'react'
import { strokeHit, strokePath, type InkStroke } from '@/lib/presentation'
import { SLIDE_H, SLIDE_W } from './SlideCanvas'
import { cn } from '@/lib/utils'

export type InkTool = 'pen' | 'highlighter' | 'eraser'

export const PEN_WIDTHS = [3, 6, 12]
const HIGHLIGHTER_SCALE = 4
const ERASER_R = 14

/** One stroke as SVG. */
export function StrokeSvg({ s }: { s: InkStroke }) {
  return (
    <path
      d={strokePath(s.points)}
      fill="none"
      stroke={s.color}
      strokeWidth={s.width}
      strokeLinecap={s.tool === 'highlighter' ? 'square' : 'round'}
      strokeLinejoin="round"
      opacity={s.tool === 'highlighter' ? 0.4 : 1}
    />
  )
}

/**
 * Ink drawn over a slide (in slide coordinates). With a `tool`, the layer takes the pointer:
 * pen / highlighter draw, the eraser removes whole strokes it touches.
 */
export function InkLayer({
  strokes,
  tool,
  color,
  width,
  onAdd,
  onErase,
}: {
  strokes: InkStroke[]
  tool?: InkTool | null
  color?: string
  width?: number
  onAdd?: (s: InkStroke) => void
  onErase?: (keep: InkStroke[]) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [live, setLive] = useState<InkStroke | null>(null)
  const [erasing, setErasing] = useState<number[]>([])

  /** Pointer position in slide coordinates (the slide may be zoomed). */
  const at = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect()
    return [Math.round(((e.clientX - r.left) / r.width) * SLIDE_W * 10) / 10, Math.round(((e.clientY - r.top) / r.height) * SLIDE_H * 10) / 10]
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!tool || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const [x, y] = at(e)
    if (tool === 'eraser') {
      const hit = new Set<number>()
      const erase = (px: number, py: number) => {
        strokes.forEach((s, i) => strokeHit(s, px, py, ERASER_R) && hit.add(i))
        setErasing([...hit])
      }
      erase(x, y)
      const move = (ev: PointerEvent) => erase(...(at(ev) as [number, number]))
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        setErasing([])
        if (hit.size) onErase?.(strokes.filter((_, i) => !hit.has(i)))
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      return
    }
    const hl = tool === 'highlighter'
    const stroke: InkStroke = { tool, color: color ?? '#e03e3e', width: (width ?? 3) * (hl ? HIGHLIGHTER_SCALE : 1), points: [x, y] }
    setLive(stroke)
    const move = (ev: PointerEvent) => {
      const [px, py] = at(ev)
      const n = stroke.points.length
      // Skip points closer than a pixel and a half (keeps strokes small).
      if (Math.hypot(px - stroke.points[n - 2], py - stroke.points[n - 1]) < 1.5) return
      stroke.points = [...stroke.points, px, py]
      setLive({ ...stroke })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setLive(null)
      onAdd?.(stroke)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <svg
      ref={svgRef}
      data-testid="ink-layer"
      viewBox={`0 0 ${SLIDE_W} ${SLIDE_H}`}
      className={cn('absolute inset-0 z-10 h-full w-full', tool ? 'pointer-events-auto touch-none' : 'pointer-events-none', tool === 'eraser' ? 'cursor-cell' : tool && 'cursor-crosshair')}
      onPointerDown={onPointerDown}
    >
      {strokes.map((s, i) => (
        <g key={i} opacity={erasing.includes(i) ? 0.25 : 1}>
          <StrokeSvg s={s} />
        </g>
      ))}
      {live && <StrokeSvg s={live} />}
    </svg>
  )
}
