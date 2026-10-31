import { mergeAttributes, Node, ReactNodeViewRenderer, type Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'

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
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidView)
  },

  addCommands() {
    return {
      insertMermaid:
        (code = '') =>
        ({ tr, dispatch, state }) => {
          const node = this.type.create({ code })
          if (!dispatch) return true
          const { $from, empty } = tr.selection
          // Replace the current line if it's empty; otherwise insert after the current block.
          const parent = $from.depth > 0 ? $from.node($from.depth) : null
          const replaceEmpty = empty && parent?.isTextblock && parent.content.size === 0 && $from.depth === 1
          const from = replaceEmpty ? $from.before(1) : $from.depth > 0 ? $from.after(1) : $from.pos
          const to = replaceEmpty ? $from.after(1) : from
          tr.replaceWith(from, to, node)
          const after = from + node.nodeSize
          if (!tr.doc.nodeAt(after)?.isTextblock) tr.insert(after, state.schema.nodes.paragraph.create())
          // Cursor goes after the diagram (an empty diagram focuses its own code box instead).
          tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView()
          return true
        },
    }
  },
})
