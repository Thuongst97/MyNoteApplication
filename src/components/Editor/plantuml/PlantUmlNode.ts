import { mergeAttributes, Node, ReactNodeViewRenderer } from '@tiptap/react'
import { withBlockBoundary } from '@/components/ui/ErrorBoundary'
import { borderAttribute } from '../blockBorder'
import { insertBlockAtCursor } from '../mermaid/MermaidNode'
import { PlantUmlView } from './PlantUmlView'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    plantuml: {
      /** Inserts a PlantUML diagram. With no source it opens in edit mode. */
      insertPlantUml: (source?: string) => ReturnType
    }
  }
}

/** PlantUML diagram: source + the diagram drawn by a PlantUML server. */
export const PlantUmlNode = Node.create({
  name: 'plantuml',
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
      border: borderAttribute,
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="plantuml"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'plantuml' })]
  },

  addNodeView() {
    const render = ReactNodeViewRenderer(withBlockBoundary(PlantUmlView))
    return (props) => {
      const view = render(props) as ReturnType<typeof render> & { ignoreMutation: (m: MutationRecord | { type: 'selection'; target: Node }) => boolean }
      // The rendered diagram is read-only text the user can select and copy. A text selection
      // made inside it must not be turned into the editor's own (whole-block) selection.
      // (TipTap's option for this is skipped for node views without editable content.)
      const original = view.ignoreMutation.bind(view)
      view.ignoreMutation = (m) => m.type === 'selection' || original(m)
      return view
    }
  },

  addCommands() {
    return {
      insertPlantUml:
        (source = '') =>
        ({ tr, dispatch, state }) => {
          if (dispatch) insertBlockAtCursor(tr, state, this.type.create({ source: String(source) }))
          return true
        },
    }
  },
})
