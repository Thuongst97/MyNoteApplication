import { mergeAttributes, Node, ReactNodeViewRenderer } from '@tiptap/react'
import { withBlockBoundary } from '@/components/ui/ErrorBoundary'
import { insertBlockAtCursor } from '../mermaid/MermaidNode'
import { EquationView } from './EquationView'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    equation: {
      /** Inserts a block equation (LaTeX). With no source it opens in edit mode. */
      insertEquation: (source?: string) => ReturnType
    }
  }
}

/** Block equation: LaTeX source shown as a typeset formula (KaTeX). */
export const EquationNode = Node.create({
  name: 'equation',
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
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="equation"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'equation' })]
  },

  addNodeView() {
    const render = ReactNodeViewRenderer(withBlockBoundary(EquationView))
    return (props) => {
      const view = render(props) as ReturnType<typeof render> & { ignoreMutation: (m: MutationRecord | { type: 'selection'; target: Node }) => boolean }
      // The rendered formula is read-only text the user can select and copy. A text selection
      // made inside it must not be turned into the editor's own (whole-block) selection.
      // (TipTap's option for this is skipped for node views without editable content.)
      const original = view.ignoreMutation.bind(view)
      view.ignoreMutation = (m) => m.type === 'selection' || original(m)
      return view
    }
  },

  addCommands() {
    return {
      insertEquation:
        (source = '') =>
        ({ tr, dispatch, state }) => {
          if (dispatch) insertBlockAtCursor(tr, state, this.type.create({ source: String(source) }))
          return true
        },
    }
  },
})
