import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { htmlToText, sanitizeHtml, scopeCss } from '@/lib/html'
import { docToText } from '@/lib/docText'
import { HtmlRender } from '@/components/Editor/html/HtmlRender'

describe('HTML block sanitizing', () => {
  it('removes scripts, event handlers, frames and forms but keeps markup and styles', () => {
    const out = sanitizeHtml(
      '<style>.c{color:red}</style><div class="c" onclick="alert(1)">Hi <b>there</b></div><script>alert(1)</script><iframe src="x"></iframe><form><input></form><img src="x" onerror="alert(1)">',
    )
    expect(out).toContain('<style>.c{color:red}</style>')
    expect(out).toContain('<div class="c">Hi <b>there</b></div>')
    expect(out).not.toMatch(/script|onclick|onerror|iframe|<form|<input/i)
  })

  it('blocks javascript: links and opens real links in the browser', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a><a href="https://example.com">y</a>')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">y</a>')
  })

  it('keeps the styles of a whole pasted document and scopes html/body rules to the block', () => {
    const out = sanitizeHtml('<!doctype html><html><head><title>t</title><style>body { font-family: serif } html,body{margin:0}</style></head><body><p>Doc</p></body></html>')
    expect(out).toContain('.html-root { font-family: serif }')
    expect(out).toContain('.html-root,.html-root{margin:0}')
    expect(out).toContain('<p>Doc</p>')
    expect(out).not.toContain('<title>')
  })

  it('drops @import (no loading other stylesheets)', () => {
    expect(sanitizeHtml('<style>@import url(https://x.y/a.css); p{color:red}</style><p>a</p>')).not.toContain('@import')
  })

  it('scopes only real html/body selectors', () => {
    expect(scopeCss('body{a:b} .body{c:d} div > body p{e:f} #html{}')).toBe('.html-root{a:b} .body{c:d} div > .html-root p{e:f} #html{}')
  })
})

describe('HTML block text', () => {
  it('extracts readable text for search (no tags, styles or entities)', () => {
    expect(htmlToText('<style>p{color:red}</style><h1>Hello!</h1><p>Tom &amp; Jerry&nbsp;&lt;3</p>')).toBe('Hello!\nTom & Jerry <3')
  })
  it('is part of the page text', () => {
    expect(docToText({ type: 'doc', content: [{ type: 'htmlBlock', attrs: { source: '<b>Find me</b>' } }] })).toBe('Find me')
  })
})

describe('HtmlRender', () => {
  it('renders into a shadow root so styles stay inside the block', () => {
    const { container } = render(<HtmlRender source={'<style>p{color:rgb(255, 0, 0)}</style><p>inside</p>'} />)
    const host = container.querySelector('[data-html-block]') as HTMLElement
    expect(host.shadowRoot).toBeTruthy()
    expect(host.shadowRoot!.querySelector('.html-root p')!.textContent).toBe('inside')
    // Nothing leaks into the document itself.
    expect(document.querySelectorAll('p')).toHaveLength(0)
    expect(host.innerHTML).toBe('')
  })
})
