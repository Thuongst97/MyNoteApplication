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
  type UrlPolicy,
} from '../src/lib/libraries'

/** Drawing libraries, saved permanently in `<userData>/libraries.json`. */
export class LibraryStore {
  private readonly file: string
  private data: LibraryData | null = null
  private chain: Promise<unknown> = Promise.resolve()

  constructor(
    root: string,
    /** Download function (injectable for tests). */
    private readonly fetchText: (url: string, policy: UrlPolicy) => Promise<string> = (url, policy) => fetchLibraryText(url, policy),
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
  async installFromUrl(url: string, policy: UrlPolicy = {}): Promise<{ data: LibraryData; categoryId: string }> {
    if (!isAllowedLibraryUrl(url, policy)) throw new Error('Only https:// library links can be installed.')
    const items = parseLibraryFile(await this.fetchText(url, policy))
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

/**
 * Downloads a library as text: https only (checked again after redirects), stops as soon
 * as the size limit is passed, and times out after 30 seconds.
 */
export async function fetchLibraryText(url: string, policy: UrlPolicy = {}, fetchImpl: typeof fetch = fetch): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const res = await fetchImpl(url, { signal: controller.signal, redirect: 'follow', credentials: 'omit' })
    if (res.url && !isAllowedLibraryUrl(res.url, policy)) throw new Error('The library link redirected to an address that is not allowed.')
    if (!res.ok) throw new Error(`Download failed (${res.status}).`)
    if (Number(res.headers.get('content-length') ?? 0) > MAX_LIBRARY_BYTES) throw new Error('The library is larger than 20 MB.')
    if (!res.body) return ''
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_LIBRARY_BYTES) {
        await reader.cancel().catch(() => undefined)
        throw new Error('The library is larger than 20 MB.')
      }
      chunks.push(value)
    }
    return new TextDecoder().decode(Buffer.concat(chunks))
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('The download timed out.')
    throw err
  } finally {
    clearTimeout(timer)
  }
}
