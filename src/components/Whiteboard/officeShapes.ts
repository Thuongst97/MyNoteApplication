import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

/**
 * PowerPoint-like shapes for the drawing editor and whiteboards:
 * - new rectangles, ellipses and diamonds get a solid fill (the user can pick another color,
 *   or none, from Background); pen strokes stay unfilled;
 * - with one shape selected, just typing puts the text inside the shape (Excalidraw otherwise
 *   needs Enter or a double-click first).
 */

/** Default fill for new shapes (a soft blue, from Excalidraw's own palette). */
export const SHAPE_FILL = '#a5d8ff'

export const OFFICE_SHAPE_DEFAULTS = {
  currentItemBackgroundColor: SHAPE_FILL,
  currentItemFillStyle: 'solid',
} as const

/** Shapes text can be typed into. */
const CONTAINERS = new Set(['rectangle', 'ellipse', 'diamond'])
/** Tools whose drawings must not be filled (a pen stroke would become a blob). */
const NO_FILL_TOOLS = new Set(['freedraw'])

/** Whether a key press types a character (not a shortcut). */
export function isTypingKey(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
  return e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey
}

type MinimalState = Pick<AppState, 'activeTool' | 'currentItemBackgroundColor'>

/**
 * The fill to switch to when the tool changes: none while the pen is active (remembering the
 * shape fill), and the remembered fill again for shapes. Returns undefined when nothing changes.
 */
export function fillForTool(state: MinimalState, stash: { fill: string | null }): string | undefined {
  const tool = state.activeTool.type
  if (NO_FILL_TOOLS.has(tool)) {
    if (state.currentItemBackgroundColor !== 'transparent') {
      stash.fill = state.currentItemBackgroundColor
      return 'transparent'
    }
    return undefined
  }
  if (stash.fill && state.currentItemBackgroundColor === 'transparent') {
    const fill = stash.fill
    stash.fill = null
    return fill
  }
  if (stash.fill && tool !== 'selection') stash.fill = null
  return undefined
}

export function useOfficeShapes(api: ExcalidrawImperativeAPI | null, host: RefObject<HTMLElement | null>) {
  const stash = useRef<{ fill: string | null }>({ fill: null })
  const apiRef = useRef(api)
  apiRef.current = api

  const onAppStateChange = useCallback((state: AppState) => {
    const next = fillForTool(state, stash.current)
    if (next !== undefined) queueMicrotask(() => apiRef.current?.updateScene({ appState: { currentItemBackgroundColor: next } }))
  }, [])

  useEffect(() => {
    const el = host.current
    if (!el) return
    // Characters typed before the shape's text box has opened (it opens a frame or two later).
    let pending: string | null = null
    const flush = (tries: number) => {
      const box = el.querySelector<HTMLTextAreaElement>('textarea.excalidraw-wysiwyg')
      if (!box) {
        if (tries < 90) requestAnimationFrame(() => flush(tries + 1))
        else pending = null
        return
      }
      if (pending === null) return
      const text = pending
      pending = null
      box.focus()
      const start = box.selectionStart ?? box.value.length
      box.setRangeText(text, start, box.selectionEnd ?? start, 'end')
      box.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const onKey = (e: KeyboardEvent) => {
      const a = apiRef.current
      if (!a) return
      const t = e.target as HTMLElement | null
      if (pending !== null && el.querySelector('textarea.excalidraw-wysiwyg')) {
        // The text box just opened: put the waiting characters in first, then this key types normally.
        flush(0)
        return
      }
      if (t?.closest('input, textarea, [contenteditable="true"]') && pending === null) return
      if (pending !== null) {
        // Still opening the text box: keep what is typed (Backspace edits it).
        if (isTypingKey(e) || e.key === ' ') pending += e.key
        else if (e.key === 'Backspace') pending = pending.slice(0, -1)
        else return
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (!isTypingKey(e)) return
      const state = a.getAppState()
      if (state.editingTextElement || state.newElement || state.openDialog) return
      const ids = Object.keys(state.selectedElementIds).filter((id) => state.selectedElementIds[id])
      if (ids.length !== 1) return
      const shape = a.getSceneElements().find((x) => x.id === ids[0])
      if (!shape || !CONTAINERS.has(shape.type)) return
      // Start editing the shape's text (Excalidraw's Enter), then type into it.
      e.preventDefault()
      e.stopPropagation()
      pending = e.key
      ;(t ?? document).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))
      requestAnimationFrame(() => flush(0))
    }
    el.addEventListener('keydown', onKey, true)
    return () => el.removeEventListener('keydown', onKey, true)
  }, [host])

  return { onAppStateChange }
}
