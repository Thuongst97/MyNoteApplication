import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Eraser, Highlighter, MousePointer2, PenLine, Trash2, X, Zap } from 'lucide-react'
import { buildSteps, showStep, type InkStroke, type SlideData, type SlideTransition } from '@/lib/presentation'
import { cn } from '@/lib/utils'
import { SlideView } from './SlideCanvas'
import { InkLayer, StrokeSvg } from './InkLayer'

/** What a key does in present mode: move forward/back, jump to an end, or nothing (null). */
export function presentKey(key: string): 'next' | 'prev' | 'first' | 'last' | null {
  if (key === 'ArrowRight' || key === 'ArrowDown' || key === ' ' || key === 'PageDown' || key === 'Enter' || key === 'n') return 'next'
  if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp' || key === 'Backspace' || key === 'p') return 'prev'
  if (key === 'Home') return 'first'
  if (key === 'End') return 'last'
  return null
}

export type PresentTool = 'pointer' | 'pen' | 'highlighter' | 'eraser' | 'laser'
const PEN_COLOR = '#e03e3e'
const HL_COLOR = '#fde047'
const TRANSITION_MS = 600

/** Ink drawn during the show, per slide id (offered to keep when the show ends). */
export type ShowInk = Record<string, InkStroke[]>

/**
 * Full-screen slide show. → / Space / PageDown / click: next animation or slide; ← / PageUp:
 * back; Home / End; B: black screen; Ctrl+P pen, Ctrl+I highlighter, Ctrl+E eraser, Ctrl+L
 * laser pointer, Ctrl+A arrow, E: erase the slide's ink; Esc: back to the arrow, then end.
 * `onClose` gets the slide index the show ended on and the ink to keep (if any).
 */
