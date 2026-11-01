/**
 * Drawing libraries (reusable shapes for whiteboards and drawings).
 * Shared by the main process (storage, downloads) and the renderer (UI).
 */

export interface LibraryItem {
  id: string
  name?: string
  created: number
  /** Excalidraw elements of this item. */
  elements: unknown[]
}

export interface LibraryCategory {
  id: string
  name: string
  /** Where it came from: a URL, 'personal', or 'file'. */
  source: string
  installedAt: number
  collapsed?: boolean
  items: LibraryItem[]
}

export interface LibraryData {
  version: 1
  categories: LibraryCategory[]
}

export const PERSONAL_ID = 'personal'
export const MAX_LIBRARY_BYTES = 20 * 1024 * 1024
export const MAX_ITEMS_PER_LIBRARY = 2000

const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

export function personalCategory(): LibraryCategory {
  return { id: PERSONAL_ID, name: 'Personal library', source: 'personal', installedAt: 0, items: [] }
}

export function emptyLibraries(): LibraryData {
  return { version: 1, categories: [personalCategory()] }
}

const isElement = (e: unknown) => !!e && typeof e === 'object' && typeof (e as { type?: unknown }).type === 'string'

function cleanItem(raw: unknown): LibraryItem | null {
  // v2 item: { id, elements, name?, created? }   v1 item: an array of elements
  const r = raw as { id?: unknown; name?: unknown; created?: unknown; elements?: unknown } | unknown[]
  const elements = Array.isArray(r) ? r : Array.isArray(r?.elements) ? r.elements : null
  if (!elements || !elements.length || !elements.every(isElement)) return null
  const obj = Array.isArray(r) ? {} : (r as { id?: unknown; name?: unknown; created?: unknown })
  return {
    id: typeof obj.id === 'string' && obj.id ? obj.id.slice(0, 64) : rid(),
    ...(typeof obj.name === 'string' && obj.name.trim() ? { name: obj.name.trim().slice(0, 120) } : {}),
    created: typeof obj.created === 'number' ? obj.created : Date.now(),
    elements: (elements as Array<{ isDeleted?: boolean }>).filter((e) => !e.isDeleted),
  }
}

/** Parses an .excalidrawlib file (version 1 or 2). Throws a readable error if it isn't one. */
export function parseLibraryFile(text: string): LibraryItem[] {
  let json: { type?: unknown; libraryItems?: unknown; library?: unknown }
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('This file is not a valid library (not JSON).')
  }
  if (json?.type !== 'excalidrawlib') throw new Error('This file is not an Excalidraw library.')
  const raw = Array.isArray(json.libraryItems) ? json.libraryItems : Array.isArray(json.library) ? json.library : null
  if (!raw) throw new Error('The library has no items.')
  const items = raw.slice(0, MAX_ITEMS_PER_LIBRARY).map(cleanItem).filter((i): i is LibraryItem => !!i)
  if (!items.length) throw new Error('The library has no usable items.')
  // ids must be unique within a library
  const seen = new Set<string>()
  for (const it of items) {
    if (seen.has(it.id)) it.id = rid()
    seen.add(it.id)
  }
  return items
}

/** A readable library name from its URL or file name ("software-architecture" → "Software architecture"). */
export function libraryNameFrom(source: string): string {
  const last = decodeURIComponent(source.split(/[?#]/)[0].split(/[/\\]/).pop() ?? '')
  const base = last.replace(/\.excalidrawlib$/i, '').replace(/[-_]+/g, ' ').trim()
  return base ? base[0].toUpperCase() + base.slice(1) : 'Library'
}

export interface UrlPolicy {
  /** Allow plain http:// to localhost (development and tests only, never in releases). */
  allowLocalHttp?: boolean
}

/** Only https:// URLs may be downloaded (plus http://localhost when explicitly allowed). */
export function isAllowedLibraryUrl(url: string, policy: UrlPolicy = {}): boolean {
  try {
    const u = new URL(url)
    if (u.username || u.password) return false
    if (u.protocol === 'https:') return !!u.hostname
    return !!policy.allowLocalHttp && u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
  } catch {
    return false
  }
}

/**
 * The library URL from a libraries.excalidraw.com "Add to Excalidraw" link
 * (…#addLibrary=<encoded url>&token=…), or null.
 */
export function addLibraryUrlFrom(link: string, policy: UrlPolicy = {}): string | null {
  try {
    const u = new URL(link)
    const params = new URLSearchParams(u.hash.slice(1) || u.search.slice(1))
    const lib = params.get('addLibrary')
    return lib && isAllowedLibraryUrl(lib, policy) ? lib : null
  } catch {
    return null
  }
}

/**
 * Adds a downloaded library as a category. Installing the same URL again updates
 * that category instead of creating a duplicate.
 */
export function installLibrary(data: LibraryData, source: string, items: LibraryItem[], name = libraryNameFrom(source)): { data: LibraryData; categoryId: string } {
  const existing = source !== 'file' ? data.categories.find((c) => c.source === source) : undefined
  if (existing) {
    return {
      categoryId: existing.id,
      data: { ...data, categories: data.categories.map((c) => (c.id === existing.id ? { ...c, items, installedAt: Date.now() } : c)) },
    }
  }
  const cat: LibraryCategory = { id: rid(), name, source, installedAt: Date.now(), items }
  return { categoryId: cat.id, data: { ...data, categories: [...data.categories, cat] } }
}

/** Makes stored data valid: personal category first, unique ids, valid items. */
export function normalizeLibraries(raw: unknown): LibraryData {
  const r = raw as Partial<LibraryData> | null
  const cats = Array.isArray(r?.categories) ? r!.categories : []
  const out: LibraryCategory[] = []
  const ids = new Set<string>()
  for (const c of cats) {
    if (!c || typeof c !== 'object') continue
    const id = typeof c.id === 'string' && c.id && !ids.has(c.id) ? c.id.slice(0, 64) : rid()
    ids.add(id)
    out.push({
      id,
      name: String(c.name ?? 'Library').slice(0, 120) || 'Library',
      source: String(c.source ?? 'file'),
      installedAt: typeof c.installedAt === 'number' ? c.installedAt : 0,
      ...(c.collapsed ? { collapsed: true } : {}),
      items: (Array.isArray(c.items) ? c.items : []).map(cleanItem).filter((i): i is LibraryItem => !!i).slice(0, MAX_ITEMS_PER_LIBRARY),
    })
  }
  const personal = out.find((c) => c.id === PERSONAL_ID) ?? personalCategory()
  personal.source = 'personal'
  return { version: 1, categories: [personal, ...out.filter((c) => c.id !== PERSONAL_ID)] }
}

/** Searchable text of an item: its name plus any text drawn inside it. */
export function itemText(item: LibraryItem): string {
  const texts = (item.elements as Array<{ type?: string; text?: string }>).filter((e) => e.type === 'text' && e.text).map((e) => e.text)
  return [item.name ?? '', ...texts].join(' ')
}

/** Filters categories/items by a search string (library name, item name or text inside items). */
export function filterLibraries(data: LibraryData, query: string): LibraryCategory[] {
  const q = query.trim().toLowerCase()
  if (!q) return data.categories
  return data.categories
    .map((c) => (c.name.toLowerCase().includes(q) ? c : { ...c, items: c.items.filter((i) => itemText(i).toLowerCase().includes(q)) }))
    .filter((c) => c.items.length > 0)
}
