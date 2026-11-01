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
})
