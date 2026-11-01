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
    const a = path.resolve(fileURLToPath(`file://${u.host}${u.pathname}`))
    const b = path.resolve(opts.rendererIndexFile)
    // Windows paths are case-insensitive (e.g. "d:\\…" vs "D:\\…" depending on how the app was started).
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
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
export function assetResponseHeaders(mime: string, origin?: string | null): Record<string, string> {
  return {
    // Only the app's own page (file://, reported as "null" or file://) may read images
    // with fetch() — used to load whiteboard images into the canvas.
    ...(origin === 'null' || origin?.startsWith('file://') ? { 'access-control-allow-origin': origin } : {}),
    'content-type': mime,
    'x-content-type-options': 'nosniff',
    // If an image (e.g. an SVG) were ever opened as a document, nothing in it may run or load.
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",
    'cache-control': 'private, max-age=31536000, immutable',
  }
}

/** Scheme serving Excalidraw's bundled fonts: app-font://bundle/fonts/<Family>/<file>.woff2 */
export const FONT_SCHEME = 'app-font'

/** Maps an app-font:// URL to a font file inside `fontsRoot`, or null (anything else is refused). */
export function resolveBundledFont(url: string, fontsRoot: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== `${FONT_SCHEME}:` || u.hostname !== 'bundle') return null
  let rel: string
  try {
    rel = decodeURIComponent(u.pathname).replace(/^\/+/, '')
  } catch {
    return null
  }
  if (!/^fonts\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\.woff2$/.test(rel) || rel.includes('..')) return null
  const file = path.resolve(fontsRoot, rel)
  return file.startsWith(path.resolve(fontsRoot) + path.sep) ? file : null
}
