import { useEffect, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, FileText, Search, Shapes } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { api } from '@/lib/api'
import { autoSaver } from '@/lib/autoSave'
import type { PageMeta, SearchResult } from '@/types'
import { cn } from '@/lib/utils'

/** Global search palette (Ctrl/⌘+K) over page titles and content. */
export function SearchModal() {
  const open = useAppStore((s) => s.isSearchOpen)
  const pages = useAppStore((s) => s.pages)
  const { setSearchOpen, setActivePage } = useAppStore.getState()
  const [query, setQuery] = useState('')
  const [contentHits, setContentHits] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setContentHits([])
      // Make sure the latest edits are searchable.
      void autoSaver.flushAll()
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Debounced full-text search via the main process.
  useEffect(() => {
    if (!open || !query.trim()) {
      setContentHits([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      void api.searchPages(query).then((r) => !cancelled && setContentHits(r))
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const byId = new Map(pages.map((p) => [p.id, p]))
    if (!q) {
      return [...pages]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 12)
        .map((page) => ({ page, snippet: null as string | null }))
    }
    const out = new Map<string, { page: PageMeta; snippet: string | null }>()
    // Title matches first (instant), then content matches from disk.
    pages
      .filter((p) => (p.title || 'Untitled').toLowerCase().includes(q))
      .forEach((page) => out.set(page.id, { page, snippet: null }))
    contentHits.forEach((hit) => {
      const page = byId.get(hit.id)
      if (!page) return
      const existing = out.get(hit.id)
      out.set(hit.id, { page, snippet: existing?.snippet ?? hit.snippet })
    })
    return [...out.values()]
  }, [pages, query, contentHits])

  useEffect(() => setSelected(0), [query])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (!open) return null

  const choose = (id: string) => {
    setSearchOpen(false)
    setActivePage(id)
  }

  const pathOf = (page: PageMeta) => {
    const byId = new Map(pages.map((p) => [p.id, p]))
    const names: string[] = []
    let cur = page.parentId ? byId.get(page.parentId) : undefined
    while (cur) {
      names.unshift(cur.title || 'Untitled')
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return names.join(' / ')
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex animate-fade-in items-start justify-center bg-black/40 pt-[12vh]"
      onMouseDown={(e) => e.target === e.currentTarget && setSearchOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Search"
        className="no-drag flex max-h-[70vh] w-[640px] max-w-[92vw] animate-pop-in flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#252525]"
      >
        <div className="flex items-center gap-2 border-b border-black/5 px-4 dark:border-white/10">
          <Search size={18} className="opacity-50" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages…"
            className="h-12 flex-1 bg-transparent text-base outline-none placeholder:opacity-40"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchOpen(false)
              else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelected((s) => Math.min(s + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelected((s) => Math.max(s - 1, 0))
              } else if (e.key === 'Enter' && results[selected]) {
                choose(results[selected].page.id)
              }
            }}
          />
          <kbd className="rounded border border-black/10 px-1.5 text-[11px] opacity-50 dark:border-white/15">Esc</kbd>
        </div>

        <div ref={listRef} className="overflow-y-auto p-1.5">
          <div className="px-2 pb-1 pt-1 text-xs font-medium opacity-50">{query.trim() ? 'Results' : 'Recent'}</div>
          {results.length === 0 && <div className="px-2 py-6 text-center text-sm opacity-50">No results for “{query}”</div>}
          {results.map(({ page, snippet }, index) => {
            const path = pathOf(page)
            return (
              <button
                key={page.id}
                type="button"
                data-index={index}
                onMouseEnter={() => setSelected(index)}
                onClick={() => choose(page.id)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-md px-2 py-2 text-left',
                  index === selected && 'bg-black/5 dark:bg-white/10',
                )}
              >
                <span className="mt-0.5 flex w-5 shrink-0 justify-center text-base leading-none">
                  {page.icon ?? (page.kind === 'whiteboard' ? <Shapes size={16} className="opacity-60" /> : <FileText size={16} className="opacity-60" />)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={cn('truncate text-sm', !page.title && 'opacity-50')}>{page.title || 'Untitled'}</span>
                    {path && <span className="truncate text-xs opacity-40">{path}</span>}
                  </span>
                  {snippet && <span className="mt-0.5 block truncate text-xs opacity-50">{snippet}</span>}
                </span>
                {index === selected && <CornerDownLeft size={14} className="mt-1 shrink-0 opacity-40" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
