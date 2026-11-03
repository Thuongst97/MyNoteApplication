import type { Editor } from '@tiptap/react'
import { countInJson, type FindOptions } from '@/lib/find'
import type { SlideData } from '@/lib/presentation'
import type { FindProvider } from '@/stores/useFindStore'
import { findMatches, scrollToCurrent, setFind } from '@/components/Editor/find/editorFind'

/** Editors of the slide being edited: 'main' (text area) or a box id → editor. */
const editors = new Map<string, Editor>()
const listeners = new Set<(key: string, editor: Editor) => void>()

/** Called by the slide's editors when they're ready; returns the unregister function. */
export function registerSlideEditor(key: string, editor: Editor) {
  editors.set(key, editor)
  listeners.forEach((l) => l(key, editor))
  const off = () => {
    if (editors.get(key) === editor) editors.delete(key)
  }
  editor.on('destroy', off)
  return off
}

interface Hit {
  slideId: string
  /** 'main' or a box id. */
  key: string
  /** Index among that editor's matches. */
  local: number
}

/** Every match in a presentation, slide by slide (main text area first, then boxes). */
export function presentationHits(slides: SlideData[], opts: FindOptions): Hit[] {
  const hits: Hit[] = []
  for (const s of slides) {
    const docs: Array<[string, SlideData['content']]> = [['main', s.content], ...(s.boxes ?? []).map((b) => [b.id, b.content] as [string, SlideData['content']])]
    for (const [key, doc] of docs) {
      const n = countInJson(doc, opts)
      for (let i = 0; i < n; i++) hits.push({ slideId: s.id, key, local: i })
    }
  }
  return hits
}

/** Find target for a presentation: searches all slides and opens the slide of a match. */
export function slidesFindProvider(get: { slides: () => SlideData[]; currentId: () => string | null; open: (slideId: string) => void }): FindProvider & { dispose: () => void } {
  let opts: FindOptions | null = null
  let hits: Hit[] = []
  let shown: Hit | null = null

  const apply = (key: string, ed: Editor) => {
    const cur = shown && shown.slideId === get.currentId() && shown.key === key ? shown.local : -1
    setFind(ed, { opts, current: cur })
    if (cur >= 0) scrollToCurrent(ed)
  }
  // Editors of a slide opened to show a match pick up the highlights when they're ready.
  const onEditor = (key: string, ed: Editor) => {
    if (opts) setTimeout(() => !ed.isDestroyed && apply(key, ed))
  }
  listeners.add(onEditor)

  return {
    search: (o) => {
      opts = o
      hits = presentationHits(get.slides(), o)
      shown = null
      editors.forEach((ed, key) => apply(key, ed))
      return hits.length
    },
    reveal: (i) => {
      const hit = hits[i]
      if (!hit || !opts) return
      shown = hit
      if (hit.slideId !== get.currentId()) get.open(hit.slideId)
      else editors.forEach((ed, key) => apply(key, ed))
    },
    clear: () => {
      opts = null
      shown = null
      editors.forEach((ed) => setFind(ed, { opts: null, current: -1 }))
    },
    startIndex: () => {
      const i = hits.findIndex((h) => h.slideId === get.currentId())
      return i < 0 ? 0 : i
    },
    selectedText: () => {
      for (const ed of editors.values()) {
        if (ed.isDestroyed || !ed.isFocused) continue
        const { from, to } = ed.state.selection
        return ed.state.doc.textBetween(from, to, ' ').trim()
      }
      return ''
    },
    dispose: () => void listeners.delete(onEditor),
  }
}

/** For tests: how many matches the editors of the shown slide highlight. */
export const highlightedOnSlide = () => [...editors.values()].reduce((n, ed) => n + findMatches(ed).length, 0)
