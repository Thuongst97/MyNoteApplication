// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { PageStorage } from '../../electron/storage'
import { AssetStorage } from '../../electron/assets'
import { exportPages, fileNameFor, importPages, parseBundle, PAGE_FILE_FORMAT } from '../../electron/pageTransfer'

let a: string
let b: string
beforeEach(async () => {
  a = await fs.mkdtemp(path.join(os.tmpdir(), 'nc-export-'))
  b = await fs.mkdtemp(path.join(os.tmpdir(), 'nc-import-'))
})
afterEach(async () => {
  await fs.rm(a, { recursive: true, force: true })
  await fs.rm(b, { recursive: true, force: true })
})

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

async function sampleWorkspace() {
  const storage = new PageStorage(a)
  const assets = new AssetStorage(a)
  const img = await assets.save(PNG, 'image/png')
  const [root, child, grandchild, other] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()]
  await storage.save({ id: other, title: 'Not exported' })
  await storage.save({
    id: root,
    title: 'Trip plan',
    icon: '✈️',
    content: {
      type: 'doc',
      content: [
        para('Overview'),
        { type: 'image', attrs: { src: img } },
        { type: 'pageLink', attrs: { pageId: child } },
        { type: 'paragraph', content: [{ type: 'mention', attrs: { pageId: grandchild, blockId: 'b1', label: 'Hotel' } }] },
        { type: 'pageLink', attrs: { pageId: other } },
      ],
    } as never,
  })
  await storage.save({ id: child, parentId: root, title: 'Day 1', content: { type: 'doc', content: [para('Museum')] } as never })
  await storage.save({ id: grandchild, parentId: child, kind: 'whiteboard', title: 'Map', content: { type: 'doc', content: [] } as never })
  return { storage, assets, img, root, child, grandchild, other }
}

describe('page files', () => {
  it('exports a page with its sub-pages and embedded images', async () => {
    const w = await sampleWorkspace()
    const bundle = await exportPages(w.storage, w.assets, w.root, true)
    expect(bundle.format).toBe(PAGE_FILE_FORMAT)
    expect(bundle.pages.map((p) => p.title)).toEqual(['Trip plan', 'Day 1', 'Map'])
    expect(bundle.pages[0].parentId).toBeNull()
    expect(Object.keys(bundle.assets)).toEqual([w.img])
    expect(Buffer.from(bundle.assets[w.img].data, 'base64')).toEqual(Buffer.from(PNG))
    const only = await exportPages(w.storage, w.assets, w.root, false)
    expect(only.pages).toHaveLength(1)
  })

  it('imports into another workspace with new ids, working links and images', async () => {
    const w = await sampleWorkspace()
    const text = JSON.stringify(await exportPages(w.storage, w.assets, w.root, true))

    const storage = new PageStorage(b)
    const assets = new AssetStorage(b)
    const target = randomUUID()
    await storage.save({ id: target, title: 'Inbox' })
    const r = await importPages(storage, assets, parseBundle(text), target)
    expect(r.count).toBe(3)
    expect(r.skippedImages).toBe(0)

    const tree = await storage.getTree()
    const imported = await storage.read(r.rootId)
    expect(imported).toMatchObject({ title: 'Trip plan', icon: '✈️', parentId: target })
    const day1 = tree.find((p) => p.title === 'Day 1')!
    const map = tree.find((p) => p.title === 'Map')!
    expect(day1.parentId).toBe(r.rootId)
    expect(map).toMatchObject({ parentId: day1.id, kind: 'whiteboard' })
    // New ids, links point to the imported copies.
    for (const id of [r.rootId, day1.id, map.id]) expect([w.root, w.child, w.grandchild]).not.toContain(id)
    const content = JSON.stringify(imported!.content)
    expect(content).toContain(day1.id)
    expect(content).toContain(map.id)
    // A link to a page that wasn't exported stays as it was (it simply won't resolve).
    expect(content).toContain(w.other)
    // The image was stored again in the new workspace.
    const src = (imported!.content as { content: Array<{ type: string; attrs?: { src?: string } }> }).content.find((n) => n.type === 'image')!.attrs!.src!
    expect(src).not.toBe(w.img)
    expect((await assets.read(src))!.data).toEqual(PNG)
    // Importing the same file twice gives two independent copies.
    const again = await importPages(storage, assets, parseBundle(text), null)
    expect(again.rootId).not.toBe(r.rootId)
  })

  it('rejects files that are not page files or are damaged', () => {
    expect(() => parseBundle('not json')).toThrow(/not a PremiumNote page file/)
    expect(() => parseBundle(JSON.stringify({ format: 'other' }))).toThrow(/not a PremiumNote page file/)
    expect(() => parseBundle(JSON.stringify({ format: PAGE_FILE_FORMAT, version: 99, pages: [{}] }))).toThrow(/newer version/)
    expect(() => parseBundle(JSON.stringify({ format: PAGE_FILE_FORMAT, version: 1, pages: [] }))).toThrow(/no pages/)
    // Short ids would make id remapping unsafe; duplicates are damage.
    expect(() => parseBundle(JSON.stringify({ format: PAGE_FILE_FORMAT, version: 1, pages: [{ id: 'a' }] }))).toThrow(/bad page id/)
    const id = randomUUID()
    expect(() => parseBundle(JSON.stringify({ format: PAGE_FILE_FORMAT, version: 1, pages: [{ id }, { id }] }))).toThrow(/bad page id/)
  })

  it('skips images that are not real images instead of failing the import', async () => {
    const storage = new PageStorage(b)
    const assets = new AssetStorage(b)
    const id = randomUUID()
    const bad = `notion-asset://local/${randomUUID()}.png`
    const bundle = parseBundle(
      JSON.stringify({
        format: PAGE_FILE_FORMAT,
        version: 1,
        pages: [{ id, title: '<b>x</b>', content: { type: 'doc', content: [] } }],
        assets: { [bad]: { mime: 'text/html', data: Buffer.from('<script>').toString('base64') }, 'file:///etc/passwd': { mime: 'image/png', data: '' } },
      }),
    )
    const r = await importPages(storage, assets, bundle, null)
    expect(r.count).toBe(1)
    expect(r.skippedImages).toBe(2)
  })

  it('makes safe file names', () => {
    expect(fileNameFor('Plan: Q3/Q4 <draft>?', 'ncpage')).toBe('Plan Q3 Q4 draft.ncpage')
    expect(fileNameFor('', 'ncpage')).toBe('Untitled.ncpage')
  })
})
