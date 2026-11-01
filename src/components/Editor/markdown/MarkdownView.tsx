import type { NodeViewProps } from '@tiptap/react'
import { FileText } from 'lucide-react'
import { markdownToHtml } from '@/lib/markdown'
import { MarkdownRender } from './MarkdownRender'
import { SourceBlockView, type SourceKind } from './SourceBlockView'

export const MARKDOWN_TEMPLATE = `## Title

Some **bold**, *italic* and \`code\` text with a [link](https://example.com).

- [ ] A task
- [x] A finished task

| Column | Value |
| --- | --- |
| A | 1 |
`

export const MARKDOWN_KIND: SourceKind = {
  name: 'Markdown',
  icon: FileText,
  hint: 'Markdown — paste or type, the preview updates as you go',
  help: { url: 'https://www.markdownguide.org/cheat-sheet/', label: 'Syntax help' },
  template: MARKDOWN_TEMPLATE,
  Render: MarkdownRender,
  toBlocksHtml: markdownToHtml,
}

/** Markdown block: rendered document; Edit to change the source. */
export function MarkdownView(props: NodeViewProps) {
  return <SourceBlockView {...props} kind={MARKDOWN_KIND} />
}