export function PresentMode({ slides, font, start, onClose }: { slides: SlideData[]; font?: string | null; start: number; onClose: (index: number, keepInk?: ShowInk) => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ slide: Math.max(0, Math.min(slides.length - 1, start)), step: 0 })
  const [prev, setPrev] = useState<{ slide: number; dir: 1 | -1; transition: SlideTransition } | null>(null)
  const [black, setBlack] = useState(false)
  const [idle, setIdle] = useState(false)
  const [tool, setTool] = useState<PresentTool>('pointer')
  const [ink, setInk] = useState<ShowInk>({})
  const [askKeep, setAskKeep] = useState(false)
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const state = useRef({ pos, tool, ink, askKeep })
  state.current = { pos, tool, ink, askKeep }

  const finish = useCallback(
    (keep?: boolean) => onClose(state.current.pos.slide, keep ? state.current.ink : undefined),
    [onClose],
  )
  /** Ending the show: ask about ink drawn during it first. */
  const end = useCallback(() => {
    if (Object.values(state.current.ink).some((s) => s.length)) setAskKeep(true)
    else finish()
  }, [finish])

  const go = useCallback(
    (next: { slide: number; step: number }) => {
      const cur = state.current.pos
      setBlack(false)
      if (next.slide === cur.slide && next.step === cur.step) return
      if (next.slide !== cur.slide) {
        const dir = next.slide > cur.slide ? 1 : -1
        // The slide being entered decides the transition (going back plays it in reverse).
        const transition = slides[dir === 1 ? next.slide : cur.slide]?.transition ?? 'none'
        setPrev(transition === 'none' ? null : { slide: cur.slide, dir, transition })
      }
      setPos(next)
    },
    [slides],
  )
  const step = useCallback((dir: 1 | -1) => go(showStep(slides, state.current.pos, dir)), [go, slides])
  const jump = useCallback((slide: number, complete = false) => go({ slide, step: complete ? buildSteps(slides[slide]).length : 0 }), [go, slides])

  // The outgoing slide stays under the incoming one while the transition plays.
  useEffect(() => {
    if (!prev) return
    const t = setTimeout(() => setPrev(null), TRANSITION_MS)
    return () => clearTimeout(t)
  }, [prev])

  // Fill the screen; leaving full screen (Esc, F11…) ends the show.
  useEffect(() => {
    const el = rootRef.current
    let entered = false
    const onChange = () => {
      if (document.fullscreenElement) entered = true
      else if (entered) end()
    }
    document.addEventListener('fullscreenchange', onChange)
    el?.requestFullscreen?.().catch(() => {
      // Not allowed (e.g. tests): the overlay still covers the window.
    })
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [end])
  useEffect(
    () => () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    },
    [],
  )

  useLayoutEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Keys belong to the show while it runs (the editor and app shortcuts stay out of it).
  useEffect(() => {
    document.body.classList.add('drawing-open')
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (state.current.askKeep) return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      const toolKeys: Record<string, PresentTool> = { p: 'pen', i: 'highlighter', e: 'eraser', l: 'laser', a: 'pointer' }
      if (mod && toolKeys[k]) {
        e.preventDefault()
        return setTool((t) => (t === toolKeys[k] && k !== 'a' ? 'pointer' : toolKeys[k]))
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        // First Esc puts the pen away; the next one ends the show.
        if (state.current.tool !== 'pointer') return setTool('pointer')
        return end()
      }
      if (!mod && k === 'e') {
        e.preventDefault()
        const id = slides[state.current.pos.slide]?.id
        return id && setInk((m) => ({ ...m, [id]: [] }))
      }
      if (k === 'b' || e.key === '.') {
        e.preventDefault()
        return setBlack((b) => !b)
      }
      const action = presentKey(e.key)
      if (!action) return
      e.preventDefault()
      if (action === 'next') step(1)
      else if (action === 'prev') step(-1)
      else if (action === 'first') jump(0)
      else jump(slides.length - 1, true)
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.body.classList.remove('drawing-open')
      window.removeEventListener('keydown', onKey, true)
    }
  }, [end, step, jump, slides])

  // Hide the cursor and controls when the mouse rests (not while drawing or pointing).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const wake = () => {
      setIdle(false)
      clearTimeout(t)
      t = setTimeout(() => setIdle(true), 2500)
    }
    wake()
    window.addEventListener('mousemove', wake)
    return () => {
      clearTimeout(t)
      window.removeEventListener('mousemove', wake)
    }
  }, [])

  const width = Math.floor(Math.min(size.w, (size.h * 16) / 9))
  const slide = slides[pos.slide]
  const drawing = tool === 'pen' || tool === 'highlighter' || tool === 'eraser'
  const slideInk = slide ? (ink[slide.id] ?? []) : []
  const outgoing = prev ? slides[prev.slide] : null

  const showLayer = (s: SlideData, live: boolean) => (
    <>
      {/* Ink saved on the slide, then ink drawn during the show. */}
      {!!s.ink?.length && <InkLayer strokes={s.ink} />}
      {live ? (
        <InkLayer
          strokes={slideInk}
          tool={drawing ? (tool as 'pen' | 'highlighter' | 'eraser') : null}
          color={tool === 'highlighter' ? HL_COLOR : PEN_COLOR}
          width={4}
          onAdd={(st) => setInk((m) => ({ ...m, [s.id]: [...(m[s.id] ?? []), st] }))}
          onErase={(keep) => setInk((m) => ({ ...m, [s.id]: keep }))}
        />
      ) : (
        !!ink[s.id]?.length && (
          <svg viewBox="0 0 1280 720" className="pointer-events-none absolute inset-0 h-full w-full">
            {ink[s.id].map((st, i) => (
              <StrokeSvg key={i} s={st} />
            ))}
          </svg>
        )
      )}
    </>
  )

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Presentation"
      data-testid="present-mode"
      className={cn('fixed inset-0 z-[500] flex select-none items-center justify-center overflow-hidden bg-black', idle && tool === 'pointer' && 'cursor-none', tool === 'laser' && 'cursor-none')}
      onClick={(e) => {
        if (drawing || askKeep || (e.target as HTMLElement).closest('button, [data-present-ui]')) return
        step(1)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        if (!drawing && !askKeep) step(-1)
      }}
    >
      <div className="relative" style={{ width, height: (width * 9) / 16 }}>
        {outgoing && prev && (
          <div key={`out-${outgoing.id}`} className={cn('absolute inset-0', `pn-out-${prev.transition}-${prev.dir === 1 ? 'fwd' : 'back'}`)}>
            <SlideView slide={outgoing} font={font} width={width}>
              {showLayer(outgoing, false)}
            </SlideView>
          </div>
        )}
        {slide && (
          <div key={slide.id} className={cn('absolute inset-0', prev && `pn-in-${prev.transition}-${prev.dir === 1 ? 'fwd' : 'back'}`)} data-testid="present-slide">
            <SlideView slide={slide} font={font} width={width} step={pos.step} animate>
              {showLayer(slide, true)}
            </SlideView>
          </div>
        )}
      </div>
      {black && <div className="absolute inset-0 bg-black" data-testid="present-black" />}
      {tool === 'laser' && <LaserPointer />}
      {/* Progress along the bottom edge. */}
      <div className="pointer-events-none absolute bottom-0 left-0 h-[3px] bg-[#2383e2] transition-[width] duration-300" style={{ width: `${((pos.slide + 1) / slides.length) * 100}%` }} />

      <div
        data-present-ui=""
        className={cn(
          'absolute bottom-4 left-4 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-1 text-white/90 backdrop-blur transition-opacity',
          idle && tool === 'pointer' ? 'opacity-0' : 'opacity-100',
        )}
      >
        <ToolButton label="Arrow (Ctrl+A)" active={tool === 'pointer'} onClick={() => setTool('pointer')}>
          <MousePointer2 size={15} />
        </ToolButton>
        <ToolButton label="Pen (Ctrl+P)" active={tool === 'pen'} onClick={() => setTool('pen')}>
          <PenLine size={15} />
        </ToolButton>
        <ToolButton label="Highlighter (Ctrl+I)" active={tool === 'highlighter'} onClick={() => setTool('highlighter')}>
          <Highlighter size={15} />
        </ToolButton>
        <ToolButton label="Laser pointer (Ctrl+L)" active={tool === 'laser'} onClick={() => setTool('laser')}>
          <Zap size={15} />
        </ToolButton>
        <ToolButton label="Eraser (Ctrl+E)" active={tool === 'eraser'} onClick={() => setTool('eraser')}>
          <Eraser size={15} />
        </ToolButton>
        <ToolButton label="Erase all ink on slide (E)" onClick={() => slide && setInk((m) => ({ ...m, [slide.id]: [] }))} disabled={!slideInk.length}>
          <Trash2 size={15} />
        </ToolButton>
      </div>

      <div
        data-present-ui=""
        className={cn(
          'absolute bottom-4 right-4 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-1 text-sm text-white/90 backdrop-blur transition-opacity',
          idle && tool === 'pointer' ? 'opacity-0' : 'opacity-100',
        )}
      >
        <button type="button" aria-label="Previous" className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/15" onClick={() => step(-1)}>
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-12 text-center tabular-nums" data-testid="present-counter">
          {pos.slide + 1} / {slides.length}
        </span>
        <button type="button" aria-label="Next" className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/15" onClick={() => step(1)}>
          <ChevronRight size={16} />
        </button>
        <button type="button" aria-label="End presentation" title="End (Esc)" className="ml-1 flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/15" onClick={end}>
          <X size={15} />
        </button>
      </div>

      {askKeep && (
        <div data-present-ui="" className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div role="alertdialog" aria-label="Keep ink annotations?" className="w-[360px] rounded-xl bg-white p-5 text-[#37352f] shadow-2xl">
            <div className="mb-1 text-base font-semibold">Keep your ink annotations?</div>
            <p className="mb-4 text-sm opacity-70">What you drew during the presentation can be saved on the slides.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => finish(false)} className="rounded-md px-3 py-1.5 text-sm hover:bg-black/5">
                Discard
              </button>
              <button type="button" autoFocus onClick={() => finish(true)} className="rounded-md bg-[#2383e2] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1f75cb]">
                Keep
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

function ToolButton({ label, active, onClick, disabled, children }: { label: string; active?: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn('flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/15 disabled:opacity-30', active && 'bg-white/25 text-white')}
    >
      {children}
    </button>
  )
}

/** A red dot that follows the mouse with a short fading trail. */
function LaserPointer() {
  const [trail, setTrail] = useState<Array<{ x: number; y: number; t: number }>>([])
  useEffect(() => {
    let raf = 0
    const pts: Array<{ x: number; y: number; t: number }> = []
    const move = (e: PointerEvent) => {
      pts.push({ x: e.clientX, y: e.clientY, t: performance.now() })
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const tick = () => {
      raf = 0
      const now = performance.now()
      while (pts.length > 1 && now - pts[0].t > 250) pts.shift()
      setTrail([...pts])
      if (pts.length > 1) raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', move)
    return () => {
      window.removeEventListener('pointermove', move)
      cancelAnimationFrame(raf)
    }
  }, [])
  const head = trail[trail.length - 1]
  if (!head) return null
  return (
    <svg className="pointer-events-none fixed inset-0 z-[510] h-full w-full" data-testid="laser">
      {trail.length > 1 && <polyline points={trail.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#ff2a2a" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.45} />}
      <circle cx={head.x} cy={head.y} r={9} fill="#ff2a2a" opacity={0.35} />
      <circle cx={head.x} cy={head.y} r={5} fill="#ff3b3b" />
    </svg>
  )
}
