import { mergeAttributes, Node, ReactNodeViewRenderer } from '@tiptap/react'
import { withBlockBoundary } from '@/components/ui/ErrorBoundary'
import { CalloutView } from './CalloutView'
import { normalizeBlockColor } from './blockColors'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /** Wraps the selected blocks (or the current empty line) in a callout. */
      setCallout: (attrs?: { icon?: string | null; color?: string }) => ReturnType
    }
  }
}

/**
 * Notion-like callout: a colored box with an optional icon that holds any blocks
 * (text, headings, lists, columns, boards…).
 */
export const CalloutNode = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      icon: {
        default: '💡',
        // '' = no icon. Written as 'none' (empty attributes aren't written), and parsed back
        // to '' (returning null here would bring back the default icon).
        parseHTML: (el) => {
          const v = el.getAttribute('data-icon')
          return v === null ? '💡' : v === 'none' ? '' : v
        },
        renderHTML: (attrs) => ({ 'data-icon': attrs.icon || 'none' }),
      },
      color: {
        default: 'default',
        parseHTML: (el) => normalizeBlockColor(el.getAttribute('data-color')),
        renderHTML: (attrs) => ({ 'data-color': attrs.color }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(withBlockBoundary(CalloutView))
  },

  addCommands() {
    return {
      setCallout:
        (attrs = {}) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { icon: attrs.icon === undefined ? '💡' : attrs.icon || '', color: normalizeBlockColor(attrs.color) }),
    }
  },
})
