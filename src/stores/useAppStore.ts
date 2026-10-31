import { create } from 'zustand'
import type { JSONContent } from '@tiptap/react'
import type { PageKind, PageMeta } from '@/types'
import { api } from '@/lib/api'
import { autoSaver } from '@/lib/autoSave'
import { newId } from '@/lib/utils'

export type Theme = 'light' | 'dark'

const PREFS_KEY = 'notion-clone:prefs'

export type View = 'page' | 'tasks' | 'graph'

interface Prefs {
  view: View
  theme: Theme
  isSidebarOpen: boolean
  sidebarWidth: number
  expanded: Record<string, boolean>
  activePageId: string | null
}

function loadPrefs(): Prefs {
  const fallback: Prefs = {
    theme: window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
    view: 'page',
    isSidebarOpen: true,
    sidebarWidth: 260,
    expanded: {},
    activePageId: null,
  }
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }
  } catch {
    return fallback
  }
}

interface AppState extends Prefs {
  pages: PageMeta[]
  isLoaded: boolean
  isSearchOpen: boolean
  /** Id of the page whose title should be focused after creation. */
  focusTitleFor: string | null

  /** Task to scroll to / highlight in the Tasks view (e.g. from a notification). */
  highlightTaskId: string | null

  openTasks: (highlightTaskId?: string | null) => void
  loadPages: () => Promise<void>
  setActivePage: (id: string | null, opts?: { blockId?: string | null }) => void
  createPage: (
    parentId?: string | null,
    init?: { title?: string; content?: JSONContent; kind?: PageKind; id?: string; navigate?: boolean },
  ) => Promise<string>
  /** Block to scroll to and flash after navigating (block references). */
  highlightBlockId: string | null
  openGraph: () => void
  toast: { id: number; message: string } | null
  showToast: (message: string) => void
  /** Bumped whenever page links may have changed (backlinks, graph). */
  linksVersion: number
  updatePageMeta: (id: string, patch: Partial<Pick<PageMeta, 'title' | 'icon' | 'cover'>>) => void
  deletePage: (id: string) => Promise<void>
  toggleExpanded: (id: string, value?: boolean) => void
  toggleSidebar: () => void
  setSidebarWidth: (w: number) => void
  setTheme: (t: Theme) => void
  toggleTheme: () => void
  setSearchOpen: (open: boolean) => void
  clearFocusTitle: () => void
}

const prefs = loadPrefs()

