import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { SlashCommandItem } from './slashCommands'
import { cn } from '@/lib/utils'

export interface SlashMenuProps {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
}

export interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean
}

/** Popover listing block types; driven by the SlashCommand extension. */
export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => setSelected(0), [items])

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (items.length === 0) return false
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % items.length)
        return true
      }
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
      className="z-50 max-h-80 w-72 animate-pop-in overflow-y-auto rounded-lg border border-black/10 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#252525]"
    >
      <div className="px-2 pb-1 pt-1.5 text-xs font-medium text-ink-light/50 dark:text-ink-dark/50">
        Basic blocks
      </div>
      {items.length === 0 ? (
        <div className="px-2 py-2 text-sm text-ink-light/50 dark:text-ink-dark/50">No results</div>
      ) : (
        items.map((item, index) => {
          const Icon = item.icon
          return (
            <button
              key={item.title}
              data-index={index}
              type="button"
              onMouseEnter={() => setSelected(index)}
              onMouseDown={(e) => {
                e.preventDefault() // keep editor focus
                command(item)
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left',
                index === selected && 'bg-black/5 dark:bg-white/10',
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-black/10 bg-white dark:border-white/10 dark:bg-[#2f2f2f]">
                <Icon size={20} strokeWidth={1.6} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm">{item.title}</span>
                <span className="block truncate text-xs text-ink-light/50 dark:text-ink-dark/50">
                  {item.description}
                </span>
              </span>
            </button>
          )
        })
      )}
    </div>
  )
})
SlashMenu.displayName = 'SlashMenu'
