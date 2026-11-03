import { useEffect, useRef } from 'react'
import { ArrowDown, ArrowUp, CaseSensitive, WholeWord, X } from 'lucide-react'
import { useFindStore } from '@/stores/useFindStore'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/useAppStore'

/**
 * Find in the open tab (Ctrl+F), like VS Code: matches highlight as you type, "3 of 12",
 * ↑/↓ (Enter / Shift+Enter, F3 / Shift+F3), Aa = match case (Alt+C), ab = whole word
 * (Alt+W), Esc closes.
 */
export function FindBar() {
  const { open, query, caseSensitive, wholeWord, total, index, version, provider, focusRequest } = useFindStore()
  const set = useFindStore((s) => s.set)
  const inputRef = useRef<HTMLInputElement>(null)
  // Presentations have a toolbar row at the top: the bar sits just below it.
  const onSlides = useAppStore((s) => s.view === 'page' && s.pages.find((p) => p.id === s.activePageId)?.kind === 'slides')
  const prevKey = useRef('')

  // Focus (and select) the field when opened or Ctrl+F is pressed again.
  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [open, focusRequest])

  // Search whenever the query, options, content or target change.
  useEffect(() => {
    if (!open || !provider) return
    const opts = { query, caseSensitive, wholeWord }
    const key = JSON.stringify(opts)
    const n = provider.search(opts)
    const fresh = key !== prevKey.current
    prevKey.current = key
    // A new search starts at the first match after the cursor; content edits keep the place.
    const i = n === 0 ? 0 : fresh ? Math.min(provider.startIndex?.() ?? 0, n - 1) : Math.min(useFindStore.getState().index, n - 1)
    set({ total: n, index: i })
    if (n) provider.reveal(i)
  }, [open, query, caseSensitive, wholeWord, version, provider, set])

  // Closing clears the highlights.
  useEffect(() => {
    if (open) return
    prevKey.current = ''
    useFindStore.getState().provider?.clear()
  }, [open])

  const go = (dir: 1 | -1) => {
    const s = useFindStore.getState()
    if (!s.total || !s.provider) return
    const i = (s.index + dir + s.total) % s.total
    set({ index: i })
    s.provider.reveal(i)
  }

  // F3 / Shift+F3 work even when the field isn't focused.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault()
        go(e.shiftKey ? -1 : 1)
      } else if (e.key === 'Escape' && !e.defaultPrevented && (e.target as HTMLElement)?.closest?.('.ProseMirror')) {
        // Esc in the page closes the find bar too (menus that use Esc handle it first).
        useFindStore.getState().setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null
  const toggle = 'flex h-6 w-6 items-center justify-center rounded border'
  const btn = 'flex h-6 w-6 items-center justify-center rounded hover:bg-black/[0.07] disabled:opacity-30 dark:hover:bg-white/10'

  return (
    <div
      role="search"
      aria-label="Find in page"
      data-testid="find-bar"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          useFindStore.getState().setOpen(false)
        }
      }}
      className={cn('no-drag absolute right-5 z-[60] flex', onSlides ? 'top-[52px]' : 'top-2', 'animate-pop-in items-center gap-1 rounded-lg border border-black/10 bg-white py-1 pl-2 pr-1 shadow-lg dark:border-white/10 dark:bg-[#252525]')}
    >
      <div className="flex items-center rounded-md border border-black/15 bg-white focus-within:border-[#2383e2] dark:border-white/15 dark:bg-[#1e1e1e]">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="Find"
          aria-label="Find"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              go(e.shiftKey ? -1 : 1)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              useFindStore.getState().setOpen(false)
            } else if (e.altKey && e.code === 'KeyC') {
              e.preventDefault()
              set({ caseSensitive: !caseSensitive })
            } else if (e.altKey && e.code === 'KeyW') {
              e.preventDefault()
              set({ wholeWord: !wholeWord })
            }
          }}
          className="h-7 w-[220px] bg-transparent px-2 text-sm outline-none"
        />
        <button
          type="button"
          aria-label="Match case"
          title="Match case (Alt+C)"
          aria-pressed={caseSensitive}
          onMouseDown={(e) => e.preventDefault() /* keep typing in the field */}
          onClick={() => set({ caseSensitive: !caseSensitive })}
          className={cn(toggle, 'mr-0.5', caseSensitive ? 'border-[#2383e2] bg-[#2383e2]/15 text-[#2383e2]' : 'border-transparent opacity-70 hover:opacity-100')}
        >
          <CaseSensitive size={16} />
        </button>
        <button
          type="button"
          aria-label="Match whole word"
          title="Match whole word (Alt+W)"
          aria-pressed={wholeWord}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => set({ wholeWord: !wholeWord })}
          className={cn(toggle, 'mr-1', wholeWord ? 'border-[#2383e2] bg-[#2383e2]/15 text-[#2383e2]' : 'border-transparent opacity-70 hover:opacity-100')}
        >
          <WholeWord size={16} />
        </button>
      </div>
      <span
        className={cn('min-w-[74px] px-1.5 text-center text-xs tabular-nums', query && !total ? 'text-red-600 dark:text-red-400' : 'opacity-70')}
        data-testid="find-count"
        aria-live="polite"
      >
        {query && total ? `${index + 1} of ${total}` : 'No results'}
      </span>
      <button type="button" onMouseDown={(e) => e.preventDefault()} className={btn} aria-label="Previous match" title="Previous match (Shift+Enter)" disabled={!total} onClick={() => go(-1)}>
        <ArrowUp size={15} />
      </button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} className={btn} aria-label="Next match" title="Next match (Enter)" disabled={!total} onClick={() => go(1)}>
        <ArrowDown size={15} />
      </button>
      <button type="button" className={btn} aria-label="Close find" title="Close (Esc)" onClick={() => useFindStore.getState().setOpen(false)}>
        <X size={15} />
      </button>
    </div>
  )
}
