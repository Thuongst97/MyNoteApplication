import type { JSONContent } from '@tiptap/react'

/**
 * A page (TipTap JSON) as Markdown, for "Copy page as Markdown". Blocks Markdown can't express
 * keep their source (diagrams as ```mermaid / ```plantuml fences, equations as $$…$$) or a
 * short placeholder (drawings, charts).
 */

type Mark = { type: string; attrs?: Record<string, unknown> }

const escapeText = (t: string) => t.replace(/([\\`*_[\]<>])/g, '\\$1')

function inline(nodes: JSONContent[] | undefined): string {
  let out = ''
  for (const n of nodes ?? []) {
    if (n.type === 'text') {
      const marks = (n.marks ?? []) as Mark[]
      const code = marks.some((m) => m.type === 'code')
      let t = code ? `\`${n.text ?? ''}\`` : escapeText(n.text ?? '')
      if (!code && t.trim()) {
        if (marks.some((m) => m.type === 'bold')) t = `**${t}**`
        if (marks.some((m) => m.type === 'italic')) t = `*${t}*`
        if (marks.some((m) => m.type === 'strike')) t = `~~${t}~~`
      }
      const link = marks.find((m) => m.type === 'link')
      const href = String(link?.attrs?.href ?? '')
      if (link && /^(https?:|mailto:)/i.test(href)) t = `[${t}](${href})`
      out += t
    } else if (n.type === 'hardBreak') out += '  \n'
    else if (n.type === 'mention' || n.type === 'pageLink') out += escapeText(String(n.attrs?.label ?? n.attrs?.title ?? ''))
    else if (n.type === 'inlineMath' || n.type === 'mathInline') out += `$${String(n.attrs?.latex ?? n.attrs?.source ?? '')}$`
    else if (n.content) out += inline(n.content)
  }
  return out
}

const fence = (lang: string, code: string) => {
  const ticks = code.includes('```') ? '````' : '```'
  return `${ticks}${lang}\n${code.replace(/\n$/, '')}\n${ticks}`
}

const indent = (text: string, pad: string) =>
  text
    .split('\n')
    .map((l, i) => (i === 0 || !l ? l : pad + l))
    .join('\n')

function table(node: JSONContent): string {
  const rows = (node.content ?? []).map((row) => (row.content ?? []).map((cell) => blocks(cell.content).replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim()))
  if (!rows.length) return ''
  const cols = Math.max(...rows.map((r) => r.length))
  const line = (r: string[]) => `| ${Array.from({ length: cols }, (_, i) => r[i] ?? '').join(' | ')} |`
  return [line(rows[0]), `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`, ...rows.slice(1).map(line)].join('\n')
}

function block(n: JSONContent): string {
  const a = n.attrs ?? {}
  switch (n.type) {
    case 'paragraph':
      return inline(n.content)
    case 'heading':
      return `${'#'.repeat(Math.min(6, Number(a.level) || 1))} ${inline(n.content)}`
    case 'blockquote':
      return blocks(n.content)
        .split('\n')
        .map((l) => (l ? `> ${l}` : '>'))
        .join('\n')
    case 'callout':
      return blocks(n.content)
        .split('\n')
        .map((l, i) => `> ${i === 0 && a.icon ? `${String(a.icon)} ` : ''}${l}`)
        .join('\n')
    case 'bulletList':
      return (n.content ?? []).map((li) => `- ${indent(blocks(li.content, '\n'), '  ')}`).join('\n')
    case 'orderedList': {
      const start = Number(a.start) || 1
      return (n.content ?? []).map((li, i) => `${start + i}. ${indent(blocks(li.content, '\n'), '   ')}`).join('\n')
    }
    case 'taskList':
      return (n.content ?? []).map((li) => `- [${li.attrs?.checked ? 'x' : ' '}] ${indent(blocks(li.content, '\n'), '  ')}`).join('\n')
    case 'codeBlock':
      return fence(String(a.language ?? ''), (n.content ?? []).map((t) => t.text ?? '').join(''))
    case 'horizontalRule':
      return '---'
    case 'image': {
      // Images stored in the app have no address other programs can open.
      const src = String(a.src ?? '')
      return /^(https?:|data:)/i.test(src) ? `![${String(a.alt ?? '')}](${src})` : `*[Image${a.alt ? `: ${String(a.alt)}` : ''}]*`
    }
    case 'table':
      return table(n)
    case 'mermaid':
      return fence('mermaid', String(a.code ?? ''))
    case 'plantuml':
      return fence('plantuml', String(a.source ?? ''))
    case 'markdown':
      return String(a.source ?? '').trim()
    case 'htmlBlock':
      return String(a.source ?? '').trim()
    case 'equation':
      return `$$\n${String(a.source ?? a.latex ?? '').trim()}\n$$`
    case 'toggle':
    case 'details':
      return blocks(n.content)
    case 'detailsSummary':
      return `**${inline(n.content)}**`
    case 'chart':
      return `*[Chart: ${String((a.spec as { title?: string } | undefined)?.title ?? 'chart')}]*`
    case 'drawing':
      return '*[Drawing]*'
    case 'mindmap':
      return '*[Mind map]*'
    default:
      return n.content ? blocks(n.content) : ''
  }
}

function blocks(nodes: JSONContent[] | undefined, sep = '\n\n'): string {
  return (nodes ?? [])
    .map(block)
    .filter((s) => s !== '')
    .join(sep)
}

export function docToMarkdown(doc: JSONContent | null | undefined, title?: string): string {
  const body = blocks(doc?.content).replace(/\n{3,}/g, '\n\n').trim()
  return (title?.trim() ? `# ${title.trim()}\n\n` : '') + body + '\n'
}
