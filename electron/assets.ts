import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/** Custom URL scheme used to show stored images: notion-asset://local/<file>. */
export const ASSET_SCHEME = 'notion-asset'
export const ASSET_HOST = 'local'

/** Max size of a single pasted/dropped image. */
export const MAX_ASSET_BYTES = 25 * 1024 * 1024

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
}
const EXT_TO_MIME = Object.fromEntries(Object.entries(MIME_TO_EXT).map(([m, e]) => [e, m]))

/** Only names we generated ourselves are ever served or deleted. */
const NAME_PATTERN = /^[0-9a-f-]{36}\.(png|jpg|gif|webp|avif|bmp|svg)$/

/**
 * Stores images as files in `<userData>/assets/` so page JSON stays small.
 * Pages reference them as `notion-asset://local/<uuid>.<ext>`.
 */
export class AssetStorage {
  readonly dir: string

  constructor(root: string) {
    this.dir = path.join(root, 'assets')
  }

  async save(data: Uint8Array, mime: string): Promise<string> {
    const ext = MIME_TO_EXT[mime]
    if (!ext) throw new Error(`Unsupported image type: ${mime}`)
    if (!(data instanceof Uint8Array) || data.byteLength === 0) throw new Error('Empty image')
    if (data.byteLength > MAX_ASSET_BYTES) throw new Error('Image is larger than 25 MB')
    await fs.mkdir(this.dir, { recursive: true })
    const name = `${randomUUID()}.${ext}`
    await fs.writeFile(path.join(this.dir, name), data)
    return `${ASSET_SCHEME}://${ASSET_HOST}/${name}`
  }

  /** Reads one of our stored images by its notion-asset:// URL (null if missing or not ours). */
  async read(url: string): Promise<{ data: Uint8Array; mime: string } | null> {
    const hit = this.resolve(url)
    if (!hit) return null
    try {
      return { data: new Uint8Array(await fs.readFile(hit.file)), mime: hit.mime }
    } catch {
      return null
    }
  }

  /** Resolves a request URL to a file on disk, or null if it isn't one of ours. */
  resolve(url: string): { file: string; mime: string } | null {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return null
    }
    const name = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
    if (parsed.hostname !== ASSET_HOST || !NAME_PATTERN.test(name)) return null
    return { file: path.join(this.dir, name), mime: EXT_TO_MIME[name.split('.').pop()!] }
  }

  /**
   * Deletes stored images no page refers to anymore (e.g. the image was removed
   * or its page was deleted). Run at startup, when no undo history exists.
   * `referenced` comes from the page index; null means "not sure" and keeps everything.
   */
  async collectGarbage(referenced: Set<string> | null) {
    if (!referenced) return
    // Never touch images saved after cleanup started (their page may not be saved yet).
    const startedAt = Date.now() - 1000
    let names: string[]
    try {
      names = (await fs.readdir(this.dir)).filter((n) => NAME_PATTERN.test(n))
    } catch {
      return
    }
    if (names.length === 0) return
    await Promise.all(
      names
        .filter((n) => !referenced.has(n))
        .map(async (n) => {
          const file = path.join(this.dir, n)
          const stat = await fs.stat(file).catch(() => null)
          if (stat && stat.mtimeMs < startedAt) await fs.rm(file, { force: true })
        }),
    )
  }
}
