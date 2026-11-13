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
  // (XMLSerializer below writes the SVG namespace itself.)
  // Its natural size (in the page it may be scaled down to fit: max-width, width="100%").
  clone.style.removeProperty('max-width')
  clone.style.removeProperty('width')
  clone.style.removeProperty('height')
  if (!clone.getAttribute('style')?.trim()) clone.removeAttribute('style')
  // Natural size: the viewBox, else numeric width/height, else the size it's shown at.
  const vb = svg.viewBox?.baseVal
  const attr = (n: string) => (/^[\d.]+(px)?$/.test(svg.getAttribute(n) ?? '') ? parseFloat(svg.getAttribute(n)!) : 0)
  const box = svg.getBoundingClientRect()
  const w = vb?.width || attr('width') || box.width
  const h = vb?.height || attr('height') || box.height
  if (w && h) {
    clone.setAttribute('width', String(Math.round(w)))
    clone.setAttribute('height', String(Math.round(h)))
  }
  // XML, not HTML: labels hold HTML such as <br>, which must be <br/> in an SVG file or image.
  return new XMLSerializer().serializeToString(clone)
}

/** Largest picture made from a diagram (pixels per side, and in all). */
const MAX_SIDE = 16000
const MAX_AREA = 120_000_000

/**
 * Draws a diagram's SVG (see diagramSvg) into a PNG at `scale` (sharp on high-DPI screens and
 * in documents), on `background`. Done on a canvas in the page: no window or screen size limit.
 */
export async function svgToPng(svg: string, background: string, scale = 2): Promise<Uint8Array> {
  const w = Number(/<svg\b[^>]*\swidth="([\d.]+)"/i.exec(svg)?.[1]) || 800
  const h = Number(/<svg\b[^>]*\sheight="([\d.]+)"/i.exec(svg)?.[1]) || 600
  const s = Math.max(0.1, Math.min(scale, MAX_SIDE / Math.max(w, h), Math.sqrt(MAX_AREA / (w * h))))
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * s))
  canvas.height = Math.max(1, Math.round(h * s))
  const g = canvas.getContext('2d')
  if (!g) throw new Error('Could not draw the diagram')
  g.fillStyle = background
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('Could not draw the diagram')
  return new Uint8Array(await blob.arrayBuffer())
}

const toDataUrl = (png: Uint8Array) => {
  let bin = ''
  for (let i = 0; i < png.length; i += 0x8000) bin += String.fromCharCode(...png.subarray(i, i + 0x8000))
  return `data:image/png;base64,${btoa(bin)}`
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
      if (svg) src = await svgToPng(svg, '#ffffff').then(toDataUrl, () => '')
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
