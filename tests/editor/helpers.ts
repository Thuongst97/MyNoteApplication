import { Editor, type AnyExtension, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Image from '@tiptap/extension-image'
import { BackgroundColor, Color, FontSize, TextStyle } from '@tiptap/extension-text-style'
import { MermaidNode } from '@/components/Editor/mermaid/MermaidNode'
import { ChartNode } from '@/components/Editor/chart/ChartNode'
import { DrawingNode } from '@/components/Editor/drawing/DrawingNode'
import { MindMapNode } from '@/components/Editor/mindmap/MindMapNode'
import { PageLinkNode } from '@/components/Editor/links/PageLinkNode'
import { MentionNode } from '@/components/Editor/links/MentionNode'
import { BlockIds } from '@/components/Editor/links/BlockIds'
import { BlockFlash } from '@/components/Editor/links/BlockFlash'
import { ImageSelection } from '@/components/Editor/ImageSelection'
import { MoveBlockShortcuts } from '@/components/Editor/blockMove'
import { CodeBlockNode } from '@/components/Editor/code/CodeBlockNode'
import { MarkdownNode } from '@/components/Editor/markdown/MarkdownNode'
import { TableKit } from '@tiptap/extension-table'
import { HtmlNode } from '@/components/Editor/html/HtmlNode'
import { CalloutNode } from '@/components/Editor/blocks/CalloutNode'
import { ColumnNode, ColumnsNode } from '@/components/Editor/blocks/ColumnsNode'
import { DetailsContent, DetailsSummary, ToggleNode } from '@/components/Editor/blocks/ToggleNode'
import { EquationNode } from '@/components/Editor/equation/EquationNode'

/** Same nodes as the app, without React node views (plain DOM rendering). */
const noView = <T extends AnyExtension>(ext: T) => (ext as unknown as { extend: (c: object) => T }).extend({ addNodeView: () => null })

export function makeEditor(content: JSONContent | string = '') {
  const element = document.createElement('div')
  document.body.appendChild(element)
  return new Editor({
    element,
    content,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] }, codeBlock: false }),
      noView(CodeBlockNode),
      noView(MarkdownNode),
      noView(HtmlNode),
      noView(CalloutNode),
      ColumnsNode,
      ColumnNode,
      ToggleNode,
      DetailsSummary,
      DetailsContent,
      noView(EquationNode),
      TableKit.configure({ table: { resizable: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            align: { default: 'left', parseHTML: (el) => el.getAttribute('data-align') || 'left', renderHTML: (a) => ({ 'data-align': a.align }) },
          }
        },
      }),
      TextStyle,
      Color,
      BackgroundColor,
      FontSize,
      noView(MermaidNode),
      noView(ChartNode),
      noView(DrawingNode),
      noView(MindMapNode),
      noView(PageLinkNode),
      noView(MentionNode),
      BlockIds,
      BlockFlash,
      ImageSelection,
      MoveBlockShortcuts,
    ],
  })
}

export const p = (text = '', attrs?: Record<string, unknown>): JSONContent => ({ type: 'paragraph', ...(attrs && { attrs }), ...(text && { content: [{ type: 'text', text }] }) })
export const ul = (...items: string[]): JSONContent => ({ type: 'bulletList', content: items.map((t) => ({ type: 'listItem', content: [p(t)] })) })
export const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })

/** Compact outline of the document: "p:Text", "ul[a|b]", "image", … */
export function outline(editor: Editor): string[] {
  return ((editor.getJSON().content ?? []) as JSONContent[]).map((n: JSONContent) => {
    if (n.type === 'paragraph') return `p:${n.content?.map((c: JSONContent) => c.text ?? c.type).join('') ?? ''}`
    if (n.type === 'bulletList') return `ul[${n.content!.map((li: JSONContent) => li.content?.[0]?.content?.[0]?.text).join('|')}]`
    if (n.type === 'heading') return `h${n.attrs!.level}:${n.content?.[0]?.text ?? ''}`
    return n.type!
  })
}

/** Position of the first node matching the predicate. */
export function posOf(editor: Editor, match: (n: import('@tiptap/pm/model').Node) => boolean): number {
  let found = -1
  editor.state.doc.descendants((n, pos) => {
    if (found >= 0) return false
    if (match(n)) found = pos
    return true
  })
  return found
}
