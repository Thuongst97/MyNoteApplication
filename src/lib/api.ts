import type { ElectronAPI, Page, PageMeta, SearchResult } from '@/types'
import { docToText, makeSnippet } from './docText'

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

/**
 * In-browser fallback (localStorage) so the renderer can also be developed
 * and tested with a plain `vite` dev server outside Electron.
 */
function createBrowserApi(): ElectronAPI {
  const KEY = 'notion-clone:pages'
  const load = (): Record<string, Page> => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '{}')
    } catch {
      return {}
    }
  }
  const store = (pages: Record<string, Page>) => localStorage.setItem(KEY, JSON.stringify(pages))
  const meta = ({ content: _c, ...m }: Page): PageMeta => m
  const deleted = new Set<string>()
  const tick = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 0))

  return {
    platform: 'browser',
    getPageTree: async () =>
      tick(Object.values(load()).map(meta).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)),
    readPage: async (id) => tick(load()[id] ?? null),
    savePage: async (u) => {
      if (deleted.has(u.id)) return tick(null)
      const pages = load()
      const now = Date.now()
      const prev: Page = pages[u.id] ?? {
        id: u.id, title: '', icon: null, cover: null, parentId: null,
        order: now, createdAt: now, updatedAt: now, content: null,
      }
      const clean = Object.fromEntries(Object.entries(u).filter(([, v]) => v !== undefined))
      const page: Page = { ...prev, ...clean, updatedAt: now }
      pages[u.id] = page
      store(pages)
      return tick(meta(page))
    },
    deletePage: async (id) => {
      const pages = load()
      const ids: string[] = []
      const collect = (p: string) => {
        ids.push(p)
        Object.values(pages).forEach((x) => x.parentId === p && collect(x.id))
      }
      collect(id)
      ids.forEach((i) => {
        delete pages[i]
        deleted.add(i)
      })
      store(pages)
      return tick(ids)
    },
    searchPages: async (query) => {
      const q = query.trim().toLowerCase()
      if (!q) return []
      const out: SearchResult[] = []
      for (const p of Object.values(load())) {
        const snippet = makeSnippet(docToText(p.content), q)
        if (p.title.toLowerCase().includes(q) || snippet) out.push({ id: p.id, snippet })
      }
      return tick(out)
    },
    window: {
      minimize: () => {},
      toggleMaximize: () => {},
      close: () => {},
      isMaximized: async () => false,
      onMaximizedChange: () => () => {},
    },
    onFlushRequest: () => () => {},
  }
}

export const api: ElectronAPI = window.electronAPI ?? createBrowserApi()
export const isElectron = Boolean(window.electronAPI)
export const platform = api.platform
