import { mergeAttributes, Node, ReactNodeViewRenderer } from '@tiptap/react'
import { withBlockBoundary } from '@/components/ui/ErrorBoundary'
import { insertBlockAtCursor } from '../mermaid/MermaidNode'
import { MarkdownView } from './MarkdownView'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    markdown: {
      /** Inserts a Markdown block. With no source it opens in edit mode. */
      insertMarkdown: (source?: string) => ReturnType
    }
  }
}

/** A block that stores Markdown source and shows it rendered (headings, tables, code, Mermaid…). */
export const MarkdownNode = Node.create({
  name: 'markdown',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      source: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-source') ?? '',
        renderHTML: (attrs) => ({ 'data-source': attrs.source }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="markdown"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'markdown' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(withBlockBoundary(MarkdownView))
  },

  addCommands() {
    return {
      insertMarkdown:
        (source = '') =>
        ({ tr, dispatch, state }) => {
          if (dispatch) insertBlockAtCursor(tr, state, this.type.create({ source: String(source) }))
          return true
        },
    }
  },
})
