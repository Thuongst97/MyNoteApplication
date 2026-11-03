import type { PageKind, PageMeta } from '@/types'
import { normalizeWidth } from './pageWidth'
import { normalizeFont } from './pageFont'

/** Validation shared by the main process (saving/loading) and the renderer (display). */

const SAFE_GRADIENT = /^(?:linear|radial)-gradient\([#%0-9a-z.,\s()-]+\)$/i
const SAFE_COLOR = /^#[0-9a-f]{3,8}$/i

/**
 * Turns a stored cover value into a safe CSS background: an https/data image URL
 * (escaped), a gradient or a color. Anything else is ignored.
 */
export function coverToCss(cover: string | null | undefined): string | undefined {
  // data: covers (browser dev mode) can be a few MB; everything else is short.
  if (!cover || typeof cover !== 'string' || cover.length > 8_000_000) return undefined
  if (
    /^https:\/\/[^\s"'()\\]+$/i.test(cover) ||
    // Images stored by the app (cover uploaded from the computer).
    /^notion-asset:\/\/local\/[0-9a-f-]{36}\.(?:png|jpg|gif|webp|avif|bmp|svg)$/.test(cover) ||
    /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+/=]+$/i.test(cover)
  ) {
    return `center / cover no-repeat url("${cover}")`
  }
  if (SAFE_GRADIENT.test(cover) && !/url\s*\(/i.test(cover)) return cover
  if (SAFE_COLOR.test(cover)) return cover
  return undefined
}

export const MAX_TITLE = 500
export const MAX_ICON = 64

/** Title: a string, newlines removed, length-limited. */
export function cleanTitle(v: unknown): string {
  return typeof v === 'string' ? v.replace(/[\r\n]+/g, ' ').slice(0, MAX_TITLE) : ''
}

/** Icon: a short string (an emoji) or null. */
export function cleanIcon(v: unknown): string | null {
  // An emoji or a short symbol: no markup characters, no control characters.
  return typeof v === 'string' && v.trim() && v.length <= MAX_ICON && !/[<>"'`&\\\u0000-\u001f\u007f]/.test(v) ? v : null
}

/** Cover: only values that render as a safe background, otherwise null. */
export function cleanCover(v: unknown): string | null {
  return typeof v === 'string' && coverToCss(v) ? v : null
}

/** A known page kind ('doc' for anything else). */
export function normalizeKind(v: unknown): PageKind {
  return v === 'whiteboard' || v === 'slides' ? v : 'doc'
}

/** Makes page metadata from disk safe to display (corrupted or hand-edited files). */
export function cleanPageMeta(raw: Partial<PageMeta> & { id: string }): PageMeta {
  return {
    id: raw.id,
    kind: normalizeKind(raw.kind),
    title: cleanTitle(raw.title),
    icon: cleanIcon(raw.icon),
    cover: cleanCover(raw.cover),
    parentId: typeof raw.parentId === 'string' ? raw.parentId : null,
    ...(raw.width !== undefined && raw.width !== null ? { width: normalizeWidth(raw.width) } : {}),
    ...(normalizeFont(raw.font) ? { font: normalizeFont(raw.font) } : {}),
    order: Number.isFinite(raw.order) ? Number(raw.order) : 0,
    createdAt: Number.isFinite(raw.createdAt) ? Number(raw.createdAt) : 0,
    updatedAt: Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : 0,
  }
}
