import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

type Arrowhead = 'arrow' | 'bar' | 'dot' | 'circle' | 'triangle' | 'diamond' | null | string

/** Minimal appState fields we read. */
interface ToolState {
  activeTool: { type: string }
  currentItemStartArrowhead: Arrowhead
  currentItemEndArrowhead: Arrowhead
}

/**
 * Adds a "Two-way arrow" tool next to Excalidraw's arrow tool: arrows drawn with it get an
 * arrowhead at both ends. Picking the normal arrow tool (or pressing A / 5) goes back to one-way.
 */
export function useTwoWayArrowTool(api: ExcalidrawImperativeAPI | null) {
  const [active, setActive] = useState(false)
  const activeRef = useRef(false)
  activeRef.current = active
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  /** Arrowheads in use before switching to two-way, restored afterwards. */
  const saved = useRef<{ start: Arrowhead; end: Arrowhead }>({ start: null, end: 'arrow' })

  const turnOff = useCallback(() => {
    if (!activeRef.current || !api) return
    activeRef.current = false
    setActive(false)
    api.updateScene({ appState: { currentItemStartArrowhead: saved.current.start, currentItemEndArrowhead: saved.current.end } as never })
  }, [api])

  const turnOn = useCallback(() => {
    if (!api) return
    const st = api.getAppState() as unknown as ToolState
    if (!activeRef.current) saved.current = { start: st.currentItemStartArrowhead ?? null, end: st.currentItemEndArrowhead ?? 'arrow' }
    activeRef.current = true
    setActive(true)
    api.setActiveTool({ type: 'arrow' })
    api.updateScene({ appState: { currentItemStartArrowhead: 'arrow', currentItemEndArrowhead: 'arrow' } as never })
  }, [api])

  // Place our button right after Excalidraw's arrow tool (re-adding it if the toolbar re-renders).
  useEffect(() => {
    if (!api) return
    let span: HTMLSpanElement | null = null
    const place = () => {
      const arrow = document.querySelector<HTMLInputElement>('[data-testid="toolbar-arrow"]')?.closest('label')
      if (!arrow) return
      if (span && span.isConnected && span.previousElementSibling === arrow) return
      span ??= Object.assign(document.createElement('span'), { className: 'two-way-arrow-slot' })
      arrow.after(span)
      setSlot(span)
    }
    place()
    const root = document.querySelector('.excalidraw') ?? document.body
    const mo = new MutationObserver(place)
    mo.observe(root, { childList: true, subtree: true })

    // Choosing the normal arrow tool (click, or A / 5) switches back to one-way arrows.
    const onPointer = (e: Event) => {
      if ((e.target as HTMLElement).closest?.('label')?.querySelector('[data-testid="toolbar-arrow"]')) turnOff()
    }
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.ctrlKey || e.metaKey || e.altKey || t.closest('input, textarea, [contenteditable="true"]')) return
      if (e.key === 'a' || e.key === 'A' || e.key === '5') turnOff()
    }
    root.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      mo.disconnect()
      root.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('keydown', onKey, true)
      span?.remove()
    }
  }, [api, turnOff])

  return {
    active,
    /** Call from <Excalidraw onChange>: leaving the arrow tool ends two-way mode. */
    onAppStateChange: (appState: { activeTool: { type: string } }) => {
      if (activeRef.current && appState.activeTool.type !== 'arrow') turnOff()
    },
    /** The toolbar button (rendered into Excalidraw's toolbar). */
    button: slot
      ? createPortal(
          <label className="ToolIcon Shape" title="Two-way arrow — arrowheads at both ends">
            <input
              className="ToolIcon_type_radio ToolIcon_size_medium"
              type="radio"
              name="two-way-arrow"
              aria-label="Two-way arrow"
              data-testid="toolbar-two-way-arrow"
              checked={active}
              onChange={() => turnOn()}
              onClick={() => turnOn()}
            />
            <div className="ToolIcon__icon">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="12" x2="20" y2="12" />
                <polyline points="8 8 4 12 8 16" />
                <polyline points="16 8 20 12 16 16" />
              </svg>
            </div>
          </label>,
          slot,
        )
      : null,
  }
}
