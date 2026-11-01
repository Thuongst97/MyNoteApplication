import { mergeAttributes, Node } from '@tiptap/react'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      /** Replaces the current empty line with `count` side-by-side columns. */
      insertColumns: (count?: number) => ReturnType
    }
  }
}

/** One column of a {@link ColumnsNode}. Holds any blocks. */
export const ColumnNode = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column' }), 0]
  },
})

/** Blocks side by side (2–5 equal columns), like Notion's columns. */
export const ColumnsNode = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column{2,5}',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-type="columns"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'columns' }), 0]
  },
  addCommands() {
    return {
      insertColumns:
        (count = 2) =>
        ({ state, chain }) => {
          const n = Math.min(5, Math.max(2, Math.round(count)))
          const json = { type: this.name, content: Array.from({ length: n }, () => ({ type: 'column', content: [{ type: 'paragraph' }] })) }
          const { $from } = state.selection
          // Replace the current line when it's empty, otherwise insert after it.
          const emptyLine = $from.parent.isTextblock && $from.parent.content.size === 0 && $from.depth > 0
          const from = emptyLine ? $from.before() : $from.after(Math.max(1, $from.depth))
          const to = emptyLine ? $from.after() : from
          // columns > column > paragraph: the first column's text starts 3 positions in.
          return chain().insertContentAt({ from, to }, json).setTextSelection(from + 3).run()
        },
    }
  },
})
