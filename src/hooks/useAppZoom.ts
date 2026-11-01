import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { clampZoom, createWheelAccumulator, stepZoom } from '@/lib/zoom'

const ZOOM_KEY = 'notion-clone:zoom'
/** Surfaces with their own Ctrl+wheel zoom (whiteboard/drawing canvas, mind map, graph). */
const OWN_ZOOM = '[data-own-zoom], .excalidraw'

/**
 * Ctrl + mouse wheel (or trackpad pinch) zooms the whole app, like a browser.
 * The level is remembered between launches. Returns the current zoom while the
 * indicator should be visible, and a reset function.
 */
export function useAppZoom() {
  const [zoom, setZoom] = useState(() => api.zoom.get())
  const [visible, setVisible] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const show = (z: number) => {
    setZoom(z)
    setVisible(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setVisible(false), 1500)
  }

  const apply = (z: number, indicate = true) => {
    const next = clampZoom(z)
    api.zoom.set(next)
    try {
      localStorage.setItem(ZOOM_KEY, String(next))
    } catch {
      /* storage full or unavailable */
    }
    if (indicate) show(next)
    else setZoom(next)
  }

  useEffect(() => {
    // Restore the saved zoom.
    const saved = Number(localStorage.getItem(ZOOM_KEY))
    if (saved && Math.abs(saved - api.zoom.get()) > 0.001) apply(saved, false)

    const accumulate = createWheelAccumulator()
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || e.defaultPrevented) return
      if ((e.target as Element | null)?.closest?.(OWN_ZOOM)) return
      e.preventDefault()
      const dir = accumulate(e.deltaY, e.deltaMode)
      if (dir) apply(stepZoom(api.zoom.get(), dir))
    }
    // Zoom can also change from the View menu (Ctrl/⌘ +/−/0); it resizes the viewport, so sync then.
    const onResize = () => {
      const z = api.zoom.get()
      const stored = Number(localStorage.getItem(ZOOM_KEY)) || 1
      if (Math.abs(z - stored) > 0.001) {
        localStorage.setItem(ZOOM_KEY, String(z))
        show(z)
      }
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', onResize)
      clearTimeout(hideTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { zoom, visible, reset: () => apply(1) }
}
