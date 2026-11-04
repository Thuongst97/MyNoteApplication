import { Extension } from '@tiptap/react'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import { OBJECT_CHAR, findInText, type FindOptions } from '@/lib/find'
import { countInMarkdown, rangesIn } from '@/lib/findBlocks'

export interface FindMatch {
  from: number
  to: number
  /** For a match inside a rendered block (Markdown): its index among that block's matches. */
  inner?: number
}

interface FindState {
  opts: FindOptions | null
  matches: FindMatch[]
  /** Index of the current match (-1: none in this editor). */
  current: number
  deco: DecorationSet
}

/** Meta for the find plugin: new options and/or the current match. */
export interface FindMeta {
  opts?: FindOptions | null
  current?: number
}

export const findKey = new PluginKey<FindState>('find')

/** Every match in a document, in order (text of each text block; never across blocks). */
export function findMatchesInDoc(doc: PMNode, opts: FindOptions | null): FindMatch[] {
  if (!opts?.query) return []
  const out: FindMatch[] = []
  doc.descendants((node, pos) => {
    if (node.type.name === 'markdown') {
      const n = countInMarkdown(String(node.attrs.source ?? ''), opts)
      for (let i = 0; i < n; i++) out.push({ from: pos, to: pos + node.nodeSize, inner: i })
      return false
    }
    if (!node.isTextblock) return true
    let text = ''
    const starts: number[] = []
    node.forEach((child, offset) => {
      starts.push(text.length)
      text += child.isText ? (child.text ?? '') : OBJECT_CHAR
      void offset
    })
    if (!text) return false
    // Text offsets → document positions (each child's text starts at its position).
    const posOf: number[] = []
    let k = 0
    node.forEach((child, offset) => {
      const len = child.isText ? (child.text?.length ?? 0) : 1
      for (let j = 0; j < len; j++) posOf[starts[k] + j] = pos + 1 + offset + j
      k++
    })
    for (const [a, b] of findInText(text, opts)) out.push({ from: posOf[a], to: posOf[b - 1] + 1 })
    return false
  })
  return out
}

function build(doc: PMNode, opts: FindOptions | null, current: number): FindState {
  const matches = findMatchesInDoc(doc, opts)
  const cur = current >= 0 && current < matches.length ? current : -1
  const deco = DecorationSet.create(
    doc,
    matches.flatMap((m, i) => (m.inner === undefined ? [Decoration.inline(m.from, m.to, { class: i === cur ? 'find-match find-current' : 'find-match' })] : [])),
  )
  return { opts, matches, current: cur, deco }
}

/** Highlights the find bar's matches in an editor (driven by FindMeta transactions). */
export const FindHighlight = Extension.create({
  name: 'findHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findKey,
        state: {
          init: () => ({ opts: null, matches: [], current: -1, deco: DecorationSet.empty }),
          apply(tr: Transaction, prev: FindState, _old: EditorState, state: EditorState): FindState {
            const meta = tr.getMeta(findKey) as FindMeta | undefined
            if (meta) {
              const opts = meta.opts !== undefined ? meta.opts : prev.opts
              return build(state.doc, opts, meta.current !== undefined ? meta.current : prev.current)
            }
            if (tr.docChanged && prev.opts) return build(state.doc, prev.opts, prev.current)
            return prev
          },
        },
        props: {
          decorations: (state) => findKey.getState(state)?.deco ?? null,
        },
        view: (view) => new BlockHighlighter(view),
      }),
    ]
  },
})

/* Matches inside rendered blocks have no document positions: they are painted with the CSS
   Custom Highlight API (::highlight(find-match) / ::highlight(find-current)). */

const painted = new Map<EditorView, { all: Range[]; current: Range | null }>()

function publish() {
  const reg = (globalThis as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights
  const HighlightCtor = (globalThis as { Highlight?: new (...r: Range[]) => unknown }).Highlight
  if (!reg || !HighlightCtor) return
  const all: Range[] = []
  const cur: Range[] = []
  for (const p of painted.values()) {
    all.push(...p.all)
    if (p.current) cur.push(p.current)
  }
  if (all.length) reg.set('find-match', new HighlightCtor(...all))
  else reg.delete('find-match')
  if (cur.length) {
    const h = new HighlightCtor(...cur) as { priority?: number }
    h.priority = 1 // drawn over find-match
    reg.set('find-current', h)
  }
  else reg.delete('find-current')
}

/** The DOM range of the current match when it is inside a rendered block. */
export function currentBlockRange(view: EditorView): Range | null {
  return painted.get(view)?.current ?? null
}

class BlockHighlighter {
  private observer: MutationObserver | null = null
  private frame = 0

  constructor(private view: EditorView) {
    this.update()
  }

  update() {
    const st = findKey.getState(this.view.state)
    const has = !!st?.opts && st.matches.some((m) => m.inner !== undefined)
    if (has && !this.observer && typeof MutationObserver !== 'undefined') {
      // Rendered blocks fill in after the transaction (and re-render later): paint again then.
      this.observer = new MutationObserver(() => this.schedule())
      this.observer.observe(this.view.dom, { childList: true, subtree: true, characterData: true })
    } else if (!has && this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    this.paint()
  }

  private schedule() {
    if (this.frame) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.paint()
    })
  }

  private paint() {
    const st = findKey.getState(this.view.state)
    const hadAny = painted.has(this.view)
    if (!st?.opts || !st.matches.some((m) => m.inner !== undefined)) {
      if (hadAny) {
        painted.delete(this.view)
        publish()
      }
      return
    }
    const all: Range[] = []
    let current: Range | null = null
    const seen = new Set<number>()
    st.matches.forEach((m) => {
      if (m.inner === undefined || seen.has(m.from)) return
      seen.add(m.from)
      const dom = this.view.nodeDOM(m.from) as HTMLElement | null
      const root = dom?.querySelector?.('.markdown-body.selectable-text')
      if (!root) return
      const ranges = rangesIn(root, st.opts!)
      all.push(...ranges)
      const cur = st.matches[st.current]
      if (cur && cur.from === m.from && cur.inner !== undefined) current = ranges[cur.inner] ?? null
    })
    painted.set(this.view, { all, current })
    publish()
  }

  destroy() {
    this.observer?.disconnect()
    if (this.frame) cancelAnimationFrame(this.frame)
    if (painted.delete(this.view)) publish()
  }
}
