import type { Editor, Range } from '@tiptap/react'
import { INTERACTIVE_TEMPLATE } from './html/HtmlView'
import { pickAndInsertImages } from '@/lib/images'
import { useAppStore } from '@/stores/useAppStore'
import { autoSaver } from '@/lib/autoSave'
import { newId } from '@/lib/utils'
import { newMindMap } from './mindmap/mindmapModel'
import { MERMAID_TEMPLATE } from './mermaid/renderMermaid'
import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  ListCollapse,
  Sigma,
  Network,
  LayoutGrid,
  ListTree,
  FilePlus,
  Link2,
  Shapes,
  BarChart3,
  Workflow,
  FileCode,
  FileText,
  CodeXml,
  Columns2,
  Columns3,
  Columns4,
  MessageSquareQuote,
  Table2,
  ImageIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Type,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export interface SlashCommandItem {
  title: string
  description: string
  icon: LucideIcon
  /** Extra search terms. */
  keywords: string[]
  run: (editor: Editor, range: Range) => void
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    title: 'Page',
    description: 'Create a sub-page inside this page.',
    icon: FilePlus,
    keywords: ['subpage', 'sub-page', 'child', 'new page', 'doc', 'document'],
    run: (e, r) => {
      const store = useAppStore.getState()
      const parent = store.activePageId
      const id = newId()
      e.chain().focus().deleteRange(r).insertPageLink(id).run()
      // Save this page (with the link) first, then open the new sub-page.
      if (parent) void autoSaver.flush(parent)
      void store.createPage(parent, { id })
    },
  },
  {
    title: 'Link to page',
    description: 'Link to another page (or type [[ anywhere).',
    icon: Link2,
    keywords: ['link', 'mention', 'reference', 'page', '[[', '@'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertContent('[[').run(),
  },
  {
    title: 'Text',
    description: 'Just start writing with plain text.',
    icon: Type,
    keywords: ['paragraph', 'plain', 'p'],
    run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run(),
  },
  {
    title: 'Heading 1',
    description: 'Big section heading.',
    icon: Heading1,
    keywords: ['h1', 'title', 'big'],
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading.',
    icon: Heading2,
    keywords: ['h2', 'subtitle', 'medium'],
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading.',
    icon: Heading3,
    keywords: ['h3', 'small'],
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 3 }).run(),
  },
  {
    title: 'Heading 4',
    description: 'Smallest section heading.',
    icon: Heading4,
    keywords: ['h4', 'smallest'],
    run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 4 }).run(),
  },
  {
    title: 'To-do list',
    description: 'Track tasks with a checklist.',
    icon: CheckSquare,
    keywords: ['todo', 'task', 'checkbox', 'check', 'checklist'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run(),
  },
  {
    title: 'Bulleted list',
    description: 'Create a simple bulleted list.',
    icon: List,
    keywords: ['ul', 'unordered', 'bullet', 'list'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
  },
  {
    title: 'Numbered list',
    description: 'Create a list with numbering.',
    icon: ListOrdered,
    keywords: ['ol', 'ordered', 'number', 'list'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
  },
  {
    title: 'Quote',
    description: 'Capture a quote.',
    icon: Quote,
    keywords: ['blockquote', 'citation'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
  },
  {
    title: 'Toggle list',
    description: 'Hide and show content inside.',
    icon: ListCollapse,
    keywords: ['toggle', 'collapse', 'expand', 'details', 'fold', 'accordion', 'dropdown'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertToggle(0).run(),
  },
  {
    title: 'Toggle heading 1',
    description: 'A heading that hides and shows the content below it.',
    icon: Heading1,
    keywords: ['toggle', 'heading', 'h1', 'collapse', 'section', 'fold'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertToggle(1).run(),
  },
  {
    title: 'Toggle heading 2',
    description: 'A heading that hides and shows the content below it.',
    icon: Heading2,
    keywords: ['toggle', 'heading', 'h2', 'collapse', 'section', 'fold'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertToggle(2).run(),
  },
  {
    title: 'Toggle heading 3',
    description: 'A heading that hides and shows the content below it.',
    icon: Heading3,
    keywords: ['toggle', 'heading', 'h3', 'collapse', 'section', 'fold'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertToggle(3).run(),
  },
  {
    title: 'Toggle heading 4',
    description: 'A heading that hides and shows the content below it.',
    icon: Heading4,
    keywords: ['toggle', 'heading', 'h4', 'collapse', 'section', 'fold'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertToggle(4).run(),
  },
  {
    title: 'Block equation',
    description: 'Display a math formula (LaTeX).',
    icon: Sigma,
    keywords: ['equation', 'math', 'latex', 'katex', 'formula', 'tex'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertEquation().run(),
  },
  {
    title: 'Code',
    description: 'Capture a code snippet.',
    icon: Code2,
    keywords: ['codeblock', 'snippet', 'pre', 'code block'],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run(),
  },
  {
    title: 'Image',
    description: 'Upload an image from your computer.',
    icon: ImageIcon,
    keywords: ['picture', 'photo', 'img', 'upload', 'screenshot'],
    run: (e, r) => {
      e.chain().focus().deleteRange(r).run()
      pickAndInsertImages(e)
    },
  },
  {
    title: 'Mermaid diagram',
    description: 'Flowcharts, sequence diagrams and more from code.',
    icon: Workflow,
    keywords: ['mermaid', 'diagram', 'chart', 'flowchart', 'graph', 'sequence', 'uml'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertMermaid().run(),
  },
  {
    title: 'PlantUML',
    description: 'UML diagram from PlantUML text (sequence, class, activity…).',
    icon: Network,
    keywords: ['puml', 'plantuml', 'uml', 'diagram', 'sequence', 'class', 'activity', 'state', 'component', 'gantt'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertPlantUml().run(),
  },
  {
    title: 'Mermaid doc',
    description: 'Mermaid code with highlighting and a live diagram below.',
    icon: FileCode,
    keywords: ['mermaid', 'doc', 'source', 'code', 'diagram', 'markdown'],
    run: (e, r) =>
      e
        .chain()
        .focus()
        .deleteRange(r)
        .insertContent({ type: 'codeBlock', attrs: { language: 'mermaid' }, content: [{ type: 'text', text: MERMAID_TEMPLATE }] })
        .run(),
  },
  {
    title: 'Markdown',
    description: 'Paste or write Markdown and see it rendered.',
    icon: FileText,
    keywords: ['md', 'markdown', 'readme', 'doc', 'import', 'gfm'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertMarkdown().run(),
  },
  {
    title: 'Callout',
    description: 'A colored box with an icon, for tips and highlights.',
    icon: MessageSquareQuote,
    keywords: ['callout', 'box', 'note', 'tip', 'info', 'warning', 'highlight', 'color', 'container', 'panel'],
    run: (e, r) => e.chain().focus().deleteRange(r).setCallout().run(),
  },
  {
    title: '2 columns',
    description: 'Put blocks side by side.',
    icon: Columns2,
    keywords: ['columns', 'column', 'layout', 'side', 'grid', 'two', '2'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertColumns(2).run(),
  },
  {
    title: '3 columns',
    description: 'Three blocks side by side.',
    icon: Columns3,
    keywords: ['columns', 'column', 'layout', 'grid', 'three', '3'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertColumns(3).run(),
  },
  {
    title: '4 columns',
    description: 'Four blocks side by side.',
    icon: Columns4,
    keywords: ['columns', 'column', 'layout', 'grid', 'four', '4'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertColumns(4).run(),
  },
  {
    title: '5 columns',
    description: 'Five blocks side by side.',
    icon: LayoutGrid,
    keywords: ['columns', 'column', 'layout', 'grid', 'five', '5'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertColumns(5).run(),
  },
  {
    title: 'HTML',
    description: 'Write HTML & CSS and see it rendered (styles stay in the block).',
    icon: CodeXml,
    keywords: ['html', 'css', 'web', 'embed', 'custom', 'code', 'layout'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertHtmlBlock().run(),
  },
  {
    title: 'Interactive HTML',
    description: 'HTML with JavaScript: buttons, calculators, games, live demos (runs sandboxed).',
    icon: Zap,
    keywords: ['javascript', 'js', 'script', 'interactive', 'html', 'button', 'widget', 'demo', 'app', 'canvas'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertHtmlBlock(INTERACTIVE_TEMPLATE, { interactive: true }).run(),
  },
  {
    title: 'Table',
    description: 'A simple table with a header row.',
    icon: Table2,
    keywords: ['table', 'grid', 'rows', 'columns', 'spreadsheet'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: 'Chart',
    description: 'Column, bar, line, area or parts-of-a-whole chart.',
    icon: BarChart3,
    keywords: ['chart', 'graph', 'bar', 'line', 'area', 'pie', 'data', 'plot'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertChart().run(),
  },
  {
    title: 'Drawing',
    description: 'Shapes, arrows, text boxes and freehand — like a slide.',
    icon: Shapes,
    keywords: ['draw', 'drawing', 'sketch', 'whiteboard', 'shapes', 'canvas', 'powerpoint', 'slide', 'diagram'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertDrawing().run(),
  },
  {
    title: 'Mind map',
    description: 'Brainstorm and document ideas as a map of topics.',
    icon: ListTree,
    keywords: ['mindmap', 'mind', 'map', 'brainstorm', 'ideas', 'tree', 'xmind'],
    run: (e, r) => {
      const { pages, activePageId } = useAppStore.getState()
      const title = pages.find((p) => p.id === activePageId)?.title.trim()
      e.chain().focus().deleteRange(r).insertMindMap(newMindMap(title || 'Central topic')).run()
    },
  },
  {
    title: 'Divider',
    description: 'Visually divide blocks.',
    icon: Minus,
    keywords: ['hr', 'separator', 'line', 'rule'],
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
  },
]

export function filterSlashCommands(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return SLASH_COMMANDS
  // Rank: title starts with the query > a title word starts with it > title contains it > keyword match.
  const score = (c: SlashCommandItem) => {
    const t = c.title.toLowerCase()
    if (t.startsWith(q)) return 0
    if (t.split(/\s+/).some((w) => w.startsWith(q))) return 1
    if (t.includes(q)) return 2
    if (c.keywords.some((k) => k.startsWith(q))) return 3
    if (c.keywords.some((k) => k.includes(q))) return 4
    return -1
  }
  return SLASH_COMMANDS.map((c, i) => ({ c, i, s: score(c) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.c)
}
