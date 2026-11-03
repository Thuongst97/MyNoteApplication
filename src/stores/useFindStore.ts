import { create } from 'zustand'
import type { FindOptions } from '@/lib/find'

/**
 * What the open tab offers to the find bar (Ctrl+F): a page editor, a presentation…
 * `search` highlights every match and returns how many there are; `reveal` shows match `i`.
 */
export interface FindProvider {
  search: (opts: FindOptions) => number
  reveal: (index: number) => void
  clear: () => void
  /** Where to start (the first match at/after the cursor); default 0. */
  startIndex?: () => number
  /** Selected text to look for when the bar opens. */
  selectedText?: () => string
}

interface FindStore {
  open: boolean
  query: string
  caseSensitive: boolean
  wholeWord: boolean
  total: number
  index: number
  /** Bumped when the searched content changes (counts are refreshed). */
  version: number
  provider: FindProvider | null
  /** Times Ctrl+F was pressed (focuses the field again even if it's open). */
  focusRequest: number
  setOpen: (open: boolean) => void
  set: (patch: Partial<Pick<FindStore, 'query' | 'caseSensitive' | 'wholeWord' | 'total' | 'index'>>) => void
  requestFocus: () => void
  contentChanged: () => void
}

export const useFindStore = create<FindStore>((set) => ({
  open: false,
  query: '',
  caseSensitive: false,
  wholeWord: false,
  total: 0,
  index: 0,
  version: 0,
  provider: null,
  focusRequest: 0,
  setOpen: (open) => set({ open }),
  set: (patch) => set(patch),
  requestFocus: () => set((s) => ({ open: true, focusRequest: s.focusRequest + 1 })),
  contentChanged: () => set((s) => ({ version: s.version + 1 })),
}))

/** Makes `provider` the find target while a view is shown; returns the cleanup. */
export function setFindTarget(provider: FindProvider | null) {
  if (!provider) return () => {}
  useFindStore.setState({ provider })
  return () => {
    provider.clear()
    if (useFindStore.getState().provider === provider) useFindStore.setState({ provider: null, total: 0, index: 0 })
  }
}
