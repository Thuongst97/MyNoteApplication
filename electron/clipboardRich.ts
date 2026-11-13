/**
 * Clipboard content that works outside the app. Pages show stored images with
 * notion-asset:// URLs, which no other program can load: when copying, those images are
 * embedded (data: URLs) and, for a single image, the image itself is put on the clipboard
 * too, so web editors such as Jira, Confluence or GitHub paste (upload) it.
 */

const ASSET_URL = /notion-asset:\/\/local\/[0-9a-f-]{36}\.(?:png|jpg|gif|webp|avif|bmp|svg)/g
/** Embedded images stop being added past this total (the clipboard stays responsive). */
export const MAX_INLINE_BYTES = 40 * 1024 * 1024

export const assetUrlsIn = (html: string) => [...new Set(html.match(ASSET_URL) ?? [])]

/** Replaces our image URLs in `html` with data: URLs (images that can't be read are kept as is). */
export async function inlineAssetImages(html: string, read: (url: string) => Promise<{ data: Uint8Array; mime: string } | null>): Promise<string> {
  let total = 0
  const map = new Map<string, string>()
  for (const url of assetUrlsIn(html)) {
    const hit = await read(url)
    if (!hit || total + hit.data.byteLength > MAX_INLINE_BYTES) continue
    total += hit.data.byteLength
    map.set(url, `data:${hit.mime};base64,${Buffer.from(hit.data).toString('base64')}`)
  }
  return map.size ? html.replace(ASSET_URL, (u) => map.get(u) ?? u) : html
}

/** The image to put on the clipboard as a picture: when the HTML holds exactly one image. */
export function singleImageSrc(html: string): string | null {
  const srcs = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)].map((m) => m[1])
  return srcs.length === 1 ? srcs[0] : null
}

/** Size of an SVG from its width/height or viewBox (px), clamped to sane bounds. */
export function svgSize(svg: string): { width: number; height: number } {
  const open = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? ''
  const num = (name: string) => {
    const m = new RegExp(`\\b${name}="([\\d.]+)(px)?"`, 'i').exec(open)
    return m ? Number(m[1]) : NaN
  }
  let width = num('width')
  let height = num('height')
  const vb = /\bviewBox="[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)"/i.exec(open)
  if (vb && !(width > 0 && height > 0)) {
    width = Number(vb[1])
    height = Number(vb[2])
  }
  const clamp = (n: number) => Math.round(Math.min(8000, Math.max(16, Number.isFinite(n) && n > 0 ? n : 600)))
  return { width: clamp(width), height: clamp(height) }
}
