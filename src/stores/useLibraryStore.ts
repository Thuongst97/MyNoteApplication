import { create } from 'zustand'
import { api } from '@/lib/api'
import { PERSONAL_ID, type LibraryCategory, type LibraryData, type LibraryItem } from '@/lib/libraries'
import { useAppStore } from './useAppStore'

interface LibraryState {
  data: LibraryData | null
  busy: string | null
  load: () => Promise<void>
  /** Applies a change and saves it permanently. */
  update: (fn: (d: LibraryData) => LibraryData) => Promise<void>
  toggleCollapsed: (id: string) => Promise<void>
  setAllCollapsed: (collapsed: boolean) => Promise<void>
  renameCategory: (id: string, name: string) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  deleteItem: (categoryId: string, itemId: string) => Promise<void>
  addItems: (categoryId: string, items: LibraryItem[]) => Promise<void>
  installUrl: (url: string) => Promise<string | null>
  importFile: () => Promise<string | null>
  browse: () => Promise<void>
}

const mapCat = (d: LibraryData, id: string, fn: (c: LibraryCategory) => LibraryCategory): LibraryData => ({
  ...d,
  categories: d.categories.map((c) => (c.id === id ? fn(c) : c)),
})

let saving: Promise<unknown> = Promise.resolve()

export const useLibraryStore = create<LibraryState>((set, get) => {
  const report = (err: unknown) => {
    const message = (err as Error)?.message ?? String(err)
    useAppStore.getState().showToast(`Library: ${message}`)
  }

  return {
    data: null,
    busy: null,

    load: async () => {
      set({ data: await api.libraries.get() })
    },

    update: async (fn) => {
      const cur = get().data ?? (await api.libraries.get())
      const next = fn(cur)
      set({ data: next })
      saving = saving.catch(() => undefined).then(() => api.libraries.save(next))
      await saving
    },

    toggleCollapsed: (id) => get().update((d) => mapCat(d, id, (c) => ({ ...c, collapsed: !c.collapsed }))),
    setAllCollapsed: (collapsed) => get().update((d) => ({ ...d, categories: d.categories.map((c) => ({ ...c, collapsed })) })),
    renameCategory: (id, name) => get().update((d) => mapCat(d, id, (c) => ({ ...c, name: name.trim() || c.name }))),
    deleteCategory: (id) =>
      get().update((d) =>
        id === PERSONAL_ID
          ? mapCat(d, id, (c) => ({ ...c, items: [] })) // the personal library can only be emptied
          : { ...d, categories: d.categories.filter((c) => c.id !== id) },
      ),
    deleteItem: (categoryId, itemId) => get().update((d) => mapCat(d, categoryId, (c) => ({ ...c, items: c.items.filter((i) => i.id !== itemId) }))),
    addItems: (categoryId, items) =>
      get().update((d) => mapCat(d, categoryId, (c) => ({ ...c, collapsed: false, items: [...items, ...c.items.filter((i) => !items.some((n) => n.id === i.id))] }))),

    installUrl: async (url) => {
      set({ busy: 'Installing…' })
      try {
        const r = await api.libraries.installUrl(url.trim())
        set({ data: r.data })
        const name = r.data.categories.find((c) => c.id === r.categoryId)?.name
        useAppStore.getState().showToast(`Installed “${name}”`)
        return r.categoryId
      } catch (err) {
        report(err)
        return null
      } finally {
        set({ busy: null })
      }
    },

    importFile: async () => {
      try {
        const r = await api.libraries.importFile()
        if (!r) return null
        set({ data: r.data })
        useAppStore.getState().showToast(`Imported “${r.data.categories.find((c) => c.id === r.categoryId)?.name}”`)
        return r.categoryId
      } catch (err) {
        report(err)
        return null
      }
    },

    browse: () => api.libraries.browse(),
  }
})

// Libraries installed from the browse window.
api.libraries.onInstalled((r) => {
  useLibraryStore.setState({ data: r.data })
  useAppStore.getState().showToast(`Installed “${r.name}”`)
})
