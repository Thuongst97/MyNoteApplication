import { CodeBlock } from '@tiptap/extension-code-block'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { editorHighlighter } from './codeHighlight'
import { codeHighlightPlugin } from './highlightPlugin'
import { codeClickPlugin } from './codeClicks'
import { CodeBlockView } from './CodeBlockView'

/**
 * Code block with syntax highlighting. The language is auto-detected unless the
 * user picks one; Tab / Shift+Tab indent and outdent inside the block.
 * Mermaid code blocks ("Mermaid doc") also show the rendered diagram below the code.
 */
export const CodeBlockNode = CodeBlock.extend({
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
  addProseMirrorPlugins() {
    // The base code block's own plugins (paste from VS Code…), called directly: `this.parent`
    // would point back to this method when the node is extended again (tests, node views).
    const base = CodeBlock.config.addProseMirrorPlugins?.call(this) ?? []
    return [...base, codeHighlightPlugin({ name: this.name, highlighter: editorHighlighter }), codeClickPlugin()]
  },
}).configure({
  enableTabIndentation: true,
  tabSize: 4,
  HTMLAttributes: { spellcheck: 'false' },
})
