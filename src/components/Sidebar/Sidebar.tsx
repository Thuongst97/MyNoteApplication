import { useCallback, useRef } from 'react'
import { CheckSquare, ChevronsLeft, FileDown, Moon, Network, Plus, Search, Shapes, Sun, SquarePen } from 'lucide-react'
import { useTaskStore } from '@/stores/useTaskStore'
import { selectChildren, useAppStore } from '@/stores/useAppStore'
import { platform } from '@/lib/api'
import { cn, isMacLike } from '@/lib/utils'
import { PageTreeItem } from './PageTreeItem'
import { importPageFile } from '@/components/Editor/pageFiles'

export function Sidebar() {
  const pages = useAppStore((s) => s.pages)
  const isOpen = useAppStore((s) => s.isSidebarOpen)
  const width = useAppStore((s) => s.sidebarWidth)
  const theme = useAppStore((s) => s.theme)
  const view = useAppStore((s) => s.view)
  const { toggleSidebar, createPage, setSearchOpen, toggleTheme, setSidebarWidth, openTasks, openGraph } = useAppStore.getState()
  // Badge: open tasks that are overdue or due before the end of today.
  const dueCount = useTaskStore((s) => {
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return s.tasks.filter((t) => !t.completed && t.dueAt !== null && t.dueAt <= end.getTime()).length
  })
  const roots = selectChildren(pages, null)
  const isMac = platform === 'darwin'
  const asideRef = useRef<HTMLElement>(null)

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = useAppStore.getState().sidebarWidth
      document.body.style.cursor = 'col-resize'
      const onMove = (ev: MouseEvent) => setSidebarWidth(startW + ev.clientX - startX)
      const onUp = () => {
        document.body.style.cursor = ''
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [setSidebarWidth],
  )

  return (
    <aside
      ref={asideRef}
      style={{ width: isOpen ? width : 0 }}
      className={cn(
        'group/sidebar relative flex h-full shrink-0 flex-col overflow-hidden bg-sidebar-light text-ink-light/80 transition-[width] duration-200 ease-out dark:bg-sidebar-dark dark:text-ink-dark/80',
        isOpen && 'border-r border-black/5 dark:border-white/5',
      )}
    >
      <div style={{ width }} className="flex h-full flex-col">
        {/* Header / drag region (leaves room for macOS traffic lights) */}
        <div className={cn('drag flex h-11 shrink-0 items-center gap-1 px-2', isMac && 'pl-[78px]')}>
          <div className="min-w-0 flex-1 truncate pl-1 text-sm font-semibold text-ink-light dark:text-ink-dark">
            {!isMac && <span className="mr-1.5">📓</span>}My Notes
          </div>
          <SidebarIconButton label="Close sidebar (Ctrl+\)" onClick={toggleSidebar} className="opacity-0 group-hover/sidebar:opacity-100">
            <ChevronsLeft size={17} />
          </SidebarIconButton>
          <SidebarIconButton label="New page" onClick={() => void createPage(null)}>
            <SquarePen size={16} />
          </SidebarIconButton>
        </div>

        {/* Quick actions */}
        <div className="space-y-px px-1.5 pb-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <Search size={16} className="opacity-70" />
            <span className="flex-1 text-left">Search</span>
            <kbd className="text-[11px] opacity-40">{isMacLike() ? '⌘K' : 'Ctrl+K'}</kbd>
          </button>
          <button
            type="button"
            onClick={() => void createPage(null)}
            className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <Plus size={16} className="opacity-70" />
            <span className="flex-1 text-left">New page</span>
            <kbd className="text-[11px] opacity-40">{isMacLike() ? '⌘N' : 'Ctrl+N'}</kbd>
          </button>
          <button
            type="button"
            onClick={() => openTasks()}
            className={cn(
              'flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
              view === 'tasks' && 'bg-black/[0.06] font-medium text-ink-light dark:bg-white/[0.09] dark:text-white',
            )}
          >
            <CheckSquare size={16} className="opacity-70" />
            <span className="flex-1 text-left">Tasks</span>
            {dueCount > 0 && (
              <span
                title={`${dueCount} task(s) due today or overdue`}
                className="min-w-[18px] rounded-full bg-red-500 px-1.5 text-center text-[11px] font-semibold leading-[18px] text-white"
              >
                {dueCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => openGraph()}
            className={cn(
              'flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
              view === 'graph' && 'bg-black/[0.06] font-medium text-ink-light dark:bg-white/[0.09] dark:text-white',
            )}
          >
            <Network size={16} className="opacity-70" />
            <span className="flex-1 text-left">Graph view</span>
            <kbd className="text-[11px] opacity-40">{isMacLike() ? '⌘⇧G' : 'Ctrl+Shift+G'}</kbd>
          </button>
          <button
            type="button"
            onClick={() => void createPage(null, { kind: 'whiteboard', title: 'Untitled whiteboard' })}
            className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <Shapes size={16} className="opacity-70" />
            <span className="flex-1 text-left">New whiteboard</span>
          </button>
          <button
            type="button"
            title="Import a page file (.ncpage) or a Markdown file"
            onClick={() => void importPageFile(null)}
            className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <FileDown size={16} className="opacity-70" />
            <span className="flex-1 text-left">Import</span>
          </button>
        </div>

        {/* Page tree */}
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-4">
          <div className="px-2 pb-1 pt-2 text-xs font-medium opacity-50">Pages</div>
          <div role="tree" aria-label="Pages">
            {roots.map((p) => (
              <PageTreeItem key={p.id} page={p} depth={0} />
            ))}
          </div>
          {roots.length === 0 && <div className="px-2 py-2 text-sm opacity-50">No pages yet</div>}
        </div>

        {/* Footer */}
        <div className="border-t border-black/5 p-1.5 dark:border-white/5">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            {theme === 'dark' ? <Sun size={16} className="opacity-70" /> : <Moon size={16} className="opacity-70" />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
        </div>
      </div>

      {/* Resize handle */}
      {isOpen && (
        <div
          onMouseDown={startResize}
          onDoubleClick={() => setSidebarWidth(260)}
          className="no-drag absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize transition-colors hover:bg-blue-400/40"
        />
      )}
    </aside>
  )
}

function SidebarIconButton({
  children,
  label,
  onClick,
  className,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'no-drag flex h-7 w-7 items-center justify-center rounded-md opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10',
        className,
      )}
    >
      {children}
    </button>
  )
}
