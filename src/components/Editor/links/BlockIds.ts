import { Extension, type Editor } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Fragment, Slice, type Node as PMNode } from '@tiptap/pm/model'
import { newId } from '@/lib/utils'

/** Block types that can be referenced ("Copy link to block"). */
export const REFERENCEABLE = [
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'taskItem',
  'image',
  'mermaid',
  'chart',
  'drawing',
  'pageLink',
]

/**
 * Adds an optional `blockId` to blocks. Ids are created only when a block is
 * referenced, aren't copied when a block is split or pasted, and are written to
 * the DOM as data-block-id so navigation can scroll to them.
 */
export const BlockIds = Extension.create({
  name: 'blockIds',

  addGlobalAttributes() {
    return [
      {
        types: REFERENCEABLE,
        attributes: {
          blockId: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => el.getAttribute('data-block-id'),
            renderHTML: (attrs) => (attrs.blockId ? { 'data-block-id': attrs.blockId } : {}),
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    // Pasted/duplicated content must not carry another block's id.
    const strip = (node: PMNode): PMNode => {
      const attrs = node.attrs.blockId ? { ...node.attrs, blockId: null } : node.attrs
      const content: PMNode[] = []
      node.content.forEach((c) => content.push(strip(c)))
      return node.isText ? node : node.type.create(attrs, Fragment.from(content), node.marks)
    }
    return [
      new Plugin({
        key: new PluginKey('blockIdsPaste'),
        props: {
          transformPasted: (slice) => {
            const nodes: PMNode[] = []
            slice.content.forEach((n) => nodes.push(strip(n)))
            return new Slice(Fragment.from(nodes), slice.openStart, slice.openEnd)
          },
        },
      }),
    ]
  },
})

/** Returns the block's id, assigning one if it doesn't have one yet. */
export function ensureBlockId(editor: Editor, pos: number): string | null {
  const node = editor.state.doc.nodeAt(pos)
  if (!node || !REFERENCEABLE.includes(node.type.name)) return null
  if (node.attrs.blockId) return node.attrs.blockId as string
  const id = newId().slice(0, 8) + newId().slice(9, 13)
  editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'blockId', id))
  return id
}

/** A short text excerpt of a block (for reference labels). */
export function blockSnippet(node: PMNode | null | undefined, max = 60): string {
  if (!node) return ''
  const names: Record<string, string> = { image: 'Image', mermaid: 'Diagram', chart: 'Chart', drawing: 'Drawing' }
  const text = node.textContent.replace(/\s+/g, ' ').trim()
  const label = text || names[node.type.name] || 'Block'
  return label.length > max ? label.slice(0, max - 1) + '…' : label
}
