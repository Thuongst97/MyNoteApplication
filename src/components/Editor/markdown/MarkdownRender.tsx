import { useEffect, useMemo, useRef } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { markdownToHtml } from '@/lib/markdown'
import { lowlight, detectLanguage } from '../code/codeHighlight'
import { renderMermaid } from '../mermaid/renderMermaid'

type HastNode = { type: string; value?: string; tagName?: string; properties?: { className?: string[] }; children?: HastNode[] }

/** Builds DOM nodes from lowlight's syntax tree (text nodes only, so nothing can inject markup). */
function hastToDom(node: HastNode, doc: Document): Node {
  if (node.type === 'text') return doc.createTextNode(node.value ?? '')
  const el = node.type === 'element' ? doc.createElement('span') : doc.createDocumentFragment()
  if (el instanceof HTMLElement && node.properties?.className) el.className = node.properties.className.join(' ')
  for (const c of node.children ?? []) el.appendChild(hastToDom(c, doc))
  return el
}

/** Rendered Markdown: sanitized HTML with highlighted code fences and Mermaid diagrams. */
export function MarkdownRender({ source, className }: { source: string; className?: string }) {
  const theme = useAppStore((s) => s.theme)
  const html = useMemo(() => markdownToHtml(source), [source])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    root.innerHTML = html
    let cancelled = false
    for (const code of root.querySelectorAll<HTMLElement>('pre > code')) {
      const lang = /language-([\w+#-]+)/.exec(code.className)?.[1]?.toLowerCase() ?? null
      const text = code.textContent ?? ''
      const pre = code.parentElement!
      if (lang === 'mermaid') {
        const box = document.createElement('div')
        box.className = 'md-mermaid mermaid-svg'
        box.textContent = 'Rendering diagram…'
        pre.replaceWith(box)
        void renderMermaid(text, theme).then((r) => {
          if (cancelled) return
          if (r.svg) box.innerHTML = r.svg // mermaid renders with securityLevel 'strict'
          else {
            box.textContent = ''
            const fallback = document.createElement('pre')
            fallback.textContent = text
            box.append(fallback)
          }
        })
        continue
      }
      const language = lang && lowlight.registered(lang) ? lang : detectLanguage(text)
      if (!language) continue
      code.textContent = ''
      code.classList.add('hljs')
      code.appendChild(hastToDom(lowlight.highlight(language, text.replace(/\n$/, '')) as unknown as HastNode, document))
    }
    return () => {
      cancelled = true
    }
  }, [html, theme])

  return (
    <div
      ref={ref}
      className={className}
      onClick={(e) => {
        // Links open in the system browser (Ctrl/⌘ not needed: the block isn't editable text).
        const a = (e.target as HTMLElement).closest('a')
        if (!a) return
        e.preventDefault()
        const href = a.getAttribute('href') ?? ''
        if (/^https?:|^mailto:/i.test(href)) window.open(href, '_blank')
      }}
    />
  )
}
