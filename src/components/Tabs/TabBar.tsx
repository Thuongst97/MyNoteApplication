import { useState } from 'react'
import { ArrowLeft, ArrowRight, CheckSquare, FileText, Network, Plus, Shapes, X } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { current, useTabsStore, type Tab, type TabTarget } from '@/stores/useTabsStore'
import type { PageMeta } from '@/types'
import { cn, isMacLike } from '@/lib/utils'

export function tabLabel(target: TabTarget, byId: Map<string, PageMeta>): { title: string; icon: React.ReactNode } {
  if (target === 'tasks') return { title: 'Tasks', icon: <CheckSquare size={14} className="text-blue-500" /> }
  if (target === 'graph') return { title: 'Graph view', icon: <Network size={14} className="text-blue-500" /> }
  if (target === 'home') return { title: 'New tab', icon: <FileText size={14} className="opacity-50" /> }
  const page = byId.get(target.slice(5))
  return {
    title: page?.title || 'Untitled',
    icon: page?.icon ? <span className="text-[14px] leading-none">{page.icon}</span> : page?.kind === 'whiteboard' ? <Shapes size={14} className="opacity-60" /> : <FileText size={14} className="opacity-60" />,
  }
}

/** Back/forward + browser-like tabs + new tab, in the title bar. */
export function TabBar() {
  const tabs = useTabsStore((s) => s.tabs)
  const activeTabId = useTabsStore((s) => s.activeTabId)
  const pages = useAppStore((s) => s.pages)
  const { switchTab, closeTab, newTab, moveTab, back, forward } = useTabsStore.getState()
  const byId = new Map(pages.map((p) => [p.id, p]))
  const active = tabs.find((t) => t.id === activeTabId)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const mod = isMacLike() ? '⌘' : 'Ctrl'

  const navBtn = 'no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-black/5 disabled:opacity-25 disabled:hover:bg-transparent dark:hover:bg-white/10'

  return (
    <div className="flex min-w-0 items-center gap-0.5" role="presentation">
      <button type="button" className={navBtn} title="Back (Alt+←)" aria-label="Back" disabled={!active || active.index === 0} onClick={back}>
        <ArrowLeft size={16} className="opacity-70" />
      </button>
      <button type="button" className={cn(navBtn, 'mr-1')} title="Forward (Alt+→)" aria-label="Forward" disabled={!active || active.index >= active.history.length - 1} onClick={forward}>
        <ArrowRight size={16} className="opacity-70" />
      </button>
      <div
        role="tablist"
        aria-label="Open pages"
        className="flex min-w-0 items-end gap-0.5 self-stretch pt-1.5"
        onDragOver={(e) => dragId && e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          if (dragId && dropAt !== null) {
            const from = tabs.findIndex((t) => t.id === dragId)
            moveTab(dragId, dropAt > from ? dropAt - 1 : dropAt)
          }
          setDragId(null)
          setDropAt(null)
        }}
      >
        {tabs.map((tab, i) => (
          <TabItem
            key={tab.id}
            tab={tab}
            index={i}
            active={tab.id === activeTabId}
            label={tabLabel(current(tab), byId)}
            pageId={current(tab).startsWith('page:') && byId.has(current(tab).slice(5)) ? current(tab).slice(5) : null}
            onlyTab={tabs.length === 1}
            dropBefore={dropAt === i && dragId !== tab.id}
            dropAfter={dropAt === tabs.length && i === tabs.length - 1}
            onSelect={() => switchTab(tab.id)}
            onClose={() => closeTab(tab.id)}
            onDragStart={() => setDragId(tab.id)}
            onDragEnd={() => {
              setDragId(null)
              setDropAt(null)
            }}
            onDragOverAt={(after) => dragId && setDropAt(after ? i + 1 : i)}
          />
        ))}
      </div>
      <button type="button" className={cn(navBtn, 'ml-0.5')} title={`New tab (${mod}+T)`} aria-label="New tab" onClick={newTab}>
        <Plus size={16} className="opacity-70" />
      </button>
    </div>
  )
}

function TabItem({
  tab,
  index,
  active,
  pageId,
  label,
  onlyTab,
  dropBefore,
  dropAfter,
  onSelect,
  onClose,
  onDragStart,
  onDragEnd,
  onDragOverAt,
}: {
  tab: Tab
  index: number
  active: boolean
  /** The tab's page (renamable by double-click), if it shows one. */
  pageId: string | null
  label: { title: string; icon: React.ReactNode }
  onlyTab: boolean
  dropBefore: boolean
  dropAfter: boolean
  onSelect: () => void
  onClose: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOverAt: (after: boolean) => void
}) {
  const mod = isMacLike() ? '⌘' : 'Ctrl'
  const [renaming, setRenaming] = useState<string | null>(null)
  const commit = () => {
    if (renaming !== null && pageId) useAppStore.getState().updatePageMeta(pageId, { title: renaming.trim() })
    setRenaming(null)
  }
  return (
    <div
      role="tab"
      aria-selected={active}
      tabIndex={0}
      title={`${index < 9 ? `${label.title} (${mod}+${index + 1})` : label.title}${pageId ? ' · double-click to rename' : ''}`}
      data-tab-id={tab.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', label.title)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        onDragOverAt(e.clientX > r.left + r.width / 2)
      }}
      onMouseDown={(e) => {
        if (e.button === 1) e.preventDefault() // no autoscroll
      }}
      onAuxClick={(e) => {
        if (e.button === 1) onClose() // middle-click closes, like browsers
      }}
      onClick={onSelect}
      onDoubleClick={() => {
        // Double-click renames the page (the page itself no longer shows a title row for whiteboards).
        if (!pageId) return
        const page = useAppStore.getState().pages.find((p) => p.id === pageId)
        setRenaming(page?.title ?? '')
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'no-drag group/tab relative flex h-[30px] w-[220px] min-w-[72px] flex-[0_1_220px] cursor-default select-none items-center gap-1.5 rounded-t-lg px-2.5 text-[13px]',
        active
          ? 'bg-canvas-light shadow-[0_-1px_0_rgba(0,0,0,0.06),1px_0_0_rgba(0,0,0,0.06),-1px_0_0_rgba(0,0,0,0.06)] dark:bg-canvas-dark dark:shadow-[0_-1px_0_rgba(255,255,255,0.08),1px_0_0_rgba(255,255,255,0.08),-1px_0_0_rgba(255,255,255,0.08)]'
          : 'opacity-75 hover:bg-black/[0.04] hover:opacity-100 dark:hover:bg-white/[0.06]',
      )}
    >
      {dropBefore && <span className="absolute -left-[2px] top-1 bottom-1 w-[3px] rounded bg-blue-500" />}
      {dropAfter && <span className="absolute -right-[2px] top-1 bottom-1 w-[3px] rounded bg-blue-500" />}
      <span className="flex shrink-0 items-center">{label.icon}</span>
      {renaming !== null ? (
        <input
          autoFocus
          aria-label="Rename page"
          value={renaming}
          onChange={(e) => setRenaming(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setRenaming(null)
          }}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="min-w-0 flex-1 rounded bg-white px-1 text-[13px] outline outline-1 outline-blue-400 dark:bg-[#2a2a2a]"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate">{label.title}</span>
      )}
      {!(onlyTab && label.title === 'New tab') && (
        <button
          type="button"
          aria-label={`Close ${label.title}`}
          title={`Close tab (${mod}+W)`}
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className={cn(
            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/15',
            active ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover/tab:opacity-60',
          )}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
