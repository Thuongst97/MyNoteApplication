import { beforeEach, describe, expect, it } from 'vitest'

// No window.electronAPI in jsdom → the localStorage fallback is used.
const { api, isElectron } = await import('@/lib/api')

describe('browser fallback API', () => {
  beforeEach(() => localStorage.clear())

  it('is used outside Electron', () => {
    expect(isElectron).toBe(false)
    expect(api.platform).toBe('browser')
  })

  it('saves, merges, lists and reads pages', async () => {
    await api.savePage({ id: 'a', title: 'Alpha', content: { type: 'doc' } })
    await api.savePage({ id: 'a', icon: '🚀' })
    const page = await api.readPage('a')
    expect(page).toMatchObject({ id: 'a', title: 'Alpha', icon: '🚀', kind: 'doc' })
    const tree = await api.getPageTree()
    expect(tree).toHaveLength(1)
    expect('content' in tree[0]).toBe(false)
  })

  it('deletes a page with its sub-pages and ignores late saves for them', async () => {
    await api.savePage({ id: 'p', title: 'Parent' })
    await api.savePage({ id: 'c', title: 'Child', parentId: 'p' })
    expect((await api.deletePage('p')).sort()).toEqual(['c', 'p'])
    expect(await api.savePage({ id: 'c', title: 'late' })).toBeNull()
    expect(await api.getPageTree()).toEqual([])
  })

  it('searches titles and content', async () => {
    await api.savePage({ id: 'a', title: 'Groceries', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'buy milk' }] }] } })
    expect(await api.searchPages('MILK')).toEqual([{ id: 'a', snippet: 'buy milk' }])
    expect(await api.searchPages('groc')).toEqual([{ id: 'a', snippet: null }])
    expect(await api.searchPages('  ')).toEqual([])
  })

  it('returns page links (ignoring self-links and missing pages)', async () => {
    await api.savePage({ id: 'b', title: 'B' })
    await api.savePage({
      id: 'a',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { pageId: 'b' } }, { type: 'mention', attrs: { pageId: 'a' } }, { type: 'mention', attrs: { pageId: 'zzz' } }] }] },
    })
    expect(await api.getLinks()).toEqual([{ source: 'a', target: 'b' }])
  })

  it('stores images as data URLs', async () => {
    const url = await api.saveAsset(new Uint8Array([137, 80, 78, 71]), 'image/png')
    expect(url).toBe('data:image/png;base64,iVBORw==')
  })

  it('stores tasks and settings', async () => {
    const t = await api.tasks.save({ id: 't1', title: 'Task', important: false })
    expect(t).toMatchObject({ id: 't1', important: false })
    expect(await api.tasks.list()).toHaveLength(1)
    expect((await api.tasks.setSettings({ defaultReminders: [60] })).defaultReminders).toEqual([60])
    expect((await api.tasks.getSettings()).defaultReminders).toEqual([60])
    await api.tasks.remove('t1')
    expect(await api.tasks.list()).toEqual([])
  })
})
