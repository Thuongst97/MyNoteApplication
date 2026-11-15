import { describe, expect, it } from 'vitest'
import { newHtmlPageContent, normalizeHtmlPage } from '@/components/HtmlPage/htmlPageModel'
import { untrustScripts } from '@/lib/untrust'
import { normalizeKind } from '@/lib/pageMeta'
import { docToText } from '@/lib/docText'

describe('web page (HTML page type)', () => {
  it('is a known page kind', () => {
    expect(normalizeKind('html')).toBe('html')
    expect(normalizeKind('nope')).toBe('doc')
  })
  it('starts as an interactive, offline page with a working example', () => {
    const c = newHtmlPageContent()
    expect(c).toMatchObject({ type: 'htmlPage', interactive: true, allowNetwork: false, trusted: true })
    expect(c.source).toContain('<script>')
  })
  it('fills in missing or wrong fields', () => {
    expect(normalizeHtmlPage(null)).toEqual({ type: 'htmlPage', source: '', interactive: true, allowNetwork: false, trusted: true })
    expect(normalizeHtmlPage({ source: 5, interactive: false, allowNetwork: 'yes', trusted: false })).toEqual({ type: 'htmlPage', source: '', interactive: false, allowNetwork: false, trusted: false })
  })
  it("imported pages don't run their scripts until the user presses Run", () => {
    expect(untrustScripts({ ...newHtmlPageContent() }).trusted).toBe(false)
  })
  it('is searchable by its text', () => {
    expect(docToText({ type: 'htmlPage', source: '<h1>Hello CAN bus</h1><script>x()</script>' } as never)).toContain('Hello CAN bus')
  })
})
