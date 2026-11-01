import { create } from 'zustand'
import { useAppStore } from './useAppStore'
import { newId } from '@/lib/utils'

/**
 * Browser-like tabs. Each tab has its own back/forward history of places
 * ("page:<id>", "tasks", "graph", "home" = the new-tab page). The app store still
 * says what is on screen; this store follows it (navigation updates the active tab)
 * and drives it (switching tabs or going back shows that tab's place).
 */

export type TabTarget = `page:${string}` | 'tasks' | 'graph' | 'home'

export interface Tab {
  id: string
  history: TabTarget[]
  index: number
}

const KEY = 'premiumnote:tabs'
const MAX_HISTORY = 50
const MAX_TABS = 30

interface TabsState {
  tabs: Tab[]
  activeTabId: string
  /** Show a tab's current place. */
  switchTab: (id: string) => void
  /** Opens `target` in a new tab after the active one (shown unless `background`). */
  openInNewTab: (target: TabTarget, opts?: { background?: boolean }) => void
  newTab: () => void
  closeTab: (id: string) => void
  /** Moves a tab to position `to` (drag & drop). */
  moveTab: (id: string, to: number) => void
  back: () => void
  forward: () => void
  /** Next/previous tab (Ctrl+Tab / Ctrl+Shift+Tab). */
  cycle: (dir: 1 | -1) => void
}

export const current = (t: Tab): TabTarget => t.history[t.index] ?? 'home'

/** What the app shows right now, as a tab place. */
export function appTarget(): TabTarget {
  const s = useAppStore.getState()
  if (s.view === 'tasks' || s.view === 'graph' || s.view === 'home') return s.view
  return s.activePageId ? `page:${s.activePageId}` : 'home'
}

const isTarget = (v: unknown): v is TabTarget => typeof v === 'string' && (v === 'tasks' || v === 'graph' || v === 'home' || /^page:[A-Za-z0-9_-]{1,64}$/.test(v))

function load(): { tabs: Tab[]; activeTabId: string } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    const tabs: Tab[] = (Array.isArray(raw?.tabs) ? raw.tabs : [])
      .map((t: Partial<Tab>) => {
        const history = (Array.isArray(t.history) ? t.history : []).filter(isTarget).slice(-MAX_HISTORY)
        const index = Math.min(Math.max(0, Number(t.index) || 0), history.length - 1)
        return typeof t.id === 'string' && history.length ? { id: t.id, history, index } : null
      })
      .filter(Boolean)
      .slice(0, MAX_TABS)
    if (!tabs.length) return null
    const activeTabId = tabs.some((t) => t.id === raw.activeTabId) ? raw.activeTabId : tabs[0].id
    return { tabs, activeTabId }
  } catch {
    return null
  }
}

/** True while a tab action is changing the app's view (so it isn't recorded as navigation). */
let applying = false

/** Shows `target` in the app without recording it as a new navigation. */
function show(target: TabTarget) {
  applying = true
  try {
    const app = useAppStore.getState()
    if (target === 'tasks') app.openTasks()
    else if (target === 'graph') app.openGraph()
    else if (target === 'home') app.openHome()
    else app.setActivePage(target.slice(5))
  } finally {
    applying = false
  }
}

const freshTab = (target: TabTarget): Tab => ({ id: newId(), history: [target], index: 0 })

const stored = load()
/** Tabs came from a previous session (restore their places once pages are loaded). */
let restored = !!stored
const initial = stored ?? (() => {
  const t = freshTab(appTarget())
  return { tabs: [t], activeTabId: t.id }
})()

export const useTabsStore = create<TabsState>((set, get) => {
  const activeTab = () => get().tabs.find((t) => t.id === get().activeTabId) ?? get().tabs[0]
  const updateTab = (id: string, patch: (t: Tab) => Tab) => set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? patch(t) : t)) }))

  return {
    ...initial,

    switchTab: (id) => {
      const tab = get().tabs.find((t) => t.id === id)
      if (!tab) return
      set({ activeTabId: id })
      show(current(tab))
    },

    openInNewTab: (target, opts) => {
      const { tabs } = get()
      if (tabs.length >= MAX_TABS) {
        // Too many tabs: reuse the active one.
        show(target)
        return
      }
      const tab = freshTab(target)
      const at = tabs.findIndex((t) => t.id === get().activeTabId) + 1
      set({ tabs: [...tabs.slice(0, at), tab, ...tabs.slice(at)] })
      if (!opts?.background) get().switchTab(tab.id)
    },

    newTab: () => get().openInNewTab('home'),

    closeTab: (id) => {
      const { tabs, activeTabId } = get()
      const i = tabs.findIndex((t) => t.id === id)
      if (i < 0) return
      const rest = tabs.filter((t) => t.id !== id)
      if (!rest.length) {
        // Never zero tabs: the last one becomes a new tab.
        const t = freshTab('home')
        set({ tabs: [t], activeTabId: t.id })
        show('home')
        return
      }
      set({ tabs: rest })
      if (id === activeTabId) get().switchTab((rest[i] ?? rest[i - 1]).id)
    },

    moveTab: (id, to) => {
      const tabs = [...get().tabs]
      const from = tabs.findIndex((t) => t.id === id)
      if (from < 0) return
      const [tab] = tabs.splice(from, 1)
      tabs.splice(Math.max(0, Math.min(tabs.length, to)), 0, tab)
      set({ tabs })
    },

    back: () => {
      const tab = activeTab()
      if (!tab || tab.index === 0) return
      updateTab(tab.id, (t) => ({ ...t, index: t.index - 1 }))
      show(tab.history[tab.index - 1])
    },

    forward: () => {
      const tab = activeTab()
      if (!tab || tab.index >= tab.history.length - 1) return
      updateTab(tab.id, (t) => ({ ...t, index: t.index + 1 }))
      show(tab.history[tab.index + 1])
    },

    cycle: (dir) => {
      const { tabs, activeTabId } = get()
      if (tabs.length < 2) return
      const i = tabs.findIndex((t) => t.id === activeTabId)
      get().switchTab(tabs[(i + dir + tabs.length) % tabs.length].id)
    },
  }
})

