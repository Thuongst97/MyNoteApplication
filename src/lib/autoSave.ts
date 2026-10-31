import type { PageMeta, PageUpdate } from '@/types'
import { api } from './api'

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

type Listener = (status: SaveStatus) => void
type SavedListener = (meta: PageMeta) => void

interface Entry {
  update: PageUpdate
  timer: ReturnType<typeof setTimeout> | null
}

/**
 * Debounced auto-save engine.
 *
 * - Updates are merged per page id and written after `delay` ms of inactivity.
 * - Each page has its own timer, so switching pages never drops or mixes edits:
 *   page A's pending save still fires (or is flushed) while editing page B.
 * - `flush(id)` writes immediately (used before reading a page and on app close).
 * - `cancel(id)` discards pending edits (used when a page is deleted).
 * - Writes for the same page are chained so they reach the main process in order.
 */
export class AutoSaver {
  private entries = new Map<string, Entry>()
  private inflight = new Map<string, Promise<void>>()
  private listeners = new Set<Listener>()
  private savedListeners = new Set<SavedListener>()
  private status: SaveStatus = 'idle'

  constructor(private readonly delay = 500) {}

  schedule(update: PageUpdate) {
    const entry = this.entries.get(update.id)
    if (entry?.timer) clearTimeout(entry.timer)
    const merged: PageUpdate = { ...(entry?.update ?? {}), ...update }
    const timer = setTimeout(() => void this.flush(update.id), this.delay)
    this.entries.set(update.id, { update: merged, timer })
    this.setStatus('pending')
  }

  hasPending(id?: string) {
    return id ? this.entries.has(id) : this.entries.size > 0
  }

  cancel(id: string) {
    const entry = this.entries.get(id)
    if (entry?.timer) clearTimeout(entry.timer)
    this.entries.delete(id)
    this.refreshStatus()
  }

  /** Immediately persists pending edits for `id` and waits for all its writes. */
  flush(id: string): Promise<void> {
    const entry = this.entries.get(id)
    if (entry) {
      if (entry.timer) clearTimeout(entry.timer)
      this.entries.delete(id)
      const prev = this.inflight.get(id) ?? Promise.resolve()
      const write = prev.then(() => this.write(entry.update))
      this.inflight.set(id, write)
      void write.finally(() => {
        if (this.inflight.get(id) === write) this.inflight.delete(id)
        this.refreshStatus()
      })
    }
    return this.inflight.get(id) ?? Promise.resolve()
  }

  async flushAll() {
    const ids = new Set([...this.entries.keys(), ...this.inflight.keys()])
    await Promise.all([...ids].map((id) => this.flush(id)))
  }

  private async write(update: PageUpdate) {
    this.setStatus('saving')
    try {
      const meta = await api.savePage(update)
      if (meta) this.savedListeners.forEach((l) => l(meta))
      this.setStatus(this.hasPending() ? 'pending' : 'saved')
    } catch (err) {
      console.error('[autosave] failed to save page', update.id, err)
      this.setStatus('error')
    }
  }

  private refreshStatus() {
    if (this.entries.size > 0) this.setStatus('pending')
    else if (this.inflight.size > 0) this.setStatus('saving')
    else if (this.status !== 'error') this.setStatus(this.status === 'idle' ? 'idle' : 'saved')
  }

  private setStatus(status: SaveStatus) {
    if (status === this.status) return
    this.status = status
    this.listeners.forEach((l) => l(status))
  }

  getStatus() {
    return this.status
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  onSaved(listener: SavedListener) {
    this.savedListeners.add(listener)
    return () => void this.savedListeners.delete(listener)
  }
}

export const autoSaver = new AutoSaver(500)
