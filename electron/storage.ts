import fs from 'node:fs/promises'
import path from 'node:path'
import { docToText, makeSnippet } from '../src/lib/docText'
import type { Page, PageMeta, PageUpdate, SearchResult } from '../src/types'

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

function assertValidId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    throw new Error(`Invalid page id: ${String(id)}`)
  }
}

function toMeta(page: Page): PageMeta {
  const { content: _content, ...meta } = page
  return meta
}

/**
 * File-based page storage. Every page lives in `<root>/pages/<id>.json`.
 * Page metadata is cached in memory so the tree can be served without
 * re-reading every file. Writes for the same page are serialized and atomic
 * (write to a temp file, then rename), so a crash never leaves a half-written page.
 */
export class PageStorage {
  private readonly dir: string
  private index = new Map<string, PageMeta>()
  private loaded: Promise<void> | null = null
  private queues = new Map<string, Promise<unknown>>()
  /** Ids deleted during this session; late auto-saves must not resurrect them. */
  private tombstones = new Set<string>()

  constructor(root: string) {
    this.dir = path.join(root, 'pages')
  }

  private file(id: string) {
    return path.join(this.dir, `${id}.json`)
  }

  private ensureLoaded() {
    if (!this.loaded) this.loaded = this.load()
    return this.loaded
  }

  private async load() {
    await fs.mkdir(this.dir, { recursive: true })
    const entries = await fs.readdir(this.dir)
    for (const name of entries) {
      if (!name.endsWith('.json')) continue
      try {
        const raw = await fs.readFile(path.join(this.dir, name), 'utf8')
        const page = JSON.parse(raw) as Page
        if (page && typeof page.id === 'string') this.index.set(page.id, toMeta(page))
      } catch (err) {
        console.error(`[storage] Skipping unreadable page file ${name}:`, err)
      }
    }
    // Re-parent orphans (parent deleted outside the app) to the root.
    for (const meta of this.index.values()) {
      if (meta.parentId && !this.index.has(meta.parentId)) meta.parentId = null
    }
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
    await fs.writeFile(tmp, JSON.stringify(page), 'utf8')
    await fs.rename(tmp, target)
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
      const existing = await this.readFromDisk(update.id)
      const base: Page = existing ?? {
        id: update.id,
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
        ...(update.title !== undefined && { title: String(update.title) }),
        ...(update.icon !== undefined && { icon: update.icon }),
        ...(update.cover !== undefined && { cover: update.cover }),
        ...(update.parentId !== undefined && { parentId: update.parentId }),
        ...(update.order !== undefined && { order: Number(update.order) }),
        ...(update.content !== undefined && { content: update.content }),
        id: update.id,
        updatedAt: now,
      }
      await this.writeToDisk(page)
      const meta = toMeta(page)
      this.index.set(page.id, meta)
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
        }),
      ),
    )
    return ids
  }

  async search(query: string): Promise<SearchResult[]> {
    await this.ensureLoaded()
    const q = String(query ?? '').trim().toLowerCase()
    if (!q) return []
    const results: SearchResult[] = []
    for (const meta of this.index.values()) {
      const titleHit = meta.title.toLowerCase().includes(q)
      let snippet: string | null = null
      try {
        const page = await this.enqueue(meta.id, () => this.readFromDisk(meta.id))
        snippet = makeSnippet(docToText(page?.content), q)
      } catch {
        // ignore unreadable pages
      }
      if (titleHit || snippet) results.push({ id: meta.id, snippet })
    }
    return results
  }
}