/** Records a navigation in the active tab (anything that changed what's on screen). */
function record(target: TabTarget) {
  const s = useTabsStore.getState()
  const tab = s.tabs.find((t) => t.id === s.activeTabId)
  if (!tab || current(tab) === target) return
  const history = [...tab.history.slice(0, tab.index + 1), target].slice(-MAX_HISTORY)
  useTabsStore.setState({ tabs: s.tabs.map((t) => (t.id === tab.id ? { ...t, history, index: history.length - 1 } : t)) })
}

/** Removes deleted pages from every tab (tabs left with nothing are closed). */
export function pruneTabs(exists: (pageId: string) => boolean) {
  const s = useTabsStore.getState()
  let changed = false
  const tabs: Tab[] = []
  for (const t of s.tabs) {
    const keep = (x: TabTarget) => !x.startsWith('page:') || exists(x.slice(5))
    if (t.history.every(keep)) {
      tabs.push(t)
      continue
    }
    changed = true
    const before = t.history.slice(0, t.index + 1).filter(keep)
    const after = t.history.slice(t.index + 1).filter(keep)
    const history = [...before, ...after]
    if (history.length) tabs.push({ ...t, history, index: Math.max(0, before.length - 1) })
  }
  if (!changed) return
  if (!tabs.length) tabs.push(freshTab('home'))
  const activeTabId = tabs.some((t) => t.id === s.activeTabId) ? s.activeTabId : tabs[0].id
  useTabsStore.setState({ tabs, activeTabId })
  const active = tabs.find((t) => t.id === activeTabId)!
  if (current(active) !== appTarget()) show(current(active))
}

// Follow navigation (sidebar, links, search…) in the active tab.
let lastTarget = appTarget()
useAppStore.subscribe((s, prev) => {
  if (s.pages !== prev.pages && s.isLoaded && s.pages.length < prev.pages.length) {
    const ids = new Set(s.pages.map((p) => p.id))
    pruneTabs((id) => ids.has(id))
  }
  if (s.isLoaded && !prev.isLoaded) {
    const ids = new Set(s.pages.map((p) => p.id))
    pruneTabs((id) => ids.has(id))
    const st = useTabsStore.getState()
    const tab = st.tabs.find((t) => t.id === st.activeTabId)
    if (restored) {
      // Restore the active tab's place after a restart.
      if (tab && current(tab) !== appTarget()) show(current(tab))
    } else if (tab) {
      // First run: the tab shows whatever the app opened (e.g. Getting Started).
      useTabsStore.setState({ tabs: st.tabs.map((t) => (t.id === tab.id ? { ...t, history: [appTarget()], index: 0 } : t)) })
    }
    lastTarget = appTarget()
    return
  }
  const target = appTarget()
  if (target === lastTarget) return
  lastTarget = target
  if (!applying && s.isLoaded) record(target)
})

// Remember open tabs.
let saved = ''
useTabsStore.subscribe((s) => {
  const json = JSON.stringify({ tabs: s.tabs, activeTabId: s.activeTabId })
  if (json === saved) return
  saved = json
  try {
    localStorage.setItem(KEY, json)
  } catch {
    // ignore
  }
})

/**
 * Opens a page from a click: Ctrl/⌘+click opens it in a new tab, middle-click in a
 * background tab, a plain click in the current tab.
 */
export function openPageFromClick(pageId: string, e?: { ctrlKey?: boolean; metaKey?: boolean; button?: number } | null, opts?: { blockId?: string | null }) {
  if (e && e.button === 1) return useTabsStore.getState().openInNewTab(`page:${pageId}`, { background: true })
  if (e && (e.ctrlKey || e.metaKey)) return useTabsStore.getState().openInNewTab(`page:${pageId}`)
  useAppStore.getState().setActivePage(pageId, opts)
}

/** For tests: one fresh tab showing what the app shows, as on a first run. */
export function resetTabs() {
  const t = freshTab(appTarget())
  restored = false
  lastTarget = appTarget()
  useTabsStore.setState({ tabs: [t], activeTabId: t.id })
}
