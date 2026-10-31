import type { JSONContent } from '@tiptap/react'

/** Lightweight page metadata used to build the sidebar tree. */
export interface PageMeta {
  id: string
  title: string
  /** An emoji used as the page icon, or null for the default icon. */
  icon: string | null
  /** A CSS background value (gradient/color) or an image URL, or null. */
  cover: string | null
  parentId: string | null
  /** Sort order among siblings (ascending). */
  order: number
  createdAt: number
  updatedAt: number
}

/** A full page, including its TipTap document. */
export interface Page extends PageMeta {
  content: JSONContent | null
}

/** Fields the renderer may send when saving. `id` is always required. */
export type PageUpdate = Partial<Omit<Page, 'id' | 'createdAt' | 'updatedAt'>> & { id: string }

export interface SearchResult {
  id: string
  /** Short excerpt of matching body text, if the match was in the content. */
  snippet: string | null
}

export type Platform = 'darwin' | 'win32' | 'linux' | string

export interface ElectronAPI {
  platform: Platform
  getPageTree: () => Promise<PageMeta[]>
  readPage: (id: string) => Promise<Page | null>
  /** Resolves to null if the page was deleted in the meantime. */
  savePage: (update: PageUpdate) => Promise<PageMeta | null>
  deletePage: (id: string) => Promise<string[]>
  /** Full-text search over titles and page content. */
  searchPages: (query: string) => Promise<SearchResult[]>
  /** Stores an image and returns the URL to put in the document. */
  saveAsset: (data: Uint8Array, mime: string) => Promise<string>
  window: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    onMaximizedChange: (cb: (maximized: boolean) => void) => () => void
  }
  /** Called by main before the window closes so pending saves can be flushed. */
  onFlushRequest: (cb: () => Promise<void>) => () => void
}
