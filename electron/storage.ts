import fs from 'node:fs/promises'
import path from 'node:path'
import { docToText, makeSnippet } from '../src/lib/docText'
import { extractLinks } from '../src/lib/links'
import { normalizeWidth } from '../src/lib/pageWidth'
import { normalizeFont } from '../src/lib/pageFont'
import { cleanCover, cleanIcon, cleanPageMeta, cleanTitle } from '../src/lib/pageMeta'
import type { Page, PageLinkEdge, PageMeta, PageUpdate, SearchResult } from '../src/types'

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

function assertValidId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    throw new Error(`Invalid page id: ${String(id)}`)
  }
}

function toMeta(page: Page): PageMeta {
  const { content: _content, ...meta } = page
  return cleanPageMeta(meta)
}

/** Largest page file we'll write (protects the disk from runaway content). */
export const MAX_PAGE_BYTES = 100 * 1024 * 1024

/** Searchable text kept in memory per page (enough for any real note; caps runaway pages). */
export const MAX_SEARCH_TEXT = 200_000

/** Most search results returned (the search box shows the best ones; titles first). */
export const MAX_RESULTS = 100

/** A short excerpt around a match at `at` (only that part of the text is copied). */
function snippetAt(text: string, at: number, len: number): string {
  const start = Math.max(0, at - 50)
  const raw = text.slice(start, at + len + 70).replace(/\s+/g, ' ').trim()
  return makeSnippet(raw, text.slice(at, at + len)) ?? raw
}

/** Name of the startup index cache, stored next to the pages folder. */
export const INDEX_FILE = 'pages-index.json'
const INDEX_VERSION = 2
/** Files read/parsed at once during startup. */
const LOAD_CONCURRENCY = 16

interface IndexEntry {
  mtimeMs: number
  size: number
  meta: PageMeta
  links: string[]
  text: string
  /** Stored images the page uses (asset file names). */
  assets: string[]
}

const ASSET_REF = /notion-asset:\/\/local\/([0-9a-f-]{36}\.[a-z]+)/g

/** Asset file names referenced anywhere in a page's JSON. */
export function assetNames(json: string): string[] {
  const out = new Set<string>()
  for (const m of json.matchAll(ASSET_REF)) out.add(m[1])
  return [...out]
}

