import type { NodeViewProps } from '@tiptap/react'
import { CodeXml } from 'lucide-react'
import { SourceBlockView, type SourceKind } from '../markdown/SourceBlockView'
import { HtmlRender } from './HtmlRender'
import { sanitizeHtml } from '@/lib/html'

export const HTML_TEMPLATE = `<style>
  .card { padding: 16px 20px; border-radius: 12px; background: #f4ece6; }
  .card h2 { margin: 0 0 6px; }
</style>
<div class="card">
  <h2>Hello!</h2>
  <p>Write <b>HTML</b> and <i>CSS</i> here. Styles only apply inside this block.</p>
</div>
`

export const HTML_KIND: SourceKind = {
  name: 'HTML',
  icon: CodeXml,
  hint: 'HTML & CSS — scripts are removed; styles stay inside this block',
  help: { url: 'https://developer.mozilla.org/en-US/docs/Web/HTML', label: 'HTML reference' },
  template: HTML_TEMPLATE,
  Render: HtmlRender,
  // Styles can't carry over into normal blocks; drop them.
  toBlocksHtml: (source) => sanitizeHtml(source).replace(/<style[\s\S]*?<\/style>/gi, ''),
}

/** HTML block: sanitized HTML rendered in its own style scope; Edit to change the source. */
export function HtmlView(props: NodeViewProps) {
  return <SourceBlockView {...props} kind={HTML_KIND} />
}
