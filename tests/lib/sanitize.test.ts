import { describe, expect, it } from 'vitest'
import { coverToCss, sanitizeSvg } from '@/lib/sanitize'
import { cleanCover, cleanIcon, cleanPageMeta, cleanTitle } from '@/lib/pageMeta'

describe('sanitizeSvg', () => {
  it('removes scripts, event handlers, foreign HTML and dangerous links', () => {
    const evil = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
      <script>alert(2)</script>
      <rect width="10" height="10" onclick="alert(3)"/>
      <foreignObject><img src="x" onerror="alert(4)"></foreignObject>
      <a href="javascript:alert(5)"><text>click</text></a>
      <image href="https://tracker.example/pixel.png"/>
      <use href="javascript:alert(6)"/>
    </svg>`
    const out = sanitizeSvg(evil)
    for (const bad of ['alert', 'script', 'onload', 'onclick', 'onerror', 'foreignObject', 'javascript:', 'tracker.example']) expect(out).not.toContain(bad)
    expect(out).toContain('<rect')
  })

  it('keeps what drawings need: shapes, text, embedded fonts and data: images', () => {
    const ok = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>@font-face{font-family:"Nunito";src:url(data:font/woff2;base64,AAAA)}</style><g><rect x="1" y="1" width="5" height="5" fill="#a5d8ff"/><text x="2" y="8" font-family="Nunito">Hello</text><image href="data:image/png;base64,iVBORw0KGgo=" width="2" height="2"/></g></svg>`
    const out = sanitizeSvg(ok)
    expect(out).toContain('@font-face')
    expect(out).toContain('Hello')
    expect(out).toContain('data:image/png;base64')
    expect(out).toContain('fill="#a5d8ff"')
  })

  it('keeps shape geometry (regression: library tiles and drawing previews were blank)', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 109.35 110.6"><g stroke-linecap="round" transform="translate(6 6) rotate(0 48.6 49.3)"><path d="M24.65 0 C39.97 0.38 L1 2" stroke="#000000" stroke-width="2" fill="none"/><ellipse cx="5" cy="5" rx="3" ry="2" opacity="0.5"/><polyline points="0,0 10,10"/></g><use href="#p1"/></svg>'
    const out = sanitizeSvg(svg)
    for (const keep of ['viewBox="0 0 109.35 110.6"', 'd="M24.65 0 C39.97 0.38 L1 2"', 'transform="translate(6 6) rotate(0 48.6 49.3)"', 'stroke-width="2"', 'stroke-linecap="round"', 'cx="5"', 'points="0,0 10,10"', 'href="#p1"'])
      expect(out).toContain(keep)
  })

  it('blocks remote loads through CSS url() in style attributes and <style>', () => {
    const out = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><style>@font-face{src:url(https://evil.example/f.woff2)} .a{fill:url(#g)}</style><rect style="fill:url(https://evil.example/t.png)" width="1" height="1"/><rect style="fill:url(#grad)" width="1" height="1"/></svg>',
    )
    expect(out).not.toContain('evil.example')
    expect(out).toContain('url(#grad)')
    expect(out).toContain('url(#g)')
  })

  it('handles empty input', () => {
    expect(sanitizeSvg('')).toBe('')
  })
})

describe('covers', () => {
  it('accepts presets, colors and https/data images', () => {
    expect(coverToCss('linear-gradient(135deg, #f6d365 0%, #fda085 100%)')).toBe('linear-gradient(135deg, #f6d365 0%, #fda085 100%)')
    expect(coverToCss('#E3E2E0')).toBe('#E3E2E0')
    expect(coverToCss('https://images.example/a.jpg')).toBe('center / cover no-repeat url("https://images.example/a.jpg")')
    expect(coverToCss('data:image/png;base64,iVBORw0KGgo=')).toContain('url("data:image/png')
  })

  it('accepts images stored by the app (cover uploaded from the computer)', () => {
    const url = 'notion-asset://local/0f8fad5b-d9cb-469f-a165-70867728950e.jpg'
    expect(coverToCss(url)).toBe(`center / cover no-repeat url("${url}")`)
    expect(cleanCover(url)).toBe(url)
    for (const bad of ['notion-asset://local/../secret.jpg', 'notion-asset://evil/0f8fad5b-d9cb-469f-a165-70867728950e.jpg', 'notion-asset://local/x.jpg")', 'notion-asset://local/0f8fad5b-d9cb-469f-a165-70867728950e.html'])
      expect(coverToCss(bad)).toBeUndefined()
  })

  it('rejects anything that could break out of the CSS value or load odd URLs', () => {
    for (const bad of [
      'https://x.example/a.jpg"); background: url(https://evil.example/t',
      'https://x.example/a\\\\"b',
      'url(https://evil.example/t)',
      'linear-gradient(red, blue), url(https://evil.example/t)',
      'http://insecure.example/a.jpg',
      'javascript:alert(1)',
      'expression(alert(1))',
      'red; position: fixed',
      '',
      null,
    ])
      expect(coverToCss(bad as string)).toBeUndefined()
  })
})

describe('page fields', () => {
  it('cleans titles, icons and covers', () => {
    expect(cleanTitle('a\nb')).toBe('a b')
    expect(cleanTitle({} as never)).toBe('')
    expect(cleanTitle('x'.repeat(600))).toHaveLength(500)
    expect(cleanIcon('🚀')).toBe('🚀')
    expect(cleanIcon({ evil: 1 })).toBeNull()
    expect(cleanIcon('x'.repeat(100))).toBeNull()
    expect(cleanCover('red; position: fixed')).toBeNull()
  })

  it('makes corrupted page metadata safe to show', () => {
    const meta = cleanPageMeta({ id: 'p', title: 42 as never, icon: ['x'] as never, cover: { a: 1 } as never, kind: 'weird' as never, order: 'x' as never, width: 'huge' as never, parentId: 5 as never })
    expect(meta).toEqual({ id: 'p', kind: 'doc', title: '', icon: null, cover: null, parentId: null, width: null, order: 0, createdAt: 0, updatedAt: 0 })
  })
})
