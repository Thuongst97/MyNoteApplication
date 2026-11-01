// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { INDEX_FILE, PageStorage } from '../../electron/storage'

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

  it('auto-saves content without re-reading the page file, keeping its metadata', async () => {
    const s = new PageStorage(root)
    await s.save({ id: 'a', title: 'Alpha', icon: '🚀', width: 900, content: doc(para('one')) })
    const created = (await s.getTree())[0].createdAt
    // If save() still parsed the file first, this corrupt file would make it fail.
    await fs.writeFile(path.join(root, 'pages', 'a.json'), '{ not json')
    await s.save({ id: 'a', content: doc(para('two')) })
    expect(await s.read('a')).toMatchObject({ title: 'Alpha', icon: '🚀', width: 900, createdAt: created, content: doc(para('two')) })
  })

  it('searches from memory and stays in sync with saves and deletes', async () => {
    const s = new PageStorage(root)
    await s.save({ id: 'a', title: 'Alpha', content: doc(para('the quick brown fox')) })
    await s.save({ id: 'b', title: 'Beta', content: doc(para('lazy dog')) })
    await fs.rm(path.join(root, 'pages', 'a.json')) // not read during search
    expect((await s.search('brown')).map((r) => r.id)).toEqual(['a'])
    await s.save({ id: 'b', content: doc(para('a brown dog')) })
    expect((await s.search('brown')).map((r) => r.id).sort()).toEqual(['a', 'b'])
    await s.save({ id: 'b', title: 'Renamed' }) // metadata-only update keeps the text
    expect((await s.search('brown dog'))[0]).toMatchObject({ id: 'b', snippet: 'a brown dog' })
    await s.delete('a')
    expect((await s.search('brown')).map((r) => r.id)).toEqual(['b'])
  })

  it('starts from the index cache for unchanged pages and re-reads changed ones', async () => {
    const s = new PageStorage(root, 10)
    await s.save({ id: 'a', title: 'Alpha', content: doc(para('alpha text')) })
    await s.save({ id: 'b', title: 'Beta', content: doc(para('beta text')) })
    await s.save({ id: 'gone', title: 'Gone' })
    await s.flushIndex()
    const cache = JSON.parse(await fs.readFile(path.join(root, INDEX_FILE), 'utf8'))
    expect(Object.keys(cache.entries).sort()).toEqual(['a.json', 'b.json', 'gone.json'])

    // Mark the cached title so we can tell which source was used.
    cache.entries['a.json'].meta.title = 'From cache'
    await fs.writeFile(path.join(root, INDEX_FILE), JSON.stringify(cache))
    // b changes outside the app (different size), 'gone' is removed.
    await fs.writeFile(path.join(root, 'pages', 'b.json'), JSON.stringify({ id: 'b', title: 'Beta edited elsewhere', content: doc(para('new words')) }))
    await fs.rm(path.join(root, 'pages', 'gone.json'))

    const fresh = new PageStorage(root, 10)
    const tree = await fresh.getTree()
    expect(tree.map((p) => p.title).sort()).toEqual(['Beta edited elsewhere', 'From cache'])
    expect((await fresh.search('new words'))[0]?.id).toBe('b')
    expect((await fresh.search('alpha text'))[0]?.id).toBe('a')
    // A broken cache is ignored.
    await fs.writeFile(path.join(root, INDEX_FILE), '{oops')
    expect((await new PageStorage(root).getTree()).map((p) => p.title).sort()).toEqual(['Alpha', 'Beta edited elsewhere'])
  })

  it('loads many pages quickly and searches them without touching the disk', async () => {
    const s = new PageStorage(root)
    const body = doc(...Array.from({ length: 40 }, (_, i) => para(`paragraph ${i} lorem ipsum dolor sit amet`)))
    await Promise.all(Array.from({ length: 300 }, (_, i) => s.save({ id: `p${i}`, title: `Page ${i}`, content: i === 123 ? doc(para('needle here')) : body })))
    await s.flushIndex()
    const t0 = performance.now()
    const fresh = new PageStorage(root)
    expect(await fresh.getTree()).toHaveLength(300)
    const t1 = performance.now()
    expect((await fresh.search('needle')).map((r) => r.id)).toEqual(['p123'])
    const t2 = performance.now()
    expect(t1 - t0).toBeLessThan(2000)
    expect(t2 - t1).toBeLessThan(100)
  })
})
