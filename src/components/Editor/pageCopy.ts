import type { Editor } from '@tiptap/react'
import { api } from '@/lib/api'
import { markdownToHtml } from '@/lib/markdown'
import { docToMarkdown } from '@/lib/toMarkdown'

export type CopyFormat = 'rich' | 'markdown' | 'text'

/** Background used behind a diagram picture (diagrams follow the page's light/dark look). */
export const diagramBackground = (el: Element | null) => (el?.closest('.dark') || document.documentElement.classList.contains('dark') ? '#191919' : '#ffffff')

/** A rendered diagram's SVG (with the namespace other programs need). */
export function diagramSvg(root: Element | null | undefined): string | null {
  const svg = root?.querySelector('svg')
  if (!svg) return null
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const box = svg.getBoundingClientRect()
  const vb = svg.viewBox?.baseVal
  const w = vb?.width || box.width
  const h = vb?.height || box.height
  if (w && h) {
    clone.setAttribute('width', String(Math.round(w)))
    clone.setAttribute('height', String(Math.round(h)))
  }
  return clone.outerHTML
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * The page as HTML other apps understand: diagrams become pictures, Markdown blocks become
 * their rendered HTML. (Stored images are embedded by the main process when writing.)
 */
export async function pageHtml(editor: Editor, title: string): Promise<string> {
  const doc = new DOMParser().parseFromString(`<body>${editor.getHTML()}</body>`, 'text/html')
  // Rendered diagrams, in document order, from the live editor.
  const live: Record<string, Element[]> = { mermaid: [], plantuml: [] }
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name in live) {
      const dom = editor.view.nodeDOM(pos) as Element | null
      if (dom) live[node.type.name].push(dom)
    }
    return true
  })
  for (const type of Object.keys(live)) {
    const els = [...doc.body.querySelectorAll(`[data-type="${type}"]`)]
    for (const [i, el] of els.entries()) {
      const svg = diagramSvg(live[type][i])
      let src = ''
      if (svg) src = await api.diagrams.toPngDataUrl(svg, '#ffffff').catch(() => '')
      const img = doc.createElement('img')
      if (src) {
        img.setAttribute('src', src)
        img.setAttribute('alt', `${type} diagram`)
        el.replaceWith(img)
      } else el.remove()
    }
  }
  for (const el of doc.body.querySelectorAll('[data-type="markdown"]')) {
    const box = doc.createElement('div')
    box.innerHTML = markdownToHtml(el.getAttribute('data-source') ?? '')
    el.replaceWith(box)
  }
  return `${title.trim() ? `<h1>${escapeHtml(title.trim())}</h1>` : ''}${doc.body.innerHTML}`
}

export function pageText(editor: Editor, title: string): string {
  const body = editor.getText({ blockSeparator: '\n\n' }).replace(/\n{3,}/g, '\n\n').trim()
  return (title.trim() ? `${title.trim()}\n\n` : '') + body + '\n'
}

/** Copies the whole page. */
export async function copyPage(editor: Editor, title: string, format: CopyFormat) {
  if (format === 'markdown') return api.clipboard.writeRich('', docToMarkdown(editor.getJSON(), title))
  const text = pageText(editor, title)
  if (format === 'text') return api.clipboard.writeRich('', text)
  return api.clipboard.writeRich(await pageHtml(editor, title), text)
}
