import { Extension } from '@tiptap/react'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { OBJECT_CHAR, findInText, type FindOptions } from '@/lib/find'

export interface FindMatch {
  from: number
  to: number
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
    matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === cur ? 'find-match find-current' : 'find-match' })),
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
      }),
    ]
  },
})
