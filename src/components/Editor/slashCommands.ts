import type { Editor, Range } from '@tiptap/react'
import { pickAndInsertImages } from '@/lib/images'
import {
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  BarChart3,
  Workflow,
  ImageIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Type,
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
    title: 'Chart',
    description: 'Column, bar, line, area or parts-of-a-whole chart.',
    icon: BarChart3,
    keywords: ['chart', 'graph', 'bar', 'line', 'area', 'pie', 'data', 'plot'],
    run: (e, r) => e.chain().focus().deleteRange(r).insertChart().run(),
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
