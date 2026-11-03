import type { JSONContent } from '@tiptap/react'

/** What the find bar looks for. */
export interface FindOptions {
  query: string
  caseSensitive: boolean
  wholeWord: boolean
}

/** Stands for an inline non-text node (mention, line break…): matches never span it. */
export const OBJECT_CHAR = '￼'
const WORD = /[\p{L}\p{N}_]/u

/** [start, end) offsets of every match of `opts` in `text` (non-overlapping, left to right). */
export function findInText(text: string, opts: FindOptions): Array<[number, number]> {
  const q = opts.query
  if (!q || !text) return []
  const hay = opts.caseSensitive ? text : text.toLowerCase()
  const needle = opts.caseSensitive ? q : q.toLowerCase()
  const out: Array<[number, number]> = []
  let i = 0
  while (i <= hay.length - needle.length) {
    const at = hay.indexOf(needle, i)
    if (at < 0) break
    const end = at + needle.length
    const ok = !opts.wholeWord || ((at === 0 || !WORD.test(text[at - 1])) && (end === text.length || !WORD.test(text[end])))
    if (ok) {
      out.push([at, end])
      i = end
    } else i = at + 1
  }
  return out
}

/** How many matches a stored document (JSON) has — counted the same way as in the editor. */
export function countInJson(doc: JSONContent | null | undefined, opts: FindOptions): number {
  if (!doc || !opts.query) return 0
  let n = 0
  const visit = (node: JSONContent) => {
    const kids = node.content ?? []
    if (kids.some((k) => k.type === 'text')) {
      n += findInText(kids.map((k) => (k.type === 'text' ? (k.text ?? '') : OBJECT_CHAR)).join(''), opts).length
      return
    }
    kids.forEach(visit)
  }
  visit(doc)
  return n
}
