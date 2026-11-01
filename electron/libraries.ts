import fs from 'node:fs/promises'
import path from 'node:path'
import {
  emptyLibraries,
  installLibrary,
  isAllowedLibraryUrl,
  libraryNameFrom,
  MAX_LIBRARY_BYTES,
  normalizeLibraries,
  parseLibraryFile,
  type LibraryData,
} from '../src/lib/libraries'

/** Drawing libraries, saved permanently in `<userData>/libraries.json`. */
export class LibraryStore {
  private readonly file: string
  private data: LibraryData | null = null
  private chain: Promise<unknown> = Promise.resolve()

  constructor(
    root: string,
    /** Download function (injectable for tests). */
    private readonly fetchText: (url: string) => Promise<string> = defaultFetch,
  ) {
    this.file = path.join(root, 'libraries.json')
  }

  async get(): Promise<LibraryData> {
    if (!this.data) {
      try {
        this.data = normalizeLibraries(JSON.parse(await fs.readFile(this.file, 'utf8')))
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') console.error('[libraries] could not read libraries.json:', err)
        this.data = emptyLibraries()
      }
    }
    return this.data
  }

  /** Replaces all library data (the renderer edits it: rename, delete, collapse, add items). */
  async save(next: unknown): Promise<LibraryData> {
    const data = normalizeLibraries(next)
    const json = JSON.stringify(data)
    if (json.length > 200 * 1024 * 1024) throw new Error('Libraries are too large to save.')
    this.data = data
    await this.write(json)
    return data
  }

  /** Downloads a library and saves it as a category. */
  async installFromUrl(url: string): Promise<{ data: LibraryData; categoryId: string }> {
    if (!isAllowedLibraryUrl(url)) throw new Error('Only https:// library links can be installed.')
    const items = parseLibraryFile(await this.fetchText(url))
    const r = installLibrary(await this.get(), url, items)
    await this.save(r.data)
    return { data: this.data!, categoryId: r.categoryId }
  }

  /** Imports an .excalidrawlib file from disk. */
  async importFile(filePath: string): Promise<{ data: LibraryData; categoryId: string }> {
    const stat = await fs.stat(filePath)
    if (stat.size > MAX_LIBRARY_BYTES) throw new Error('The library file is larger than 20 MB.')
    const items = parseLibraryFile(await fs.readFile(filePath, 'utf8'))
    const r = installLibrary(await this.get(), 'file', items, libraryNameFrom(path.basename(filePath)))
    await this.save(r.data)
    return { data: this.data!, categoryId: r.categoryId }
  }

  private write(json: string) {
    this.chain = this.chain.catch(() => undefined).then(async () => {
      const tmp = `${this.file}.${process.pid}.${Date.now()}.tmp`
      await fs.mkdir(path.dirname(this.file), { recursive: true })
      await fs.writeFile(tmp, json, 'utf8')
      await fs.rename(tmp, this.file)
    })
    return this.chain
  }
}

async function defaultFetch(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    if (!res.ok) throw new Error(`Download failed (${res.status}).`)
    const len = Number(res.headers.get('content-length') ?? 0)
    if (len > MAX_LIBRARY_BYTES) throw new Error('The library is larger than 20 MB.')
    const text = await res.text()
    if (text.length > MAX_LIBRARY_BYTES) throw new Error('The library is larger than 20 MB.')
    return text
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('The download timed out.')
    throw err
  } finally {
    clearTimeout(timer)
  }
}
