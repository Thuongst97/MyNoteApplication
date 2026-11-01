import { withBlockBoundary } from '@/components/ui/ErrorBoundary'
import { mergeAttributes, Node, ReactNodeViewRenderer } from '@tiptap/react'
import { insertBlockAtCursor } from '../mermaid/MermaidNode'
import { ChartView } from './ChartView'
import { DEFAULT_CHART } from './chartModel'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    chart: {
      /** Inserts a chart block (opens its data editor). */
      insertChart: () => ReturnType
    }
  }
}

/** A chart block; its data lives in the `spec` attribute. */
export const ChartNode = Node.create({
  name: 'chart',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      spec: {
        default: DEFAULT_CHART,
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute('data-spec') ?? '')
          } catch {
            return DEFAULT_CHART
          }
        },
        renderHTML: (attrs) => ({ 'data-spec': JSON.stringify(attrs.spec) }),
      },
      align: {
        default: 'center',
        parseHTML: (el) => el.getAttribute('data-align') || 'center',
        renderHTML: (attrs) => ({ 'data-align': attrs.align }),
      },
      /** Opens the data editor right after insertion (not persisted meaningfully). */
      isNew: { default: false, rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="chart"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'chart' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(withBlockBoundary(ChartView))
  },

  addCommands() {
    return {
      insertChart:
        () =>
        ({ tr, dispatch, state }) => {
          if (dispatch) insertBlockAtCursor(tr, state, this.type.create({ spec: DEFAULT_CHART, isNew: true }))
          return true
        },
    }
  },
})
