import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggleBlock: {
      /** Inserts a toggle (level 0) or toggle heading (1–4) at the current line, open, cursor in its title. */
      insertToggle: (level?: number) => ReturnType
    }
  }
}

/**
 * Toggle list / toggle heading (Notion): a title line with an arrow that shows or hides
 * the blocks inside. `level` 1–4 styles the title as a heading. Open/closed is saved.
 */
export const ToggleNode = Details.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      level: {
        default: 0,
        parseHTML: (el) => Math.min(4, Math.max(0, Number(el.getAttribute('data-level')) || 0)),
        renderHTML: (attrs) => (attrs.level ? { 'data-level': String(attrs.level) } : {}),
      },
    }
  },
  addCommands() {
    return {
      ...this.parent?.(),
      insertToggle:
        (level = 0) =>
        ({ state, chain }) => {
          const { $from } = state.selection
          const emptyLine = $from.parent.isTextblock && $from.parent.content.size === 0 && $from.depth > 0
          const from = emptyLine ? $from.before() : $from.after(Math.max(1, $from.depth))
          const to = emptyLine ? $from.after() : from
          return chain()
            .insertContentAt(
              { from, to },
              {
                type: this.name,
                attrs: { open: true, level: Math.min(4, Math.max(0, Math.round(level))) },
                content: [{ type: 'detailsSummary' }, { type: 'detailsContent', content: [{ type: 'paragraph' }] }],
              },
            )
            // details > summary: the title text starts 2 positions in.
            .setTextSelection(from + 2)
            .run()
        },
    }
  },
}).configure({ persist: true, HTMLAttributes: { class: 'toggle-block' } })

export { DetailsContent, DetailsSummary }
