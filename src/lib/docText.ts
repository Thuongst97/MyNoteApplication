import type { JSONContent } from '@tiptap/react'

/** Flattens a TipTap JSON document into plain text (blocks separated by newlines). */
export function docToText(node: JSONContent | null | undefined): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'mermaid') return String(node.attrs?.code ?? '')
  const inner = (node.content ?? []).map(docToText)
  const isBlockContainer = (node.content ?? []).some((c) => c.type !== 'text' && c.type !== 'hardBreak')
  return inner.join(isBlockContainer ? '\n' : '')
}

/** Returns a short excerpt around the first match of `query` in `text`, or null. */
export function makeSnippet(text: string, query: string): string | null {
  const flat = text.replace(/\s+/g, ' ')
  const at = flat.toLowerCase().indexOf(query.toLowerCase())
  if (at < 0) return null
  const start = Math.max(0, at - 40)
  return (start > 0 ? '…' : '') + flat.slice(start, at + query.length + 60).trim()
}
