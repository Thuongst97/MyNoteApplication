import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '@/stores/useAppStore'
import { current, openPageFromClick, pruneTabs, resetTabs, useTabsStore } from '@/stores/useTabsStore'
import type { PageMeta } from '@/types'

const page = (id: string): PageMeta => ({ id, kind: 'doc', title: id.toUpperCase(), icon: null, cover: null, parentId: null, order: 0, createdAt: 0, updatedAt: 0 })
const tabs = () => useTabsStore.getState()
const app = () => useAppStore.getState()
const shown = () => (app().view === 'page' ? app().activePageId : app().view)
const places = () => tabs().tabs.map((t) => current(t))

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState({ pages: ['a', 'b', 'c', 'd'].map(page), activePageId: 'a', view: 'page', isLoaded: true })
  resetTabs()
})

describe('tabs', () => {
  it('records navigation in the active tab with back/forward', () => {
    app().setActivePage('b')
    app().setActivePage('c')
    expect(tabs().tabs[0].history).toEqual(['page:a', 'page:b', 'page:c'])
    tabs().back()
    expect(shown()).toBe('b')
    tabs().back()
    expect(shown()).toBe('a')
    tabs().back() // nothing further back
    expect(shown()).toBe('a')
    tabs().forward()
    expect(shown()).toBe('b')
    // Navigating from the middle drops the forward history.
    app().openTasks()
    expect(tabs().tabs[0].history).toEqual(['page:a', 'page:b', 'tasks'])
  })

  it('opens, switches, cycles, reorders and closes tabs', () => {
    tabs().openInNewTab('page:b')
    expect(places()).toEqual(['page:a', 'page:b'])
    expect(shown()).toBe('b')
    tabs().newTab()
    expect(places()).toEqual(['page:a', 'page:b', 'home'])
    expect(shown()).toBe('home')
    app().setActivePage('c') // navigates inside the new tab
    expect(places()).toEqual(['page:a', 'page:b', 'page:c'])
    tabs().switchTab(tabs().tabs[0].id)
    expect(shown()).toBe('a')
    expect(tabs().tabs[0].history).toEqual(['page:a']) // switching isn't navigation
    tabs().cycle(-1)
    expect(shown()).toBe('c')
    tabs().moveTab(tabs().tabs[2].id, 0)
    expect(places()).toEqual(['page:c', 'page:a', 'page:b'])
    tabs().closeTab(tabs().activeTabId) // closing the active tab shows its neighbour
    expect(places()).toEqual(['page:a', 'page:b'])
    expect(shown()).toBe('a')
    tabs().closeTab(tabs().tabs[1].id)
    tabs().closeTab(tabs().tabs[0].id) // the last tab becomes a new tab
    expect(places()).toEqual(['home'])
    expect(shown()).toBe('home')
  })

  it('opens pages from clicks: plain = this tab, Ctrl/⌘ = new tab, middle = background tab', () => {
    openPageFromClick('b', { ctrlKey: false })
    expect(places()).toEqual(['page:b'])
    openPageFromClick('c', { metaKey: true })
    expect(places()).toEqual(['page:b', 'page:c'])
    expect(shown()).toBe('c')
    openPageFromClick('d', { button: 1 })
    expect(places()).toEqual(['page:b', 'page:c', 'page:d'])
    expect(shown()).toBe('c') // stayed
  })

  it('drops deleted pages from tabs (closing tabs that only had them)', () => {
    app().setActivePage('b')
    tabs().openInNewTab('page:c')
    tabs().switchTab(tabs().tabs[0].id)
    expect(shown()).toBe('b')
    pruneTabs((id) => id !== 'b' && id !== 'c')
    expect(tabs().tabs).toHaveLength(1)
    expect(tabs().tabs[0].history).toEqual(['page:a'])
    expect(shown()).toBe('a')
  })

  it('saves open tabs', () => {
    tabs().openInNewTab('graph')
    const saved = JSON.parse(localStorage.getItem('premiumnote:tabs')!)
    expect(saved.tabs.map((t: { history: string[] }) => t.history.at(-1))).toEqual(['page:a', 'graph'])
    expect(saved.activeTabId).toBe(tabs().activeTabId)
  })
})
