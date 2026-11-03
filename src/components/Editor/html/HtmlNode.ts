import { mergeAttributes, Node, ReactNodeViewRenderer } from '@tiptap/react'
import { withBlockBoundary } from '@/components/ui/ErrorBoundary'
import { insertBlockAtCursor } from '../mermaid/MermaidNode'
import { HtmlView } from './HtmlView'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    htmlBlock: {
      /** Inserts an HTML block. With no source it opens in edit mode. */
      insertHtmlBlock: (source?: string, opts?: { interactive?: boolean }) => ReturnType
    }
  }
}

/** A block that stores HTML (+ CSS) and shows it rendered, sanitized and style-isolated. */
export const HtmlNode = Node.create({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  // Not natively draggable: dragging across the rendered text must select it (for copying).
  // The block still moves with its ⋮⋮ handle.
  draggable: false,
  selectable: true,

  addAttributes() {
    return {
      source: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-source') ?? '',
        renderHTML: (attrs) => ({ 'data-source': attrs.source }),
      },
      /** Run the block's JavaScript (in a sandboxed frame). */
      interactive: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-interactive') === 'true',
        renderHTML: (attrs) => (attrs.interactive ? { 'data-interactive': 'true' } : {}),
      },
      /** Let the block's scripts load from and talk to the web (https only). */
      allowNetwork: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-allow-network') === 'true',
        renderHTML: (attrs) => (attrs.allowNetwork ? { 'data-allow-network': 'true' } : {}),
      },
      /**
       * The user ran (or wrote) this block's scripts. Never read from HTML (pasted content)
       * and cleared on import, so scripts from elsewhere wait for a click on Run.
       */
      trusted: {
        default: false,
        parseHTML: () => false,
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="html-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'html-block' })]
  },

  addNodeView() {
    const render = ReactNodeViewRenderer(withBlockBoundary(HtmlView))
    return (props) => {
      const view = render(props) as ReturnType<typeof render> & { ignoreMutation: (m: MutationRecord | { type: 'selection'; target: Node }) => boolean }
      // The rendered HTML is read-only text the user can select and copy. A text selection
      // made inside it must not be turned into the editor's own (whole-block) selection.
      // (TipTap's option for this is skipped for node views without editable content.)
      const original = view.ignoreMutation.bind(view)
      view.ignoreMutation = (m) => m.type === 'selection' || original(m)
      return view
    }
  },

  addCommands() {
    return {
      insertHtmlBlock:
        (source = '', opts = {}) =>
        ({ tr, dispatch, state }) => {
          // Inserted by the user: their own scripts may run.
          const attrs = opts.interactive ? { interactive: true, trusted: true } : {}
          if (dispatch) insertBlockAtCursor(tr, state, this.type.create({ source: String(source), ...attrs }))
          return true
        },
    }
  },
})
