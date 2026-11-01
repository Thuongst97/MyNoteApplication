import { withBlockBoundary } from '@/components/ui/ErrorBoundary'
import { mergeAttributes, Node, ReactNodeViewRenderer } from '@tiptap/react'
import { insertBlockAtCursor } from '../mermaid/MermaidNode'
import { DrawingView } from './DrawingView'
import { EMPTY_DRAWING } from './drawingModel'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    drawing: {
      /** Inserts a drawing block and opens the drawing editor. */
      insertDrawing: () => ReturnType
    }
  }
}

/** A whiteboard-style drawing (shapes, arrows, text, pen) edited with Excalidraw. */
export const DrawingNode = Node.create({
  name: 'drawing',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      data: {
        default: EMPTY_DRAWING,
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute('data-drawing') ?? '')
          } catch {
            return EMPTY_DRAWING
          }
        },
        renderHTML: (attrs) => ({ 'data-drawing': JSON.stringify(attrs.data) }),
      },
      align: {
        default: 'center',
        parseHTML: (el) => el.getAttribute('data-align') || 'center',
        renderHTML: (attrs) => ({ 'data-align': attrs.align }),
      },
      isNew: { default: false, rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="drawing"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'drawing' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(withBlockBoundary(DrawingView))
  },

  addCommands() {
    return {
      insertDrawing:
        () =>
        ({ tr, dispatch, state }) => {
          if (dispatch) insertBlockAtCursor(tr, state, this.type.create({ data: EMPTY_DRAWING, isNew: true }))
          return true
        },
    }
  },
})
