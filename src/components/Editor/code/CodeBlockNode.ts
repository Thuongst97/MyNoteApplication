import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { lowlight } from './codeHighlight'
import { CodeBlockView } from './CodeBlockView'

/**
 * Code block with syntax highlighting. The language is auto-detected unless the
 * user picks one; Tab / Shift+Tab indent and outdent inside the block.
 * Mermaid code blocks ("Mermaid doc") also show the rendered diagram below the code.
 */
export const CodeBlockNode = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      /** File name or title shown in the header (e.g. "src/api/IService.aidl"). */
      title: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-title') ?? '',
        renderHTML: (attrs) => (attrs.title ? { 'data-title': attrs.title } : {}),
      },
      /** Mermaid only: whether the rendered diagram is shown under the code. */
      preview: {
        default: true,
        parseHTML: (el) => el.getAttribute('data-preview') !== 'false',
        renderHTML: (attrs) => (attrs.preview === false ? { 'data-preview': 'false' } : {}),
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
}).configure({
  lowlight,
  enableTabIndentation: true,
  tabSize: 4,
  HTMLAttributes: { spellcheck: 'false' },
})
