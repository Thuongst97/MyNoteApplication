// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fetchLibraryText, LibraryStore } from '../../electron/libraries'

let root: string
beforeEach(async () => (root = await fs.mkdtemp(path.join(os.tmpdir(), 'nc-libs-'))))
afterEach(async () => fs.rm(root, { recursive: true, force: true }))

const lib = (names: string[]) =>
  JSON.stringify({ type: 'excalidrawlib', version: 2, libraryItems: names.map((n) => ({ id: n, name: n, elements: [{ id: `${n}-r`, type: 'rectangle', x: 0, y: 0 }] })) })

describe('LibraryStore', () => {
  it('starts with an empty personal library', async () => {
    const s = new LibraryStore(root)
    expect((await s.get()).categories).toEqual([expect.objectContaining({ id: 'personal', items: [] })])
  })

  it('downloads and saves libraries permanently (and updates on reinstall)', async () => {
    const fetchText = vi.fn(async () => lib(['Server', 'Database']))
    const s = new LibraryStore(root, fetchText)
    const url = 'https://libraries.excalidraw.com/libraries/x/software-architecture.excalidrawlib'
    const r = await s.installFromUrl(url)
    expect(fetchText).toHaveBeenCalledWith(url, {})
    expect(r.data.categories[1]).toMatchObject({ name: 'Software architecture', source: url })
    // survives a restart
    const again = new LibraryStore(root)
    expect((await again.get()).categories[1].items.map((i) => i.name)).toEqual(['Server', 'Database'])
    // reinstalling the same URL updates instead of duplicating
    fetchText.mockResolvedValueOnce(lib(['Server']))
    await s.installFromUrl(url)
    expect((await new LibraryStore(root).get()).categories).toHaveLength(2)
  })

  it('refuses unsafe URLs and broken downloads', async () => {
    const s = new LibraryStore(root, async () => 'garbage')
    await expect(s.installFromUrl('http://evil.com/x.excalidrawlib')).rejects.toThrow(/https/)
    await expect(s.installFromUrl('https://ok.com/x.excalidrawlib')).rejects.toThrow(/not a valid library/)
    expect((await s.get()).categories).toHaveLength(1)
  })

  it('imports library files', async () => {
    const file = path.join(root, 'cloud_icons.excalidrawlib')
    await fs.writeFile(file, lib(['Cloud']))
    const r = await new LibraryStore(root).importFile(file)
    expect(r.data.categories.find((c) => c.id === r.categoryId)).toMatchObject({ name: 'Cloud icons', source: 'file' })
  })

  it('saves edits (rename, delete, collapse) and normalises them', async () => {
    const s = new LibraryStore(root, async () => lib(['A']))
    const { data } = await s.installFromUrl('https://x.com/a.excalidrawlib')
    await s.save({ ...data, categories: [{ ...data.categories[1], name: 'Renamed', collapsed: true }] })
    const saved = await new LibraryStore(root).get()
    expect(saved.categories.map((c) => c.name)).toEqual(['Personal library', 'Renamed']) // personal is always kept
    expect(saved.categories[1].collapsed).toBe(true)
  })

  it('recovers from a corrupt file', async () => {
    await fs.writeFile(path.join(root, 'libraries.json'), '{oops')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await new LibraryStore(root).get()).categories).toHaveLength(1)
    spy.mockRestore()
  })
})

describe('fetchLibraryText (downloads)', () => {
  const body = (text: string, init: { url?: string; status?: number; length?: number } = {}) =>
    Object.defineProperty(new Response(text, { status: init.status ?? 200, headers: init.length ? { 'content-length': String(init.length) } : {} }), 'url', {
      value: init.url ?? 'https://libs.example/a.excalidrawlib',
    })

  it('downloads the text', async () => {
    const f = vi.fn(async () => body('{"ok":1}'))
    expect(await fetchLibraryText('https://libs.example/a.excalidrawlib', {}, f as never)).toBe('{"ok":1}')
    expect(f).toHaveBeenCalledWith('https://libs.example/a.excalidrawlib', expect.objectContaining({ credentials: 'omit' }))
  })

  it('refuses redirects to addresses that are not allowed', async () => {
    const f = async () => body('{}', { url: 'http://localhost:9200/_secret' })
    await expect(fetchLibraryText('https://libs.example/a', {}, f as never)).rejects.toThrow(/redirected/)
  })

  it('stops at 20 MB (declared or actual) and reports HTTP errors', async () => {
    await expect(fetchLibraryText('https://x.example/a', {}, (async () => body('x', { length: 30 * 1024 * 1024 })) as never)).rejects.toThrow(/20 MB/)
    const big = 'x'.repeat(21 * 1024 * 1024)
    await expect(fetchLibraryText('https://x.example/a', {}, (async () => body(big)) as never)).rejects.toThrow(/20 MB/)
    await expect(fetchLibraryText('https://x.example/a', {}, (async () => body('no', { status: 404 })) as never)).rejects.toThrow(/404/)
  })
})
