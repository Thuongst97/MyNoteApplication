import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

/** Characters of a word in code (like VS Code: letters, digits, _ and $). */
const WORD = /[\p{L}\p{N}_$]/u
const SPACE = /[ \t]/

/**
 * The range (offsets in the code text) selected by clicking `count` times at `offset`:
 * 2 = the word (or the run of spaces / of symbols), 3 = the line with its line break,
 * 4+ = all the code.
 */
export function codeClickRange(text: string, offset: number, count: number): { from: number; to: number } | null {
  if (count >= 4) return { from: 0, to: text.length }
  if (count === 3) {
    const start = text.lastIndexOf('\n', offset - 1) + 1
    const nl = text.indexOf('\n', offset)
    return { from: start, to: nl < 0 ? text.length : nl + 1 }
  }
  if (count === 2) {
    if (!text.length) return null
    // Clicking just after the last character of a line still means that character.
    let at = Math.min(offset, text.length - 1)
    if ((text[at] === '\n' || at === text.length) && at > 0 && text[at - 1] !== '\n') at -= 1
    const ch = text[at]
    if (ch === '\n') return { from: at, to: at }
    const kind = (c: string | undefined) => (c === undefined || c === '\n' ? 'stop' : WORD.test(c) ? 'word' : SPACE.test(c) ? 'space' : 'symbol')
    const k = kind(ch)
    let from = at
    let to = at + 1
    while (from > 0 && kind(text[from - 1]) === k) from--
    while (to < text.length && kind(text[to]) === k) to++
    return { from, to }
  }
  return null
}

/** The code block under a mouse event, with the text offset clicked. */
function codeAt(view: EditorView, e: MouseEvent) {
  const hit = view.posAtCoords({ left: e.clientX, top: e.clientY })
  if (!hit) return null
  const $pos = view.state.doc.resolve(hit.pos)
  if ($pos.parent.type.name !== 'codeBlock') return null
  return { start: $pos.start(), offset: $pos.parentOffset, text: $pos.parent.textContent }
}

/** Double / triple / quadruple click selection inside code blocks, as in code editors. */
export function codeClickPlugin() {
  return new Plugin({
    key: new PluginKey('codeClicks'),
    props: {
      handleDOMEvents: {
        mousedown: (view, e) => {
          if (e.button !== 0 || e.detail < 2 || e.shiftKey || e.altKey) return false
          if (!(e.target as HTMLElement)?.closest?.('pre')) return false
          const at = codeAt(view, e)
          if (!at) return false
          const range = codeClickRange(at.text, at.offset, e.detail)
          if (!range) return false
          e.preventDefault()
          const { tr } = view.state
          view.dispatch(tr.setSelection(TextSelection.create(tr.doc, at.start + range.from, at.start + range.to)))
          if (!view.hasFocus()) view.focus()
          return true
        },
        // The browser would otherwise put the caret back at the click on the 4th click.
        mouseup: (view, e) => {
          if (e.button !== 0 || e.detail < 2 || e.shiftKey || e.altKey) return false
          if (!(e.target as HTMLElement)?.closest?.('pre') || !codeAt(view, e)) return false
          e.preventDefault()
          return true
        },
      },
    },
  })
}