function searchText(content: unknown): string {
  return docToText(content as never).slice(0, MAX_SEARCH_TEXT)
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0
  const worker = async () => {
    while (next < items.length) await fn(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

/**
 * File-based page storage. Every page lives in `<root>/pages/<id>.json`.
 * Page metadata is cached in memory so the tree can be served without
 * re-reading every file. Writes for the same page are serialized and atomic
 * (write to a temp file, then rename), so a crash never leaves a half-written page.
 *
 * Memory/IO: page *content* is never kept in memory — it's read on demand when a
 * page is opened. Only metadata, outgoing links and the page's plain text (for
 * search) stay resident. A small index cache (`pages-index.json`, validated by
 * each file's mtime/size) lets startup skip parsing pages that haven't changed.
 */
export class PageStorage {
  private readonly dir: string
  private readonly indexFile: string
  private index = new Map<string, PageMeta>()
  /** Outgoing page links per page (kept up to date on save). */
  private links = new Map<string, string[]>()
  private loaded: Promise<void> | null = null
  private queues = new Map<string, Promise<unknown>>()
  /** Ids deleted during this session; late auto-saves must not resurrect them. */
  private tombstones = new Set<string>()
  /** Plain text per page, for search without reading files. */
  private texts = new Map<string, string>()
  /** mtime/size of each page file as last seen (validates the index cache). */
  private stats = new Map<string, { mtimeMs: number; size: number }>()
  /** Stored images each page uses (for image cleanup without reading every page). */
  private assetRefs = new Map<string, string[]>()
  /** A page file couldn't be read at startup: image cleanup must keep everything. */
  private unreadable = false
  private indexTimer: ReturnType<typeof setTimeout> | null = null
  private indexWrite: Promise<void> = Promise.resolve()

  constructor(root: string, private readonly indexDelay = 1500) {
    this.dir = path.join(root, 'pages')
    this.indexFile = path.join(root, INDEX_FILE)
  }

  private file(id: string) {
    return path.join(this.dir, `${id}.json`)
  }

  private ensureLoaded() {
    if (!this.loaded) this.loaded = this.load()
    return this.loaded
  }

  private async readIndexCache(): Promise<Map<string, IndexEntry>> {
    try {
      const raw = JSON.parse(await fs.readFile(this.indexFile, 'utf8'))
      if (raw?.version !== INDEX_VERSION || !raw.entries || typeof raw.entries !== 'object') return new Map()
      return new Map(Object.entries(raw.entries as Record<string, IndexEntry>))
    } catch {
      return new Map()
    }
  }

  private remember(id: string, meta: PageMeta, links: string[], text: string, stat: { mtimeMs: number; size: number }, assets: string[]) {
    this.index.set(id, meta)
    this.links.set(id, links)
    this.texts.set(id, text)
    this.stats.set(id, stat)
    this.assetRefs.set(id, assets)
  }

  private async load() {
    await fs.mkdir(this.dir, { recursive: true })
    const [entries, cache] = await Promise.all([fs.readdir(this.dir), this.readIndexCache()])
    let changed = false
    await mapLimit(
      entries.filter((n) => n.endsWith('.json')),
      LOAD_CONCURRENCY,
      async (name) => {
        const file = path.join(this.dir, name)
        try {
          const st = await fs.stat(file)
          const stat = { mtimeMs: st.mtimeMs, size: st.size }
          const hit = cache.get(name)
          if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size && hit.meta?.id) {
            this.remember(hit.meta.id, cleanPageMeta(hit.meta), Array.isArray(hit.links) ? hit.links : [], typeof hit.text === 'string' ? hit.text : '', stat, Array.isArray(hit.assets) ? hit.assets : [])
            return
          }
          changed = true
          const raw = await fs.readFile(file, 'utf8')
          const page = JSON.parse(raw) as Page
          if (page && typeof page.id === 'string') {
            this.remember(page.id, toMeta(page), extractLinks(page.content), searchText(page.content), stat, assetNames(raw))
          }
        } catch (err) {
          this.unreadable = true
          console.error(`[storage] Skipping unreadable page file ${name}:`, err)
        }
      },
    )
    if (changed || cache.size !== this.index.size) this.scheduleIndexWrite()
    // Re-parent orphans (parent deleted outside the app) to the root.
    for (const meta of this.index.values()) {
      if (meta.parentId && !this.index.has(meta.parentId)) meta.parentId = null
    }
  }

  private scheduleIndexWrite() {
    if (this.indexTimer) clearTimeout(this.indexTimer)
    this.indexTimer = setTimeout(() => void this.flushIndex(), this.indexDelay)
    this.indexTimer.unref?.()
  }

  /** Writes the startup index cache now (also called on quit). */
  flushIndex(): Promise<void> {
    if (this.indexTimer) {
      clearTimeout(this.indexTimer)
      this.indexTimer = null
    }
    this.indexWrite = this.indexWrite.then(async () => {
      const entries: Record<string, IndexEntry> = {}
      for (const [id, meta] of this.index) {
        const stat = this.stats.get(id)
        if (!stat) continue
        entries[`${id}.json`] = { ...stat, meta, links: this.links.get(id) ?? [], text: this.texts.get(id) ?? '', assets: this.assetRefs.get(id) ?? [] }
      }
      const tmp = `${this.indexFile}.${process.pid}.tmp`
      try {
        await fs.writeFile(tmp, JSON.stringify({ version: INDEX_VERSION, entries }), 'utf8')
        await fs.rename(tmp, this.indexFile)
      } catch (err) {
        await fs.rm(tmp, { force: true }).catch(() => undefined)
        // The data folder may be gone (e.g. removed while closing); the cache is optional.
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') console.error('[storage] Could not write the page index cache:', err)
      }
    })
    return this.indexWrite
  }

  /** Run `task` after any pending operation on the same page id. */
  private enqueue<T>(id: string, task: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(id) ?? Promise.resolve()
    const next = prev.catch(() => undefined).then(task)
    this.queues.set(id, next)
    void next.finally(() => {
      if (this.queues.get(id) === next) this.queues.delete(id)
    }).catch(() => undefined)
    return next
  }

  private async readFromDisk(id: string): Promise<Page | null> {
    try {
      return JSON.parse(await fs.readFile(this.file(id), 'utf8')) as Page
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  private async writeToDisk(page: Page) {
    const target = this.file(page.id)
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`
    const json = JSON.stringify(page)
    if (json.length > MAX_PAGE_BYTES) throw new Error('This page is too large to save (over 100 MB).')
    await fs.writeFile(tmp, json, 'utf8')
    await fs.rename(tmp, target)
    const st = await fs.stat(target)
    return { mtimeMs: st.mtimeMs, size: st.size, assets: assetNames(json) }
  }

  /**
   * Every stored image used by some page, from memory (no page files are read), or null
   * when that isn't known for sure (a page file couldn't be read) — then keep all images.
   */
  async referencedAssets(): Promise<Set<string> | null> {
    await this.ensureLoaded()
    if (this.unreadable) return null
    const out = new Set<string>()
    for (const names of this.assetRefs.values()) for (const n of names) out.add(n)
    return out
  }

  /** Paths of every page file. */
  async pageFiles(): Promise<string[]> {
    await this.ensureLoaded()
    return [...this.index.keys()].map((id) => this.file(id))
  }

  async getLinks(): Promise<PageLinkEdge[]> {
    await this.ensureLoaded()
    const edges: PageLinkEdge[] = []
    for (const [source, targets] of this.links) {
      for (const target of targets) if (target !== source && this.index.has(target)) edges.push({ source, target })
    }
    return edges
  }

  async getTree(): Promise<PageMeta[]> {
    await this.ensureLoaded()
    return [...this.index.values()].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
  }

  async read(id: string): Promise<Page | null> {
    assertValidId(id)
    await this.ensureLoaded()
    return this.enqueue(id, () => this.readFromDisk(id))
  }

  async save(update: PageUpdate): Promise<PageMeta | null> {
    assertValidId(update?.id)
    await this.ensureLoaded()
    if (update.parentId != null) assertValidId(update.parentId)

    return this.enqueue(update.id, async () => {
      if (this.tombstones.has(update.id)) return null
      if (update.parentId && this.tombstones.has(update.parentId)) return null
      const now = Date.now()
      // Content updates (every auto-save) build on the in-memory metadata, so the
      // page file isn't read and parsed again on each save. Metadata-only updates
      // need the stored content and read it from disk.
      const known = this.index.get(update.id)
      const existing: Page | null =
        update.content !== undefined && known ? { ...known, content: null } : await this.readFromDisk(update.id)
      const base: Page = existing ?? {
        id: update.id,
        kind: update.kind === 'whiteboard' ? 'whiteboard' : 'doc',
        title: '',
        icon: null,
        cover: null,
        parentId: null,
        order: now,
        createdAt: now,
        updatedAt: now,
        content: null,
      }
      const page: Page = {
        ...base,
        ...(update.title !== undefined && { title: cleanTitle(update.title) }),
        ...(update.icon !== undefined && { icon: cleanIcon(update.icon) }),
        ...(update.cover !== undefined && { cover: cleanCover(update.cover) }),
        ...(update.parentId !== undefined && { parentId: update.parentId }),
        ...(update.order !== undefined && Number.isFinite(Number(update.order)) && { order: Number(update.order) }),
        ...(update.width !== undefined && { width: normalizeWidth(update.width) }),
        ...(update.font !== undefined && { font: normalizeFont(update.font) }),
        ...(update.content !== undefined && { content: update.content && typeof update.content === 'object' ? update.content : null }),
        id: update.id,
        updatedAt: now,
      }
      const { assets, ...stat } = await this.writeToDisk(page)
      const meta = toMeta(page)
      this.index.set(page.id, meta)
      this.stats.set(page.id, stat)
      this.assetRefs.set(page.id, assets)
      if (update.content !== undefined || !this.links.has(page.id)) {
        this.links.set(page.id, extractLinks(page.content))
        this.texts.set(page.id, searchText(page.content))
      }
      this.scheduleIndexWrite()
      return meta
    })
  }

  /** Deletes a page and all of its descendants. Returns every deleted id. */
  async delete(id: string): Promise<string[]> {
    assertValidId(id)
    await this.ensureLoaded()

    const ids: string[] = []
    const collect = (parent: string) => {
      ids.push(parent)
      for (const meta of this.index.values()) if (meta.parentId === parent) collect(meta.id)
    }
    collect(id)
    ids.forEach((pid) => this.tombstones.add(pid))

    await Promise.all(
      ids.map((pid) =>
        this.enqueue(pid, async () => {
          await fs.rm(this.file(pid), { force: true })
          this.index.delete(pid)
          this.links.delete(pid)
          this.texts.delete(pid)
          this.stats.delete(pid)
          this.assetRefs.delete(pid)
        }),
      ),
    )
    this.scheduleIndexWrite()
    return ids
  }

  async search(query: string): Promise<SearchResult[]> {
    await this.ensureLoaded()
    const q = String(query ?? '').trim()
    if (!q) return []
    // In-memory: no page files are read. One case-insensitive scan per page (no lowercase
    // copies of every page's text), snippets only around the match, at most MAX_RESULTS.
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu')
    const titled: SearchResult[] = []
    const others: SearchResult[] = []
    for (const meta of this.index.values()) {
      const titleHit = re.test(meta.title)
      const text = this.texts.get(meta.id) ?? ''
      const at = text.search(re)
      if (!titleHit && at < 0) continue
      const hit = { id: meta.id, snippet: at < 0 ? null : snippetAt(text, at, q.length) }
      if (titleHit) titled.push(hit)
      else others.push(hit)
      if (titled.length >= MAX_RESULTS) break
    }
    return [...titled, ...others].slice(0, MAX_RESULTS)
  }
}
