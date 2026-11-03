import { describe, expect, it } from 'vitest'
import { SANDBOX_SHELL, isAllowedFrameUrl, sandboxCsp, sandboxResponse } from '../../electron/sandbox'
import { untrustScripts } from '@/lib/untrust'

const directive = (csp: string, name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' ')) ?? ''

describe('interactive HTML sandbox', () => {
  it('serves only the two shell pages', () => {
    expect(sandboxResponse('pn-sandbox://frame/offline')).not.toBeNull()
    expect(sandboxResponse('pn-sandbox://frame/online?r=1')).not.toBeNull()
    for (const bad of ['pn-sandbox://frame/other', 'pn-sandbox://evil/offline', 'https://frame/offline', 'notion-asset://local/x', 'not a url', ''])
      expect(sandboxResponse(bad)).toBeNull()
  })

  it('offline frames can run their own scripts but reach nothing outside', () => {
    const csp = sandboxResponse('pn-sandbox://frame/offline')!.headers['content-security-policy']
    expect(csp).toBe(sandboxCsp(false))
    expect(directive(csp, 'connect-src')).toBe("connect-src 'none'")
    expect(directive(csp, 'script-src')).not.toMatch(/https|http:|\*/)
    expect(directive(csp, 'img-src')).toBe('img-src data: blob:')
    expect(csp).not.toMatch(/notion-asset|file:|app-font/)
    for (const d of ["frame-src 'none'", "object-src 'none'", "form-action 'none'", "base-uri 'none'", "default-src 'none'"]) expect(csp).toContain(d)
  })

  it('online frames may use https (never plain http or the app’s own schemes)', () => {
    const csp = sandboxCsp(true)
    expect(directive(csp, 'connect-src')).toBe('connect-src https: wss:')
    expect(directive(csp, 'script-src')).toContain('https:')
    expect(csp).not.toMatch(/http:|notion-asset|file:/)
  })

  it('the shell only accepts the block from its parent, once', () => {
    expect(SANDBOX_SHELL).toContain('e.source !== parent')
    expect(SANDBOX_SHELL).toContain("removeEventListener('message', onMessage)")
    const headers = sandboxResponse('pn-sandbox://frame/offline')!.headers
    expect(headers['x-content-type-options']).toBe('nosniff')
  })

  it('frames inside the app may not navigate to anything else', () => {
    expect(isAllowedFrameUrl('pn-sandbox://frame/offline?r=x')).toBe(true)
    for (const url of ['https://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'about:blank', 'data:text/html,hi']) expect(isAllowedFrameUrl(url)).toBe(false)
  })

  it('untrustScripts clears trust on every HTML block, anywhere in the content', () => {
    const block = (trusted: boolean) => ({ type: 'htmlBlock', attrs: { source: 'x', interactive: true, trusted } })
    const out = untrustScripts({ type: 'slides', slides: [{ content: { type: 'doc', content: [block(true), { type: 'paragraph' }, { type: 'callout', content: [block(true)] }] } }] })
    expect(JSON.stringify(out)).not.toContain('"trusted":true')
    expect(JSON.stringify(out).match(/"trusted":false/g)).toHaveLength(2)
    expect(untrustScripts(null)).toBeNull()
    expect(untrustScripts('text')).toBe('text')
  })
})
