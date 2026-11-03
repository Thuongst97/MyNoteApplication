import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { PageKindIcon } from '@/components/ui/PageKindIcon'
import { Plus } from 'lucide-react'
import type { PageMeta } from '@/types'
import { cn } from '@/lib/utils'

export type PageSuggestItem = { kind: 'page'; page: PageMeta; path: string } | { kind: 'create'; title: string }

export interface PageSuggestMenuProps {
  items: PageSuggestItem[]
  command: (item: PageSuggestItem) => void
}

export interface PageSuggestMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean
}

/** Popover for linking to a page ([[ or @). */
export const PageSuggestMenu = forwardRef<PageSuggestMenuHandle, PageSuggestMenuProps>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => setSelected(0), [items])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (!items.length) return false
      if (event.key === 'ArrowUp') return setSelected((s) => (s + items.length - 1) % items.length), true
      if (event.key === 'ArrowDown') return setSelected((s) => (s + 1) % items.length), true
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = items[selected]
        if (item) command(item)
        return true
      }
      return false
    },
  }))

  return (
    <div
      ref={listRef}
      className="z-50 max-h-72 w-80 animate-pop-in overflow-y-auto rounded-lg border border-black/10 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#252525]"
    >
      <div className="px-2 pb-1 pt-1.5 text-xs font-medium text-ink-light/50 dark:text-ink-dark/50">Link to page</div>
      {items.map((item, index) => (
        <button
          key={item.kind === 'page' ? item.page.id : 'create'}
          type="button"
          data-index={index}
          onMouseEnter={() => setSelected(index)}
          onMouseDown={(e) => {
            e.preventDefault()
            command(item)
          }}
          className={cn('flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm', index === selected && 'bg-black/5 dark:bg-white/10')}
        >
          {item.kind === 'page' ? (
            <>
              <span className="flex w-5 shrink-0 justify-center text-base leading-none">
                {item.page.icon ?? <PageKindIcon kind={item.page.kind} size={16} className="opacity-60" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate', !item.page.title && 'opacity-50')}>{item.page.title || 'Untitled'}</span>
                {item.path && <span className="block truncate text-xs opacity-40">{item.path}</span>}
              </span>
            </>
          ) : (
            <>
              <Plus size={16} className="opacity-60" />
              <span className="truncate">
                New page “<b>{item.title}</b>”
              </span>
            </>
          )}
        </button>
      ))}
      {items.length === 0 && <div className="px-2 py-2 text-sm opacity-50">Type to search pages</div>}
    </div>
  )
})
PageSuggestMenu.displayName = 'PageSuggestMenu'
