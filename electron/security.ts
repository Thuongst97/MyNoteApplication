/**
 * Security policy helpers for the main process. Kept free of Electron imports so
 * they can be unit-tested.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Is `url` one of the app's own pages? In development that's the Vite dev server,
 * in a build it's dist/index.html loaded from disk.
 */
export function isAppUrl(url: string | undefined | null, opts: { devServerUrl?: string; rendererIndexFile: string }): boolean {
  if (!url) return false
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (opts.devServerUrl) {
    try {
      if (u.origin === new URL(opts.devServerUrl).origin) return true
    } catch {
      // ignore malformed dev URL
    }
  }
  if (u.protocol !== 'file:') return false
  try {
    return path.resolve(fileURLToPath(`file://${u.host}${u.pathname}`)) === path.resolve(opts.rendererIndexFile)
  } catch {
    return false
  }
}

/** Only web links may be handed to the operating system's browser. */
export function isSafeExternalUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname
  } catch {
    return false
  }
}

/** Permissions the app's own pages may use; everything else (camera, mic, location, …) is denied. */
const APP_PERMISSIONS = new Set(['clipboard-sanitized-write', 'clipboard-read', 'fullscreen'])

export function isPermissionAllowed(permission: string, requestingUrl: string, isApp: (url: string) => boolean): boolean {
  return APP_PERMISSIONS.has(permission) && isApp(requestingUrl)
}

/** Response headers for stored images served via notion-asset:// */
export function assetResponseHeaders(mime: string): Record<string, string> {
  return {
    'content-type': mime,
    'x-content-type-options': 'nosniff',
    // If an image (e.g. an SVG) were ever opened as a document, nothing in it may run or load.
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
    'cache-control': 'private, max-age=31536000, immutable',
  }
}
