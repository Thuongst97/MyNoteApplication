import { markdownToHtml } from './markdown'
import { findInText, type FindOptions } from './find'

/**
 * Find inside blocks whose text is rendered from a stored source (Markdown blocks): the same
 * text segments are read from the rendered DOM (to highlight) and from the source (to count),
 * so both agree. A segment is the text of one block element (paragraph, list item, cell…);
 * matches never span segments.
 */

export interface TextSegment {
  text: string
  /** Text nodes of the segment with the offset where each starts in `text`. */
  parts: Array<{ node: Text; start: number }>
}

const BLOCK = new Set(['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TD', 'TH', 'PRE', 'BLOCKQUOTE', 'DIV', 'DT', 'DD', 'FIGCAPTION', 'SUMMARY', 'TABLE', 'UL', 'OL', 'SECTION'])
/** Rendered diagrams (and their source) are not searched: their text isn't readable as text. */
const SKIP = 'svg, style, script, .md-mermaid, code.language-mermaid'

function blockOf(node: Node, root: Node): Node {
  let el = node.parentNode
  while (el && el !== root) {
    if (el.nodeType === 1 && BLOCK.has((el as Element).tagName)) return el
    el = el.parentNode
  }
  return root
}

export function textSegments(root: Node): TextSegment[] {
  const doc = root.ownerDocument ?? (root as Document)
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */)
  const out: TextSegment[] = []
  let block: Node | null = null
  let seg: TextSegment | null = null
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const parent = n.parentElement
    if (!n.data || (parent && parent.closest(SKIP))) continue
    const b = blockOf(n, root)
    if (!seg || b !== block) {
      seg = { text: '', parts: [] }
      out.push(seg)
      block = b
    }
    seg.parts.push({ node: n, start: seg.text.length })
    seg.text += n.data
  }
  return out
}

const cache = new Map<string, string[]>()

/** Text segments of a Markdown source as it is rendered (cached by source). */
export function markdownSegments(source: string): string[] {
  const hit = cache.get(source)
  if (hit) return hit
  let texts: string[] = []
  if (source.trim() && typeof DOMParser !== 'undefined') {
    const body = new DOMParser().parseFromString(markdownToHtml(source), 'text/html').body
    texts = textSegments(body).map((s) => s.text)
  }
  if (cache.size > 200) cache.clear()
  cache.set(source, texts)
  return texts
}

/** Number of matches in a Markdown block. */
export function countInMarkdown(source: string, opts: FindOptions): number {
  if (!opts.query) return 0
  return markdownSegments(source).reduce((n, t) => n + findInText(t, opts).length, 0)
}

/** DOM ranges of every match in a rendered block, in order. */
export function rangesIn(root: Node, opts: FindOptions): Range[] {
  const doc = root.ownerDocument ?? (root as Document)
  const out: Range[] = []
  for (const seg of textSegments(root)) {
    for (const [a, b] of findInText(seg.text, opts)) {
      const at = (off: number, end: boolean) => {
        let p = seg.parts[0]
        for (const q of seg.parts) if (q.start < off || (!end && q.start === off)) p = q
        return { node: p.node, offset: off - p.start }
      }
      const s = at(a, false), e = at(b, true)
      const r = doc.createRange()
      r.setStart(s.node, s.offset)
      r.setEnd(e.node, e.offset)
      out.push(r)
    }
  }
  return out
}
