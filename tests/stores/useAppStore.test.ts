import { beforeEach, describe, expect, it, vi } from 'vitest'
import { selectChildren, useAppStore } from '@/stores/useAppStore'
import { autoSaver } from '@/lib/autoSave'
import { api } from '@/lib/api'

const initial = useAppStore.getState()
beforeEach(() => {
  localStorage.clear()
  useAppStore.setState({ ...initial, pages: [], activePageId: null, expanded: {}, view: 'page', toast: null }, true)
})

const s = () => useAppStore.getState()

describe('useAppStore', () => {
  it('creates a "Getting Started" page on first launch', async () => {
    await s().loadPages()
    expect(s().pages).toHaveLength(1)
    expect(s().pages[0].title).toBe('Getting Started')
    expect(s().activePageId).toBe(s().pages[0].id)
    expect((await api.readPage(s().pages[0].id))!.content).toMatchObject({ type: 'doc' })
  })

  it('creates pages and sub-pages, opening them and expanding the parent', async () => {
    const parent = await s().createPage(null, { title: 'Parent' })
    const child = await s().createPage(parent, { title: 'Child' })
    expect(s().activePageId).toBe(child)
    expect(s().expanded[parent]).toBe(true)
    expect(s().focusTitleFor).toBe(child)
    expect(selectChildren(s().pages, parent).map((p) => p.id)).toEqual([child])
    expect((await api.readPage(child))!.parentId).toBe(parent)
  })

  it('can create a page without leaving the current one', async () => {
    const a = await s().createPage(null, { title: 'A' })
    await s().createPage(null, { title: 'B', navigate: false })
    expect(s().activePageId).toBe(a)
  })

  it('creates presentations with a title slide named after the page', async () => {
    const id = await s().createPage(null, { kind: 'slides', title: 'Roadmap' })
    expect(s().pages.find((p) => p.id === id)!.kind).toBe('slides')
    const c = (await api.readPage(id))!.content as { type: string; slides: Array<{ layout: string }> }
    expect(c.type).toBe('slides')
    expect(c.slides.map((x) => x.layout)).toEqual(['title', 'content'])
    expect(JSON.stringify(c.slides[0])).toContain('Roadmap')
    // The placeholder name isn't put on the slide.
    const id2 = await s().createPage(null, { kind: 'slides', title: 'Untitled presentation' })
    expect(JSON.stringify((await api.readPage(id2))!.content)).not.toContain('Untitled')
  })

  it('creates whiteboards with an empty canvas', async () => {
    const id = await s().createPage(null, { kind: 'whiteboard' })
    expect(s().pages.find((p) => p.id === id)!.kind).toBe('whiteboard')
    expect((await api.readPage(id))!.content).toEqual({ type: 'whiteboard', scene: { elements: [], files: {} } })
  })

  it('navigating saves the page being left, expands ancestors and can target a block', async () => {
    const a = await s().createPage(null)
    const b = await s().createPage(a)
    const c = await s().createPage(b)
    useAppStore.setState({ expanded: {} })
    const flush = vi.spyOn(autoSaver, 'flush')
    s().setActivePage(a)
    s().setActivePage(c, { blockId: 'blk' })
    expect(flush).toHaveBeenCalledWith(a)
    expect(s().expanded).toEqual({ [a]: true, [b]: true })
    expect(s().highlightBlockId).toBe('blk')
    expect(s().view).toBe('page')
  })

  it('updates page metadata and schedules an auto-save', async () => {
    const id = await s().createPage(null)
    const schedule = vi.spyOn(autoSaver, 'schedule')
    s().updatePageMeta(id, { title: 'Renamed', icon: '🔥' })
    expect(s().pages[0]).toMatchObject({ title: 'Renamed', icon: '🔥' })
    expect(schedule).toHaveBeenCalledWith({ id, title: 'Renamed', icon: '🔥' })
  })

  it('deletes a page with its sub-pages and opens the parent', async () => {
    const root = await s().createPage(null, { title: 'Root' })
    const mid = await s().createPage(root)
    await s().createPage(mid)
    s().setActivePage(mid)
    const cancel = vi.spyOn(autoSaver, 'cancel')
    await s().deletePage(mid)
    expect(s().pages.map((p) => p.id)).toEqual([root])
    expect(s().activePageId).toBe(root)
    expect(cancel).toHaveBeenCalledTimes(2)
    expect((await api.getPageTree()).map((p) => p.id)).toEqual([root])
  })

  it('switches views', () => {
    s().openTasks('task-1')
    expect(s()).toMatchObject({ view: 'tasks', highlightTaskId: 'task-1' })
    s().openGraph()
    expect(s().view).toBe('graph')
  })

  it('toggles UI preferences and persists them', () => {
    const theme = s().theme
    s().toggleTheme()
    s().toggleSidebar()
    s().setSidebarWidth(9999)
    expect(s().theme).not.toBe(theme)
    expect(s().isSidebarOpen).toBe(false)
    expect(s().sidebarWidth).toBe(480)
    s().setSidebarWidth(10)
    expect(s().sidebarWidth).toBe(200)
    expect(JSON.parse(localStorage.getItem('notion-clone:prefs')!)).toMatchObject({ isSidebarOpen: false, sidebarWidth: 200 })
  })

  it('shows toasts that disappear on their own', () => {
    vi.useFakeTimers()
    s().showToast('Copied')
    expect(s().toast?.message).toBe('Copied')
    vi.advanceTimersByTime(2500)
    expect(s().toast).toBeNull()
    vi.useRealTimers()
  })

  it('opens and closes search', () => {
    s().setSearchOpen(true)
    expect(s().isSearchOpen).toBe(true)
  })
})
