import type { Editor } from '@tiptap/react'
import { findKey, type FindMeta } from './findPlugin'
import type { FindOptions } from '@/lib/find'
import type { FindProvider } from '@/stores/useFindStore'

/** Sends find options / the current match to an editor. */
export function setFind(editor: Editor, meta: FindMeta) {
  if (editor.isDestroyed) return
  editor.view.dispatch(editor.state.tr.setMeta(findKey, meta).setMeta('addToHistory', false))
}

export const findMatches = (editor: Editor) => findKey.getState(editor.state)?.matches ?? []

/** Scrolls the current match of an editor into the middle of the view. */
export function scrollToCurrent(editor: Editor) {
  requestAnimationFrame(() => {
    if (editor.isDestroyed) return
    const el = editor.view.dom.querySelector('.find-current') as HTMLElement | null
    el?.scrollIntoView({ block: 'center', inline: 'nearest' })
  })
}

/** Find target for a single editor (a normal page). */
export function editorFindProvider(getEditor: () => Editor | null): FindProvider {
  let opts: FindOptions | null = null
  return {
    search: (o) => {
      const ed = getEditor()
      if (!ed || ed.isDestroyed) return 0
      opts = o
      setFind(ed, { opts: o, current: -1 })
      return findMatches(ed).length
    },
    reveal: (i) => {
      const ed = getEditor()
      if (!ed || ed.isDestroyed || !opts) return
      setFind(ed, { current: i })
      scrollToCurrent(ed)
    },
    clear: () => {
      const ed = getEditor()
      opts = null
      if (ed && !ed.isDestroyed) setFind(ed, { opts: null, current: -1 })
    },
    startIndex: () => {
      const ed = getEditor()
      if (!ed || ed.isDestroyed) return 0
      const at = ed.state.selection.from
      const i = findMatches(ed).findIndex((m) => m.from >= at)
      return i < 0 ? 0 : i
    },
    selectedText: () => {
      const ed = getEditor()
      if (!ed || ed.isDestroyed) return ''
      const { from, to } = ed.state.selection
      return ed.state.doc.textBetween(from, to, ' ').trim()
    },
  }
}
