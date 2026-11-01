// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { PageStorage } from '../../electron/storage'

let root: string
beforeEach(async () => (root = await fs.mkdtemp(path.join(os.tmpdir(), 'nc-pages-'))))
afterEach(async () => fs.rm(root, { recursive: true, force: true }))

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const doc = (...content: object[]) => ({ type: 'doc', content }) as never

describe('PageStorage', () => {
  it('creates, merges and reads pages from disk', async () => {
    const s = new PageStorage(root)
    const meta = await s.save({ id: 'a', title: 'Alpha', content: doc(para('hello')) })
    expect(meta).toMatchObject({ id: 'a', title: 'Alpha', kind: 'doc' })
    expect('content' in meta!).toBe(false)
    await s.save({ id: 'a', icon: '🚀' })
    const page = await s.read('a')
    expect(page).toMatchObject({ title: 'Alpha', icon: '🚀', content: doc(para('hello')) })
    const file = JSON.parse(await fs.readFile(path.join(root, 'pages', 'a.json'), 'utf8'))
    expect(file.icon).toBe('🚀')
  })

  it('stores a per-page width (normalised)', async () => {
    const s = new PageStorage(root)
    await s.save({ id: 'a', width: 1234 })
    expect((await s.read('a'))!.width).toBe(1230)
    await s.save({ id: 'a', width: 'full' })
    expect((await s.getTree())[0].width).toBe('full')
    await s.save({ id: 'a', width: 'huge' as never })
    expect((await s.read('a'))!.width).toBeNull()
    await s.save({ id: 'a', title: 'renamed' }) // other updates keep the width
    await s.save({ id: 'a', width: 700 })
    await s.save({ id: 'a', title: 'again' })
    expect((await new PageStorage(root).read('a'))!.width).toBe(700)
  })

  it('validates page fields and survives corrupted files', async () => {
    const s = new PageStorage(root)
    await s.save({ id: 'a', title: 'ok', icon: { evil: true } as never, cover: 'red; position:fixed', content: 'not a doc' as never })
    expect(await s.read('a')).toMatchObject({ title: 'ok', icon: null, cover: null, content: null })
    // a hand-edited/corrupted file with wrong types is cleaned when loaded
    await fs.writeFile(path.join(root, 'pages', 'b.json'), JSON.stringify({ id: 'b', title: 7, icon: [1], cover: {}, parentId: 9, order: 'x' }))
    const tree = await new PageStorage(root).getTree()
    expect(tree.find((p) => p.id === 'b')).toMatchObject({ title: '', icon: null, cover: null, parentId: null, order: 0 })
  })

  it('writes atomically (no temp files left behind)', async () => {
    const s = new PageStorage(root)
    await Promise.all(Array.from({ length: 20 }, (_, i) => s.save({ id: 'a', title: `v${i}` })))
    expect(await fs.readdir(path.join(root, 'pages'))).toEqual(['a.json'])
    expect((await s.read('a'))!.title).toBe('v19') // writes for one page run in order
  })

  it('loads existing pages on startup and re-parents orphans', async () => {
    await fs.mkdir(path.join(root, 'pages'))
    const base = { icon: null, cover: null, order: 1, createdAt: 1, updatedAt: 1, content: null }
    await fs.writeFile(path.join(root, 'pages', 'x.json'), JSON.stringify({ ...base, id: 'x', title: 'Orphan', parentId: 'missing' }))
    await fs.writeFile(path.join(root, 'pages', 'broken.json'), '{not json')
    const s = new PageStorage(root)
    const origError = console.error
    console.error = () => {}
    const tree = await s.getTree()
    console.error = origError
    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({ id: 'x', parentId: null, kind: 'doc' })
  })

  it('sorts the tree by order then creation time', async () => {
    const s = new PageStorage(root)
    await s.save({ id: 'b', order: 2 })
    await s.save({ id: 'a', order: 1 })
    expect((await s.getTree()).map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('deletes a page and all descendants, and ignores late saves to them', async () => {
    const s = new PageStorage(root)
    await s.save({ id: 'p' })
    await s.save({ id: 'c', parentId: 'p' })
    await s.save({ id: 'g', parentId: 'c' })
    await s.save({ id: 'other' })
    expect((await s.delete('p')).sort()).toEqual(['c', 'g', 'p'])
    expect(await s.save({ id: 'c', title: 'late autosave' })).toBeNull()
    expect(await s.save({ id: 'new', parentId: 'p' })).toBeNull()
    expect((await s.getTree()).map((p) => p.id)).toEqual(['other'])
    expect(await fs.readdir(path.join(root, 'pages'))).toEqual(['other.json'])
  })

  it('rejects invalid ids (no path traversal)', async () => {
    const s = new PageStorage(root)
    await expect(s.read('../secret')).rejects.toThrow(/Invalid page id/)
    await expect(s.save({ id: 'a/b' })).rejects.toThrow()
    await expect(s.save({ id: 'ok', parentId: '../x' })).rejects.toThrow()
    await expect(s.delete('')).rejects.toThrow()
  })

  it('returns null for missing pages', async () => {
    expect(await new PageStorage(root).read('nope')).toBeNull()
  })

  it('searches titles and content with snippets', async () => {
    const s = new PageStorage(root)
    await s.save({ id: 'a', title: 'Shopping', content: doc(para('Remember to buy oat milk')) })
    await s.save({ id: 'b', title: 'Milk facts', content: doc(para('nothing here')) })
    const r = await s.search('milk')
    expect(r).toEqual(
      expect.arrayContaining([
        { id: 'a', snippet: 'Remember to buy oat milk' },
        { id: 'b', snippet: null },
      ]),
    )
    expect(await s.search('')).toEqual([])
  })

  it('keeps a link index for backlinks and the graph', async () => {
    const s = new PageStorage(root)
    await s.save({ id: 'a', title: 'A' })
    await s.save({ id: 'b', title: 'B', content: doc({ type: 'paragraph', content: [{ type: 'mention', attrs: { pageId: 'a' } }] }) })
    await s.save({ id: 'w', kind: 'whiteboard', content: { type: 'whiteboard', scene: { elements: [{ link: 'notionclone://page/a' }] } } as never })
    expect(await s.getLinks()).toEqual(expect.arrayContaining([{ source: 'b', target: 'a' }, { source: 'w', target: 'a' }]))
    // Removing the link updates the index; the index also survives a restart.
    await s.save({ id: 'b', content: doc(para('no links')) })
    const again = new PageStorage(root)
    expect(await again.getLinks()).toEqual([{ source: 'w', target: 'a' }])
    expect((await again.getTree()).find((p) => p.id === 'w')!.kind).toBe('whiteboard')
    await again.delete('a')
    expect(await again.getLinks()).toEqual([])
  })

  it('lists page files for asset cleanup', async () => {
    const s = new PageStorage(root)
    await s.save({ id: 'a' })
    expect(await s.pageFiles()).toEqual([path.join(root, 'pages', 'a.json')])
  })
})