export const useAppStore = create<AppState>((set, get) => ({
  ...prefs,
  pages: [],
  isLoaded: false,
  isSearchOpen: false,
  focusTitleFor: null,
  highlightTaskId: null,
  highlightBlockId: null,
  linksVersion: 0,
  toast: null,
  showToast: (message) => {
    const id = Date.now()
    set({ toast: { id, message } })
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, 2200)
  },

  openGraph: () => {
    const prev = get().activePageId
    if (prev) void autoSaver.flush(prev)
    set({ view: 'graph' })
  },

  openTasks: (highlightTaskId = null) => {
    const prev = get().activePageId
    if (prev) void autoSaver.flush(prev)
    set({ view: 'tasks', highlightTaskId })
  },

  loadPages: async () => {
    let pages = await api.getPageTree()
    if (pages.length === 0) {
      const id = newId()
      const meta = await api.savePage({ id, title: 'Getting Started', icon: '👋', parentId: null, content: WELCOME_DOC })
      pages = meta ? [meta] : []
    }
    const { activePageId } = get()
    const active = pages.some((p) => p.id === activePageId)
      ? activePageId
      : (pages.find((p) => p.parentId === null)?.id ?? null)
    set({ pages, isLoaded: true, activePageId: active })
  },

  setActivePage: (id, opts) => {
    const prev = get().activePageId
    // Persist the page we're leaving right away instead of waiting for the debounce.
    if (prev && prev !== id) void autoSaver.flush(prev)
    // Make sure every ancestor is expanded so the active page is visible in the tree.
    const expanded = { ...get().expanded }
    const byId = new Map(get().pages.map((p) => [p.id, p]))
    let cur = id ? byId.get(id)?.parentId : null
    while (cur) {
      expanded[cur] = true
      cur = byId.get(cur)?.parentId ?? null
    }
    set({ activePageId: id, expanded, view: 'page', highlightBlockId: opts?.blockId ?? null })
  },

  createPage: async (parentId = null, init) => {
    const id = init?.id ?? newId()
    const now = Date.now()
    const kind: PageKind = init?.kind ?? 'doc'
    const meta: PageMeta = {
      id,
      kind,
      title: init?.title ?? '',
      icon: null,
      cover: null,
      parentId,
      order: now,
      createdAt: now,
      updatedAt: now,
    }
    set((s) => ({
      pages: [...s.pages, meta],
      expanded: parentId ? { ...s.expanded, [parentId]: true } : s.expanded,
      focusTitleFor: init?.navigate === false ? s.focusTitleFor : id,
    }))
    if (init?.navigate !== false) get().setActivePage(id)
    const content = init?.content ?? (kind === 'whiteboard' ? { type: 'whiteboard', scene: { elements: [], files: {} } } : null)
    await api.savePage({ ...meta, content })
    set((s) => ({ linksVersion: s.linksVersion + 1 }))
    return id
  },

  updatePageMeta: (id, patch) => {
    set((s) => ({ pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)) }))
    autoSaver.schedule({ id, ...patch })
  },

  deletePage: async (id) => {
    // Optimistically remove the page and all descendants.
    const { pages, activePageId } = get()
    const doomed = new Set<string>()
    const collect = (pid: string) => {
      doomed.add(pid)
      pages.forEach((p) => p.parentId === pid && collect(p.id))
    }
    collect(id)
    doomed.forEach((pid) => autoSaver.cancel(pid))

    const remaining = pages.filter((p) => !doomed.has(p.id))
    let nextActive = activePageId
    if (activePageId && doomed.has(activePageId)) {
      const deleted = pages.find((p) => p.id === id)
      nextActive = deleted?.parentId ?? remaining.find((p) => p.parentId === null)?.id ?? null
    }
    set({ pages: remaining, activePageId: nextActive })
    await api.deletePage(id)
    set((s) => ({ linksVersion: s.linksVersion + 1 }))
  },

  toggleExpanded: (id, value) =>
    set((s) => ({ expanded: { ...s.expanded, [id]: value ?? !s.expanded[id] } })),
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  setSidebarWidth: (w) => set({ sidebarWidth: Math.round(Math.min(480, Math.max(200, w))) }),
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
  clearFocusTitle: () => set({ focusTitleFor: null }),
}))

// Keep sidebar metadata (e.g. updatedAt) in sync with what was persisted.
autoSaver.onSaved((meta) => {
  useAppStore.setState((s) => ({
    pages: s.pages.map((p) => (p.id === meta.id ? { ...p, updatedAt: meta.updatedAt } : p)),
    linksVersion: s.linksVersion + 1,
  }))
})

// Persist UI preferences.
useAppStore.subscribe((s) => {
  const p: Prefs = {
    view: s.view,
    theme: s.theme,
    isSidebarOpen: s.isSidebarOpen,
    sidebarWidth: s.sidebarWidth,
    expanded: s.expanded,
    activePageId: s.activePageId,
  }
  localStorage.setItem(PREFS_KEY, JSON.stringify(p))
})

/** Children of `parentId`, sorted. */
export function selectChildren(pages: PageMeta[], parentId: string | null) {
  return pages
    .filter((p) => p.parentId === parentId)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
}

export const WELCOME_DOC: JSONContent = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Welcome! This is your new workspace. A few tips to get going:' }] },
    {
      type: 'taskList',
      content: [
        ['Type ', '/', ' on an empty line to open the block menu'],
        ['Press ', 'Ctrl/⌘ + K', ' to search across all pages'],
        ['Hover a page in the sidebar and click ', '+', ' to add a sub-page'],
        ['Everything auto-saves to your computer as you type', '', ''],
      ].map(([a, code, b], i) => ({
        type: 'taskItem',
        attrs: { checked: i === 3 },
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: a },
              ...(code ? [{ type: 'text', text: code, marks: [{ type: 'code' }] }] : []),
              ...(b ? [{ type: 'text', text: b }] : []),
            ],
          },
        ],
      })),
    },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Markdown shortcuts' }] },
    {
      type: 'bulletList',
      content: ['# Heading 1, ## Heading 2, ### Heading 3', '- or * for bullets, 1. for numbered lists', '[] for a to-do, > for a quote, ``` for code'].map(
        (t) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] }),
      ),
    },
    { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tip: use the sidebar menu (•••) to rename or delete pages.' }] }] },
  ],
}
