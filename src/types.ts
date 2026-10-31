import type { JSONContent } from '@tiptap/react'

/** Lightweight page metadata used to build the sidebar tree. */
export type PageKind = 'doc' | 'whiteboard'

export interface PageMeta {
  id: string
  /** 'doc' = block document, 'whiteboard' = infinite canvas. */
  kind: PageKind
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

/** A to-do item shown in the Eisenhower Matrix. */
export interface Task {
  id: string
  title: string
  notes: string
  important: boolean
  urgent: boolean
  /** Due date/time (ms since epoch), or null. */
  dueAt: number | null
  /** Reminder offsets in minutes before `dueAt` (0 = at the due time). */
  reminders: number[]
  completed: boolean
  completedAt: number | null
  order: number
  createdAt: number
  updatedAt: number
  /** Reminders already delivered, as `${dueAt}:${offset}` keys. */
  sentReminders: string[]
}

export type TaskUpdate = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'sentReminders'>> & { id: string }

export interface TaskSettings {
  /** Reminder offsets (minutes before due) applied to new tasks. */
  defaultReminders: number[]
  /** Windows/Linux: keep running in the system tray after the window is closed, so reminders still arrive. */
  runInBackground: boolean
}

export interface PageLinkEdge {
  source: string
  target: string
}

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
  /** Every page-to-page link (mentions, page blocks, whiteboard links). */
  getLinks: () => Promise<PageLinkEdge[]>
  /** Full-text search over titles and page content. */
  searchPages: (query: string) => Promise<SearchResult[]>
  /** Stores an image and returns the URL to put in the document. */
  saveAsset: (data: Uint8Array, mime: string) => Promise<string>
  tasks: {
    list: () => Promise<Task[]>
    save: (update: TaskUpdate) => Promise<Task>
    remove: (id: string) => Promise<void>
    getSettings: () => Promise<TaskSettings>
    setSettings: (patch: Partial<TaskSettings>) => Promise<TaskSettings>
    testNotification: () => Promise<boolean>
    /** Fired when the user clicks a reminder notification. */
    onOpenTask: (cb: (id: string) => void) => () => void
    /** Fired when tasks change outside the renderer (e.g. reminders marked as sent). */
    onChanged: (cb: () => void) => () => void
  }
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
