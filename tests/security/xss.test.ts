import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import type { Editor } from '@tiptap/react'
import { sanitizeSvg } from '@/lib/sanitize'
import { sanitizeHtml } from '@/lib/html'
import { markdownToHtml } from '@/lib/markdown'
import { cleanCover, cleanIcon } from '@/lib/pageMeta'
import { makeEditor } from '../editor/helpers'

/** Markup that must never survive: script, handlers, script URLs, frames, forms… */
const DANGER = /<script|\son[a-z]+\s*=|javascript:|vbscript:|<iframe|<object|<embed|<form|<base|<meta|<link|srcdoc|formaction|xlink:href="(?!#|data:image)|href="data:text/i

let editor: Editor | undefined
afterEach(() => editor?.destroy())

describe('SVG sanitizer (drawing previews, library thumbnails, PlantUML)', () => {
  const payloads = [
    '<svg><script>alert(1)</script></svg>',
    '<svg onload="alert(1)"><rect/></svg>',
    '<svg><a href="javascript:alert(1)"><text>x</text></a></svg>',
    '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>',
    '<svg><animate attributeName="href" values="javascript:alert(1)"/></svg>',
    '<svg><set attributeName="onmouseover" to="alert(1)"/></svg>',
    '<svg><foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject></svg>',
    '<svg><use href="https://evil.example/x.svg#a"/></svg>',
    '<svg><image href="https://evil.example/track.png"/></svg>',
    '<svg><style>@import url(https://evil.example/x.css); rect{fill:url(https://evil.example/t)}</style></svg>',
    '<svg><image href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="/></svg>',
  ]
  it.each(payloads)('neutralizes %s', (p) => {
    const out = sanitizeSvg(p)
    expect(out).not.toMatch(DANGER)
    expect(out).not.toMatch(/evil\.example/)
  })
})

describe('HTML block sanitizer', () => {
  const payloads = [
    '<img src=x onerror=alert(1)>',
    '<a href="javascript:alert(1)">x</a>',
    '<a href=" jAvAsCrIpT:alert(1)">x</a>',
    '<svg><script>alert(1)</script></svg>',
    '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
    '<form action="https://evil.example"><input name=p type=password></form>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '<meta http-equiv="refresh" content="0;url=https://evil.example">',
    '<base href="https://evil.example/">',
    '<link rel=stylesheet href="https://evil.example/x.css">',
    '<object data="x.swf"></object><embed src="x">',
    '<button formaction="javascript:alert(1)">x</button>',
    '<div style="background:url(javascript:alert(1))">x</div>',
  ]
  it.each(payloads)('neutralizes %s', (p) => {
    expect(sanitizeHtml(p)).not.toMatch(DANGER)
  })
})

describe('Markdown block sanitizer', () => {
  const payloads = [
    '[x](javascript:alert(1))',
    '[x](JaVaScRiPt:alert(1))',
    '![x](javascript:alert(1))',
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    '<details open ontoggle=alert(1)>',
    '<iframe src="https://evil.example"></iframe>',
  ]
  it.each(payloads)('neutralizes %s', (p) => {
    expect(markdownToHtml(p)).not.toMatch(DANGER)
  })
})

describe('page metadata from imported files', () => {
  it('covers cannot inject CSS or load scripts', () => {
    for (const bad of ['red; position:fixed; inset:0', 'url(javascript:alert(1))', 'expression(alert(1))', 'url("x") ; } body { display:none', '</style><script>alert(1)</script>']) {
      expect(cleanCover(bad)).toBeNull()
    }
  })
  it('icons are short text only', () => {
    expect(cleanIcon('<img src=x onerror=alert(1)>')).toBeNull()
  })
})

describe('imported page content (JSON) rendered by the editor', () => {
  it('drops script links and unsafe attributes', () => {
    editor = makeEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'click', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'data', marks: [{ type: 'link', attrs: { href: 'data:text/html,<script>alert(1)</script>' } }] }] },
        { type: 'image', attrs: { src: 'javascript:alert(1)' } },
        { type: 'htmlBlock', attrs: { source: '<img src=x onerror=alert(1)>' } },
      ],
    })
    const html = editor.getHTML()
    expect(html).not.toMatch(/href="(javascript|data):/i)
    expect(editor.view.dom.innerHTML).not.toMatch(/href="(javascript|data):/i)
  })
})

describe('Content Security Policy (blocks scripts even if markup slipped through)', () => {
  const html = fs.readFileSync('index.html', 'utf8')
  const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)![1]
  const directive = (name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' ')) ?? ''
  it('allows only the app’s own scripts (no inline scripts, no eval, no remote)', () => {
    expect(directive('script-src')).toBe("script-src 'self' 'wasm-unsafe-eval'")
  })
  it('forbids plugins, frames, <base> changes and form posts', () => {
    expect(directive('object-src')).toBe("object-src 'none'")
    // Frames: only the sandbox of interactive HTML blocks (see the sandbox tests).
    expect(directive('frame-src')).toBe('frame-src pn-sandbox:')
    expect(directive('base-uri')).toBe("base-uri 'none'")
    expect(directive('form-action')).toBe("form-action 'none'")
  })
})

describe('Mermaid diagram text is defanged before rendering', () => {
  it('removes handlers, dangerous tags and script URLs but keeps diagram syntax', async () => {
    const { defangMermaid } = await import('@/components/Editor/mermaid/renderMermaid')
    const attack = 'graph LR\n  A["<img src=x onerror=alert(1)>hi"] --> B["<b onmouseover=alert(2)>B</b>"]\n  click A "javascript:alert(3)"\n  C["<iframe srcdoc=x></iframe>"]'
    const out = defangMermaid(attack)
    expect(out).not.toMatch(/onerror|onmouseover|<img|<iframe|javascript:/i)
    expect(out).toContain('<b>B</b>')
    const normal = 'classDiagram\n  class Animal {\n    <<interface>>\n  }\n  Animal <|-- Duck\n  A --> B\n  X["line<br>break"]'
    expect(defangMermaid(normal)).toBe(normal)
  })
})
