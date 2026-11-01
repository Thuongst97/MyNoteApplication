import type { AnyExtension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Image from '@tiptap/extension-image'
import { BackgroundColor, Color, FontSize, TextStyle } from '@tiptap/extension-text-style'
import { SlashCommand } from './SlashCommand'
import { CodeBlockNode } from './code/CodeBlockNode'
import { MarkdownNode } from './markdown/MarkdownNode'
import { HtmlNode } from './html/HtmlNode'
import { CalloutNode } from './blocks/CalloutNode'
import { ColumnNode, ColumnsNode } from './blocks/ColumnsNode'
import { DetailsContent, DetailsSummary, ToggleNode } from './blocks/ToggleNode'
import { EquationNode } from './equation/EquationNode'
import { PlantUmlNode } from './plantuml/PlantUmlNode'
import { TableKit } from '@tiptap/extension-table'
import { ImageSelection } from './ImageSelection'
import { ChartNode } from './chart/ChartNode'
import { DrawingNode } from './drawing/DrawingNode'
import { MindMapNode } from './mindmap/MindMapNode'
import { PageLinkNode } from './links/PageLinkNode'
import { MentionNode } from './links/MentionNode'
import { PageSuggestion } from './links/PageSuggestion'
import { BlockFlash } from './links/BlockFlash'
import { MermaidNode } from './mermaid/MermaidNode'
import { BlockIds } from './links/BlockIds'
import { MoveBlockShortcuts } from './blockMove'

/**
 * Every extension of the page editor. Shared by the editor and by code that needs the
 * same document schema without an editor (e.g. turning imported Markdown into a page).
 */
export function createEditorExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      // Replaced by the syntax-highlighted CodeBlockNode below.
      codeBlock: false,
      // Blue line showing where a dragged block will land.
      dropcursor: { color: '#2383e2', width: 3 },
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    Placeholder.configure({
      // Also inside callouts, columns and toggles (only the line with the cursor shows it).
      includeChildren: true,
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') return `Heading ${node.attrs.level}`
        if (node.type.name === 'codeBlock') return ''
        if (node.type.name === 'detailsSummary') return 'Toggle'
        return "Write something, or press '/' for commands…"
      },
    }),
    CodeBlockNode,
    TableKit.configure({ table: { resizable: false } }),
    MarkdownNode,
    HtmlNode,
    CalloutNode,
    ColumnsNode,
    ColumnNode,
    ToggleNode,
    DetailsSummary,
    DetailsContent,
    EquationNode,
    PlantUmlNode,
    TextStyle,
    Color,
    BackgroundColor,
    FontSize,
    TaskList,
    TaskItem.configure({ nested: true }),
    Image.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          align: {
            default: 'left',
            parseHTML: (el) => el.getAttribute('data-align') || 'left',
            renderHTML: (attrs) => ({ 'data-align': attrs.align }),
          },
        }
      },
    }).configure({
      inline: false,
      allowBase64: true,
      resize: {
        enabled: true,
        directions: ['left', 'right', 'bottom-left', 'bottom-right'],
        minWidth: 60,
        minHeight: 40,
        alwaysPreserveAspectRatio: true,
      },
    }),
    ImageSelection,
    MermaidNode,
    ChartNode,
    DrawingNode,
    MindMapNode,
    BlockIds,
    PageLinkNode,
    MentionNode,
    PageSuggestion,
    BlockFlash,
    MoveBlockShortcuts,
    SlashCommand,
  ]
}
