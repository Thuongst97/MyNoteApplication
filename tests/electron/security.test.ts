// @vitest-environment node
import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { assetResponseHeaders, isAppUrl, isPermissionAllowed, isSafeExternalUrl } from '../../electron/security'

const index = path.resolve('/opt/app/resources/app.asar/dist/index.html')
const appUrl = pathToFileURL(index).toString()

describe('isAppUrl (which pages may talk to the main process)', () => {
  it('accepts only the app page itself', () => {
    expect(isAppUrl(appUrl, { rendererIndexFile: index })).toBe(true)
    expect(isAppUrl(`${appUrl}#/page`, { rendererIndexFile: index })).toBe(true)
    expect(isAppUrl(pathToFileURL('/opt/app/resources/app.asar/dist/other.html').toString(), { rendererIndexFile: index })).toBe(false)
    expect(isAppUrl('file:///etc/passwd', { rendererIndexFile: index })).toBe(false)
    expect(isAppUrl('https://libraries.excalidraw.com/', { rendererIndexFile: index })).toBe(false)
    expect(isAppUrl('', { rendererIndexFile: index })).toBe(false)
    expect(isAppUrl(undefined, { rendererIndexFile: index })).toBe(false)
  })

  it('accepts the dev server only when one is configured', () => {
    expect(isAppUrl('http://localhost:5173/', { rendererIndexFile: index, devServerUrl: 'http://localhost:5173/' })).toBe(true)
    expect(isAppUrl('http://localhost:5173/', { rendererIndexFile: index })).toBe(false)
    expect(isAppUrl('http://localhost:5174/', { rendererIndexFile: index, devServerUrl: 'http://localhost:5173/' })).toBe(false)
  })
})

describe('isSafeExternalUrl (what may be opened in the system browser)', () => {
  it('allows only web links', () => {
    expect(isSafeExternalUrl('https://example.com/x')).toBe(true)
    expect(isSafeExternalUrl('http://example.com')).toBe(true)
    for (const bad of ['file:///C:/Windows/System32/calc.exe', 'javascript:alert(1)', 'smb://host/share', 'ms-msdt:/id', 'notionclone://page/x', 'not a url', 'https://'])
      expect(isSafeExternalUrl(bad)).toBe(false)
  })
})

describe('isPermissionAllowed', () => {
  const isApp = (u: string) => u === appUrl
  it('allows clipboard/fullscreen for the app and denies everything else', () => {
    expect(isPermissionAllowed('clipboard-sanitized-write', appUrl, isApp)).toBe(true)
    expect(isPermissionAllowed('fullscreen', appUrl, isApp)).toBe(true)
    for (const p of ['media', 'geolocation', 'notifications', 'openExternal', 'midi', 'hid', 'serial', 'usb'])
      expect(isPermissionAllowed(p, appUrl, isApp)).toBe(false)
    expect(isPermissionAllowed('clipboard-read', 'https://libraries.excalidraw.com/', isApp)).toBe(false)
  })
})

describe('assetResponseHeaders', () => {
  it('prevents MIME sniffing and script execution', () => {
    const h = assetResponseHeaders('image/svg+xml')
    expect(h['content-type']).toBe('image/svg+xml')
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['content-security-policy']).toMatch(/default-src 'none'/)
    expect(h['content-security-policy']).toMatch(/sandbox/)
  })

  it('lets only the app page (file://) read images with fetch()', () => {
    expect(assetResponseHeaders('image/png', 'null')['access-control-allow-origin']).toBe('null')
    expect(assetResponseHeaders('image/png', 'file://')['access-control-allow-origin']).toBe('file://')
    expect(assetResponseHeaders('image/png', 'https://evil.example')['access-control-allow-origin']).toBeUndefined()
    expect(assetResponseHeaders('image/png')['access-control-allow-origin']).toBeUndefined()
  })
})

describe('bundled font protocol', () => {
  it('serves only .woff2 files under fonts/ of the bundled assets', async () => {
    const { resolveBundledFont } = await import('../../electron/security')
    const root = path.resolve(path.sep, 'app', 'dist', 'excalidraw-assets') // absolute on every OS (adds the drive on Windows)
    expect(resolveBundledFont('app-font://bundle/fonts/Excalifont/Excalifont-Regular-a88b.woff2', root)).toBe(path.join(root, 'fonts', 'Excalifont', 'Excalifont-Regular-a88b.woff2'))
    for (const bad of [
      'app-font://bundle/fonts/../../../etc/passwd',
      'app-font://bundle/fonts/%2e%2e/%2e%2e/secret.woff2',
      'app-font://bundle/fonts/X/a.js',
      'app-font://bundle/index.html',
      'app-font://other/fonts/X/a.woff2',
      'file:///etc/passwd',
      'not a url',
    ])
      expect(resolveBundledFont(bad, root)).toBeNull()
  })
})
