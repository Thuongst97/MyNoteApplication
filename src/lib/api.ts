import type { ElectronAPI, Page, PageMeta, SearchResult, Task, TaskSettings } from '@/types'
import { emptyLibraries, installLibrary, isAllowedLibraryUrl, libraryNameFrom, normalizeLibraries, parseLibraryFile, type LibraryData } from './libraries'
import { applyTaskUpdate, collectDueReminders, DEFAULT_TASK_SETTINGS, notificationText } from './reminders'
import { docToText, makeSnippet } from './docText'
import { extractLinks } from './links'

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
  const meta = ({ content: _c, ...m }: Page): PageMeta => ({ ...m, kind: m.kind === 'whiteboard' ? 'whiteboard' : 'doc' })
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
        id: u.id, kind: u.kind === 'whiteboard' ? 'whiteboard' : 'doc', title: '', icon: null, cover: null, parentId: null,
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
    getLinks: async () => {
      const pages = load()
      return Object.values(pages).flatMap((p) =>
        extractLinks(p.content)
          .filter((t) => t !== p.id && pages[t])
          .map((target) => ({ source: p.id, target })),
      )
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
    tasks: createBrowserTasksApi(),
    libraries: createBrowserLibrariesApi(),
    // In a plain browser, images are embedded as data URLs.
    saveAsset: async (data, mime) => {
      let bin = ''
      for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000))
      return `data:${mime};base64,${btoa(bin)}`
    },
    zoom: {
      // Plain browser: CSS zoom on the root element.
      get: () => Number(document.documentElement.style.zoom) || 1,
      set: (factor: number) => void (document.documentElement.style.zoom = String(factor)),
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

/** localStorage-backed libraries (browser dev mode only). */
function createBrowserLibrariesApi(): ElectronAPI['libraries'] {
  const KEY = 'notion-clone:libraries'
  const read = (): LibraryData => {
    try {
      return normalizeLibraries(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
    } catch {
      return emptyLibraries()
    }
  }
  const write = (d: LibraryData) => (localStorage.setItem(KEY, JSON.stringify(d)), d)
  return {
    get: async () => read(),
    save: async (d) => write(normalizeLibraries(d)),
    installUrl: async (url) => {
      if (!isAllowedLibraryUrl(url, { allowLocalHttp: true })) throw new Error('Only https:// library links can be installed.')
      const items = parseLibraryFile(await (await fetch(url)).text())
      const r = installLibrary(read(), url, items)
      return { data: write(r.data), categoryId: r.categoryId }
    },
    importFile: () =>
      new Promise((resolve, reject) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.excalidrawlib,.json'
        input.onchange = async () => {
          const f = input.files?.[0]
          if (!f) return resolve(null)
          try {
            const r = installLibrary(read(), 'file', parseLibraryFile(await f.text()), libraryNameFrom(f.name))
            resolve({ data: write(r.data), categoryId: r.categoryId })
          } catch (err) {
            reject(err)
          }
        }
        input.click()
      }),
    browse: async () => void window.open('https://libraries.excalidraw.com/', '_blank'),
    onInstalled: () => () => {},
  }
}

/** localStorage-backed tasks + a web-Notification reminder loop (browser dev mode only). */
function createBrowserTasksApi(): ElectronAPI['tasks'] {
  const TASKS = 'notion-clone:tasks'
  const SETTINGS = 'notion-clone:task-settings'
  const read = <T,>(k: string, f: T): T => {
    try {
      return JSON.parse(localStorage.getItem(k) ?? 'null') ?? f
    } catch {
      return f
    }
  }
  const all = () => read<Task[]>(TASKS, [])
  const write = (t: Task[]) => localStorage.setItem(TASKS, JSON.stringify(t))
  const openListeners = new Set<(id: string) => void>()
  const changeListeners = new Set<() => void>()
  const notify = (title: string, body: string, onClick?: () => void) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
    const n = new Notification(title, { body })
    n.onclick = () => {
      window.focus()
      onClick?.()
    }
    return true
  }
  setInterval(() => {
    const now = Date.now()
    const { notifications, changed } = collectDueReminders(all(), now, 15_000)
    if (!changed.length) return
    write(all().map((t) => changed.find((c) => c.id === t.id) ?? t))
    notifications.forEach((n) => {
      const { title, body } = notificationText(n, now)
      notify(title, body, () => openListeners.forEach((l) => l(n.task.id)))
    })
    changeListeners.forEach((l) => l())
  }, 15_000)

  return {
    list: async () => all(),
    save: async (u) => {
      const list = all()
      const t = applyTaskUpdate(list.find((x) => x.id === u.id) ?? null, u)
      write([...list.filter((x) => x.id !== u.id), t])
      return t
    },
    remove: async (id) => write(all().filter((t) => t.id !== id)),
    getSettings: async () => ({ ...DEFAULT_TASK_SETTINGS, ...read<Partial<TaskSettings>>(SETTINGS, {}) }),
    setSettings: async (patch) => {
      const next = { ...DEFAULT_TASK_SETTINGS, ...read<Partial<TaskSettings>>(SETTINGS, {}), ...patch }
      localStorage.setItem(SETTINGS, JSON.stringify(next))
      return next
    },
    testNotification: async () => {
      if (typeof Notification === 'undefined') return false
      if (Notification.permission === 'default') await Notification.requestPermission()
      return notify('🔔 Notifications are working', 'You will be reminded about tasks like this.')
    },
    onOpenTask: (cb) => {
      openListeners.add(cb)
      return () => void openListeners.delete(cb)
    },
    onChanged: (cb) => {
      changeListeners.add(cb)
      return () => void changeListeners.delete(cb)
    },
  }
}

export const api: ElectronAPI = window.electronAPI ?? createBrowserApi()
export const isElectron = Boolean(window.electronAPI)
export const platform = api.platform
