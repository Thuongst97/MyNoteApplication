import { withBlockBoundary } from '@/components/ui/ErrorBoundary'
import { mergeAttributes, Node, ReactNodeViewRenderer, type Editor } from '@tiptap/react'
import { TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * Inserts a block node at the cursor: replaces the current line if it's empty, otherwise
 * goes after the current block. The cursor ends up on a line after the new block, so the
 * next keystroke (or insert) can't replace it.
 */
export function insertBlockAtCursor(tr: Transaction, state: EditorState, node: PMNode) {
  const { $from, empty } = tr.selection
  // Work at the level of the line the cursor is in, so blocks inserted inside a callout,
  // column, toggle or list stay there (instead of jumping after the whole container).
  const d = $from.depth
  const line = d > 0 ? $from.node(d) : null
  const holder = d > 0 ? $from.node(d - 1) : null
  const index = d > 0 ? $from.index(d - 1) : 0
  const replaceEmpty = empty && !!line?.isTextblock && line.content.size === 0 && !!holder?.canReplaceWith(index, index + 1, node.type)
  let from = $from.pos
  if (replaceEmpty) from = $from.before(d)
  else {
    // After the current line, or after the nearest enclosing block that may be followed by
    // this block (e.g. a toggle's title line can't be followed by a diagram).
    for (let k = d; k >= 1; k--) {
      const parent = $from.node(k - 1)
      const at = $from.indexAfter(k - 1)
      if (parent.canReplaceWith(at, at, node.type)) {
        from = $from.after(k)
        break
      }
    }
  }
  const to = replaceEmpty ? $from.after(d) : from
  tr.replaceWith(from, to, node)
  const after = from + node.nodeSize
  if (!tr.doc.nodeAt(after)?.isTextblock) tr.insert(after, state.schema.nodes.paragraph.create())
  tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView()
}

/**
 * Moves the cursor to the start of the block after position `after`,
 * creating an empty paragraph there if needed. Leaving the diagram itself
 * selected would make the next keystroke replace it.
 */
export function placeCursorAfter(editor: Editor, after: number) {
  const { state, view } = editor
  let tr = state.tr
  const next = tr.doc.nodeAt(after)
  if (!next || !next.isTextblock) tr = tr.insert(after, state.schema.nodes.paragraph.create())
  tr = tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView()
  view.dispatch(tr)
  view.focus()
}
import { MermaidView } from './MermaidView'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: {
      /** Inserts a mermaid diagram block. With no code it opens in edit mode. */
      insertMermaid: (code?: string) => ReturnType
    }
  }
}

/** A block that stores mermaid source code and displays the rendered diagram. */
export const MermaidNode = Node.create({
  name: 'mermaid',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      code: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-code') ?? el.textContent ?? '',
        renderHTML: (attrs) => ({ 'data-code': attrs.code }),
      },
      align: {
        default: 'center',
        parseHTML: (el) => el.getAttribute('data-align') || 'center',
        renderHTML: (attrs) => ({ 'data-align': attrs.align }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(withBlockBoundary(MermaidView))
  },

  addCommands() {
    return {
      insertMermaid:
        (code = '') =>
        ({ tr, dispatch, state }) => {
          if (dispatch) insertBlockAtCursor(tr, state, this.type.create({ code }))
          return true
        },
    }
  },
})
