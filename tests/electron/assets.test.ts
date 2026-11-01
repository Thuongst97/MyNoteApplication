// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { AssetStorage, MAX_ASSET_BYTES } from '../../electron/assets'

let root: string
beforeEach(async () => (root = await fs.mkdtemp(path.join(os.tmpdir(), 'nc-assets-'))))
afterEach(async () => fs.rm(root, { recursive: true, force: true }))

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

describe('AssetStorage', () => {
  it('saves images and resolves their URLs', async () => {
    const a = new AssetStorage(root)
    const url = await a.save(png, 'image/png')
    expect(url).toMatch(/^notion-asset:\/\/local\/[0-9a-f-]{36}\.png$/)
    const hit = a.resolve(url)!
    expect(hit.mime).toBe('image/png')
    expect(await fs.readFile(hit.file)).toEqual(Buffer.from(png))
  })

  it('rejects unsupported types, empty and oversized files', async () => {
    const a = new AssetStorage(root)
    await expect(a.save(png, 'text/html')).rejects.toThrow(/Unsupported/)
    await expect(a.save(new Uint8Array(0), 'image/png')).rejects.toThrow(/Empty/)
    await expect(a.save(new Uint8Array(MAX_ASSET_BYTES + 1), 'image/png')).rejects.toThrow(/25 MB/)
  })

  it('never resolves paths outside the assets folder or names it did not create', () => {
    const a = new AssetStorage(root)
    for (const url of [
      'notion-asset://local/../pages/x.json',
      'notion-asset://local/%2e%2e%2fpages%2fx.json',
      'notion-asset://other/16b5ae3b-47c9-48d3-b2ae-77b9b041233a.png',
      'notion-asset://local/16b5ae3b-47c9-48d3-b2ae-77b9b041233a.exe',
      'not a url',
    ])
      expect(a.resolve(url)).toBeNull()
  })

  it('cleans up images no page uses, keeping referenced and brand-new ones', async () => {
    const a = new AssetStorage(root)
    const used = await a.save(png, 'image/png')
    const unused = await a.save(png, 'image/jpeg')
    // Make both look old.
    const old = new Date(Date.now() - 60_000)
    for (const u of [used, unused]) await fs.utimes(a.resolve(u)!.file, old, old)
    const fresh = await a.save(png, 'image/gif') // saved "just now"
    await a.collectGarbage(new Set([path.basename(used)]))
    const left = await fs.readdir(a.dir)
    expect(left).toContain(path.basename(used))
    expect(left).toContain(path.basename(fresh))
    expect(left).not.toContain(path.basename(unused))
  })

  it('keeps everything when the used images are not known for sure', async () => {
    const a = new AssetStorage(root)
    const url = await a.save(png, 'image/png')
    const old = new Date(Date.now() - 60_000)
    await fs.utimes(a.resolve(url)!.file, old, old)
    await a.collectGarbage(null)
    expect(await fs.readdir(a.dir)).toHaveLength(1)
  })
})
