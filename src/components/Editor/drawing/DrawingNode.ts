import { mergeAttributes, Node, ReactNodeViewRenderer } from '@tiptap/react'
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
    return ReactNodeViewRenderer(DrawingView)
  },

  addCommands() {
    return {
      insertDrawing:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { data: EMPTY_DRAWING, isNew: true } }),
    }
  },
})
