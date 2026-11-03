import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { SlideData } from '@/lib/presentation'
import { cn } from '@/lib/utils'
import { SlideView } from './SlideCanvas'

/** Next slide index for a key in present mode (null = not a navigation key). */
export function presentKey(key: string, index: number, count: number): number | null {
  if (key === 'ArrowRight' || key === 'ArrowDown' || key === ' ' || key === 'PageDown' || key === 'Enter' || key === 'n') return Math.min(count - 1, index + 1)
  if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp' || key === 'Backspace' || key === 'p') return Math.max(0, index - 1)
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

/**
 * Full-screen slide show: → / Space / PageDown / click for the next slide, ← / PageUp for the
 * previous one, Home / End, B to black the screen, Esc to leave. `onClose` gets the slide
 * index the show ended on.
 */
export function PresentMode({ slides, font, start, onClose }: { slides: SlideData[]; font?: string | null; start: number; onClose: (index: number) => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(Math.max(0, Math.min(slides.length - 1, start)))
  const [black, setBlack] = useState(false)
  const [idle, setIdle] = useState(false)
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const indexRef = useRef(index)
  indexRef.current = index
  const close = useCallback(() => onClose(indexRef.current), [onClose])

  // Fill the screen; leaving full screen (Esc, F11…) ends the show.
  useEffect(() => {
    const el = rootRef.current
    let entered = false
    const onChange = () => {
      if (document.fullscreenElement) entered = true
      else if (entered) close()
    }
    document.addEventListener('fullscreenchange', onChange)
    el?.requestFullscreen?.().catch(() => {
      // Not allowed (e.g. tests): the overlay still covers the window.
    })
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    }
  }, [close])

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
      if (e.key === 'Escape') {
        e.preventDefault()
        return close()
      }
      if (e.key === 'b' || e.key === 'B' || e.key === '.') {
        e.preventDefault()
        return setBlack((b) => !b)
      }
      const next = presentKey(e.key, indexRef.current, slides.length)
      if (next === null) return
      e.preventDefault()
      setBlack(false)
      setIndex(next)
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.body.classList.remove('drawing-open')
      window.removeEventListener('keydown', onKey, true)
    }
  }, [close, slides.length])

  // Hide the cursor and controls when the mouse rests.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const wake = () => {
      setIdle(false)
      clearTimeout(t)
      t = setTimeout(() => setIdle(true), 2000)
    }
    wake()
    window.addEventListener('mousemove', wake)
    return () => {
      clearTimeout(t)
      window.removeEventListener('mousemove', wake)
    }
  }, [])

  const width = Math.floor(Math.min(size.w, (size.h * 16) / 9))
  const slide = slides[index]
  const go = (i: number) => {
    setBlack(false)
    setIndex(Math.max(0, Math.min(slides.length - 1, i)))
  }

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Presentation"
      data-testid="present-mode"
      className={cn('fixed inset-0 z-[500] flex select-none items-center justify-center bg-black', idle && 'cursor-none')}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        go(index + 1)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        go(index - 1)
      }}
    >
      {slide && (
        <div key={slide.id} className="animate-fade-in" style={{ width }}>
          <SlideView slide={slide} font={font} width={width} />
        </div>
      )}
      {black && <div className="absolute inset-0 bg-black" data-testid="present-black" />}
      {/* Progress along the bottom edge. */}
      <div className="pointer-events-none absolute bottom-0 left-0 h-[3px] bg-[#2383e2] transition-[width] duration-300" style={{ width: `${((index + 1) / slides.length) * 100}%` }} />
      <div
        className={cn(
          'absolute bottom-4 right-4 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-1 text-sm text-white/90 backdrop-blur transition-opacity',
          idle ? 'opacity-0' : 'opacity-100',
        )}
      >
        <button type="button" aria-label="Previous slide" className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/15" onClick={() => go(index - 1)}>
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-12 text-center tabular-nums" data-testid="present-counter">
          {index + 1} / {slides.length}
        </span>
        <button type="button" aria-label="Next slide" className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/15" onClick={() => go(index + 1)}>
          <ChevronRight size={16} />
        </button>
        <button type="button" aria-label="End presentation" title="End (Esc)" className="ml-1 flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/15" onClick={close}>
          <X size={15} />
        </button>
      </div>
    </div>,
    document.body,
  )
}
