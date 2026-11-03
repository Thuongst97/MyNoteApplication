import { randomUUID } from 'node:crypto'
import { untrustScripts } from '../src/lib/untrust'
import { normalizeKind } from '../src/lib/pageMeta'
import type { Page, PageMeta, PageUpdate } from '../src/types'

/**
 * Portable page files (`.ncpage`): one page, optionally with all its sub-pages,
 * and every image they use embedded as base64, so the file can be shared and
 * imported into anyone's notes.
 */
export const PAGE_FILE_FORMAT = 'notionclone-page'
export const PAGE_FILE_VERSION = 1
export const PAGE_FILE_EXT = 'ncpage'

/** Imports bigger than this are refused (protects memory). */
export const MAX_IMPORT_BYTES = 300 * 1024 * 1024
const MAX_PAGES = 2000
const MAX_ASSETS = 5000

export interface PageBundle {
  format: typeof PAGE_FILE_FORMAT
  version: number
  exportedAt: string
  /** First page is the exported page; the rest are its descendants (parents before children). */
  pages: Array<Pick<Page, 'id' | 'kind' | 'title' | 'icon' | 'cover' | 'width' | 'font' | 'content'> & { parentId: string | null; order: number }>
  /** Embedded images, keyed by the URL used inside the pages. */
  assets: Record<string, { mime: string; data: string }>
}

interface Storage {
  getTree(): Promise<PageMeta[]>
  read(id: string): Promise<Page | null>
  save(update: PageUpdate): Promise<PageMeta | null>
}
interface Assets {
  read(url: string): Promise<{ data: Uint8Array; mime: string } | null>
  save(data: Uint8Array, mime: string): Promise<string>
}

const ASSET_URL = /notion-asset:\/\/local\/[0-9a-f-]{36}\.[a-z]+/g
// Ids are remapped by text replacement, so they must be long and unique (the app uses UUIDs).
const ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

/** Builds a bundle for a page (and, optionally, all of its sub-pages). */
export async function exportPages(storage: Storage, assets: Assets, rootId: string, includeChildren = true): Promise<PageBundle> {
  const tree = await storage.getTree()
  const ids = [rootId]
  if (includeChildren) {
    for (let i = 0; i < ids.length; i++) for (const p of tree) if (p.parentId === ids[i]) ids.push(p.id)
  }
  const pages: PageBundle['pages'] = []
  const urls = new Set<string>()
  for (const id of ids) {
    const page = await storage.read(id)
    if (!page) continue
    pages.push({
      id: page.id,
      kind: page.kind,
      title: page.title,
      icon: page.icon,
      cover: page.cover,
      width: page.width ?? null,
      font: page.font ?? null,
      content: page.content,
      parentId: id === rootId ? null : page.parentId,
      order: page.order,
    })
    for (const m of JSON.stringify([page.content, page.cover]).matchAll(ASSET_URL)) urls.add(m[0])
  }
  if (!pages.length) throw new Error('Page not found')
  const bundleAssets: PageBundle['assets'] = {}
  for (const url of urls) {
    const file = await assets.read(url)
    if (file) bundleAssets[url] = { mime: file.mime, data: Buffer.from(file.data).toString('base64') }
  }
  return { format: PAGE_FILE_FORMAT, version: PAGE_FILE_VERSION, exportedAt: new Date().toISOString(), pages, assets: bundleAssets }
}

/** Parses and checks an untrusted page file. Throws a readable error when it isn't one. */
export function parseBundle(text: string): PageBundle {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('This file is not a PremiumNote page file.')
  }
  const b = raw as Partial<PageBundle>
  if (!b || typeof b !== 'object' || b.format !== PAGE_FILE_FORMAT) throw new Error('This file is not a PremiumNote page file.')
  if (typeof b.version !== 'number' || b.version > PAGE_FILE_VERSION) throw new Error('This page file was made by a newer version of the app.')
  if (!Array.isArray(b.pages) || b.pages.length === 0) throw new Error('The page file contains no pages.')
  if (b.pages.length > MAX_PAGES) throw new Error(`The page file contains too many pages (max ${MAX_PAGES}).`)
  const seen = new Set<string>()
  for (const p of b.pages) {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !ID_PATTERN.test(p.id) || seen.has(p.id)) throw new Error('The page file is damaged (bad page id).')
    seen.add(p.id)
    if (p.content != null && typeof p.content !== 'object') throw new Error('The page file is damaged (bad content).')
  }
  const assets = b.assets && typeof b.assets === 'object' && !Array.isArray(b.assets) ? b.assets : {}
  if (Object.keys(assets).length > MAX_ASSETS) throw new Error('The page file contains too many images.')
  return { ...(b as PageBundle), assets }
}

/**
 * Imports a bundle as new pages under `parentId` (null = top level). Every page gets a
 * new id, links between the imported pages are pointed at the new ids, and images are
 * stored again. Returns the new id of the top page and how many pages were created.
 */
export async function importPages(storage: Storage, assets: Assets, bundle: PageBundle, parentId: string | null): Promise<{ rootId: string; count: number; skippedImages: number }> {
  const idMap = new Map<string, string>()
  for (const p of bundle.pages) idMap.set(p.id, randomUUID())

  // Re-store images (types and sizes are checked by the asset store).
  const urlMap = new Map<string, string>()
  let skippedImages = 0
  for (const [url, a] of Object.entries(bundle.assets)) {
    if (!/^notion-asset:\/\/local\/[0-9a-f-]{36}\.[a-z]+$/.test(url) || !a || typeof a.data !== 'string' || typeof a.mime !== 'string') {
      skippedImages++
      continue
    }
    try {
      urlMap.set(url, await assets.save(new Uint8Array(Buffer.from(a.data, 'base64')), a.mime))
    } catch {
      skippedImages++
    }
  }

  const remap = (value: unknown) => {
    if (value == null) return value
    let json = JSON.stringify(value)
    for (const [from, to] of urlMap) json = json.split(from).join(to)
    // Old ids appear in page links (pageLink/mention attrs, notionclone://page/<id> hrefs, whiteboard links).
    for (const [from, to] of idMap) json = json.split(from).join(to)
    return JSON.parse(json)
  }

  // Parents first, so a sub-page's parent always exists when it's saved.
  const root = bundle.pages[0]
  const ordered = [root, ...bundle.pages.slice(1)]
  const now = Date.now()
  let count = 0
  for (const p of ordered) {
    const isRoot = p === root
    const mappedParent = isRoot ? parentId : p.parentId && idMap.has(p.parentId) ? idMap.get(p.parentId)! : idMap.get(root.id)!
    const saved = await storage.save({
      id: idMap.get(p.id)!,
      kind: normalizeKind(p.kind),
      title: typeof p.title === 'string' ? p.title : '',
      icon: typeof p.icon === 'string' ? p.icon : null,
      cover: typeof p.cover === 'string' ? (remap(p.cover) as string) : null,
      width: p.width ?? null,
      font: p.font ?? null,
      parentId: mappedParent,
      order: isRoot ? now : Number.isFinite(p.order) ? p.order : now + count,
      // Scripts in interactive HTML blocks from someone else's page wait for Run.
      content: (untrustScripts(remap(p.content)) as Page['content']) ?? null,
    })
    if (saved) count++
  }
  return { rootId: idMap.get(root.id)!, count, skippedImages }
}

/** A safe default file name from a page title. */
export function fileNameFor(title: string, ext: string) {
  const base = (title || 'Untitled').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Untitled'
  return `${base}.${ext}`
}
