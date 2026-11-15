import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckSquare, CodeXml, ChevronsLeft, ChevronsRight, PanelLeft, PanelRight, FileDown, Moon, Network, Plus, Search, Presentation, Shapes, Sun, SquarePen } from 'lucide-react'
import { useTaskStore } from '@/stores/useTaskStore'
import { useAppStore, useChildPages } from '@/stores/useAppStore'
import { isElectron, platform } from '@/lib/api'
import { createPortal } from 'react-dom'
import { WindowControls } from '@/components/TitleBar/WindowControls'
import { cn, isMacLike } from '@/lib/utils'
import { PAGE_DRAG_END, PageTreeItem, pageDrag } from './PageTreeItem'
import { planMove } from '@/lib/pageMove'
import { ThemePicker } from './ThemePicker'
import { importPageFile } from '@/components/Editor/pageFiles'

export function Sidebar() {
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
  const roots = useChildPages(null)
  const [rootDrop, setRootDrop] = useState(false)
  // A drop on a page row (or anywhere) ends the drag without reaching this area: always clear.
  useEffect(() => {
    if (!rootDrop) return
    const clear = () => setRootDrop(false)
    window.addEventListener('dragend', clear, true)
    window.addEventListener(PAGE_DRAG_END, clear)
    return () => {
      window.removeEventListener('dragend', clear, true)
        window.removeEventListener(PAGE_DRAG_END, clear)
    }
  }, [rootDrop])
  const isMac = platform === 'darwin'
  const asideRef = useRef<HTMLElement>(null)
  const side = useAppStore((s) => s.sidebarSide)
  const right = side === 'right'
  const showWindowControls = isElectron && !isMac && right
  // Drag the "My Notes" title to the other half of the window to move the sidebar there.
  const [dockPreview, setDockPreview] = useState<'left' | 'right' | null>(null)
  const startDock = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const x0 = e.clientX
    let moved = false
    const target = (x: number): 'left' | 'right' => (x > window.innerWidth / 2 ? 'right' : 'left')
    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - x0) < 8) return
      moved = true
      document.body.style.cursor = 'grabbing'
      setDockPreview(target(ev.clientX))
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      setDockPreview(null)
      if (moved) useAppStore.getState().setSidebarSide(target(ev.clientX))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = useAppStore.getState().sidebarWidth
      document.body.style.cursor = 'col-resize'
      const dir = useAppStore.getState().sidebarSide === 'right' ? -1 : 1
      const onMove = (ev: MouseEvent) => setSidebarWidth(startW + dir * (ev.clientX - startX))
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
        'group/sidebar relative flex h-full shrink-0 flex-col overflow-hidden bg-sidebar-light text-ink-light transition-[width] duration-200 ease-out dark:bg-sidebar-dark dark:text-ink-dark',
        isOpen && (right ? 'border-l border-black/5 dark:border-white/5' : 'border-r border-black/5 dark:border-white/5'),
      )}
    >
      <div style={{ width }} className="flex h-full flex-col">
        {/* With the sidebar on the right, the window buttons stay in the window's top-right corner. */}
        {showWindowControls && (
          <div className="drag flex shrink-0 items-center justify-end" style={{ height: 'var(--titlebar-h)' }}>
            <WindowControls />
          </div>
        )}
        {/* Header / drag region (leaves room for macOS traffic lights) */}
        <div className={cn('drag flex h-11 shrink-0 items-center gap-1 px-2', isMac && !right && 'pl-[78px]', showWindowControls && 'h-9')}>
          <div className="min-w-0 flex-1 truncate pl-1 text-sm font-semibold text-ink-light dark:text-ink-dark">
            <span
              onPointerDown={startDock}
              title="Drag to move the sidebar to the other side"
              className="no-drag cursor-grab select-none"
            >
              {!isMac && <img src="./app-icon.png" alt="" aria-hidden className="mr-1.5 inline-block h-[18px] w-[18px] -translate-y-px align-middle" draggable={false} />}My Notes
            </span>
          </div>
          <SidebarIconButton
            label={right ? 'Move sidebar to the left' : 'Move sidebar to the right'}
            onClick={() => useAppStore.getState().setSidebarSide(right ? 'left' : 'right')}
            className="opacity-0 group-hover/sidebar:opacity-100"
          >
            {right ? <PanelLeft size={16} /> : <PanelRight size={16} />}
          </SidebarIconButton>
          <SidebarIconButton label="Close sidebar (Ctrl+\)" onClick={toggleSidebar} className="opacity-0 group-hover/sidebar:opacity-100">
            {right ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
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
            <Search size={16} className="opacity-85" />
            <span className="flex-1 text-left">Search</span>
            <kbd className="text-[11px] opacity-50">{isMacLike() ? '⌘⇧F' : 'Ctrl+Shift+F'}</kbd>
          </button>
          <button
            type="button"
            onClick={() => void createPage(null)}
            className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <Plus size={16} className="opacity-85" />
            <span className="flex-1 text-left">New page</span>
            <kbd className="text-[11px] opacity-50">{isMacLike() ? '⌘N' : 'Ctrl+N'}</kbd>
          </button>
          <button
            type="button"
            onClick={() => openTasks()}
            className={cn(
              'flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
              view === 'tasks' && 'bg-black/[0.06] font-medium text-ink-light dark:bg-white/[0.09] dark:text-white',
            )}
          >
            <CheckSquare size={16} className="opacity-85" />
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
            <Network size={16} className="opacity-85" />
            <span className="flex-1 text-left">Graph view</span>
            <kbd className="text-[11px] opacity-50">{isMacLike() ? '⌘⇧G' : 'Ctrl+Shift+G'}</kbd>
          </button>
          <button
            type="button"
            onClick={() => void createPage(null, { kind: 'whiteboard', title: 'Untitled whiteboard' })}
            className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <Shapes size={16} className="opacity-85" />
            <span className="flex-1 text-left">New whiteboard</span>
          </button>
          <button
            type="button"
            onClick={() => void createPage(null, { kind: 'slides', title: 'Untitled presentation' })}
            className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <Presentation size={16} className="opacity-85" />
            <span className="flex-1 text-left">New presentation</span>
          </button>
          <button
            type="button"
            title="A page that is one web page (HTML, CSS, JavaScript), shown full size"
            onClick={() => void createPage(null, { kind: 'html', title: 'Untitled web page' })}
            className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <CodeXml size={16} className="opacity-85" />
            <span className="flex-1 text-left">New web page</span>
          </button>
          <button
            type="button"
            title="Import a page file (.ncpage) or a Markdown file"
            onClick={() => void importPageFile(null)}
            className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <FileDown size={16} className="opacity-85" />
            <span className="flex-1 text-left">Import</span>
          </button>
        </div>

        {/* Page tree */}
        <div
          className={cn('min-h-0 flex-1 overflow-y-auto px-1.5 pb-4', rootDrop && 'bg-[#2383e2]/[0.06]')}
          // Dropping a page on the empty space below the tree makes it a top-level page.
          onDragOver={(e) => {
            const id = pageDrag.id
            if ((e.target as Element).closest?.('[role=treeitem]')) return setRootDrop(false)
            if (!id || !planMove(useAppStore.getState().pages, id, null, 'after')) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            if (!rootDrop) setRootDrop(true)
          }}
          onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setRootDrop(false)}
          onDrop={(e) => {
            setRootDrop(false)
            const id = pageDrag.id
            if (!id) return
            e.preventDefault()
            const plan = planMove(useAppStore.getState().pages, id, null, 'after')
            if (plan) void useAppStore.getState().movePage(id, plan.parentId, plan.order)
            pageDrag.id = null
            window.dispatchEvent(new Event(PAGE_DRAG_END))
          }}
        >
          <div className="px-2 pb-1 pt-2 text-xs font-medium opacity-65">Pages</div>
          <div role="tree" aria-label="Pages">
            {roots.map((p) => (
              <PageTreeItem key={p.id} page={p} depth={0} />
            ))}
          </div>
          {roots.length === 0 && <div className="px-2 py-2 text-sm opacity-50">No pages yet</div>}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-1 border-t border-black/5 p-1.5 dark:border-white/5">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-[30px] min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            {theme === 'dark' ? <Sun size={16} className="opacity-85" /> : <Moon size={16} className="opacity-85" />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <ThemePicker />
        </div>
      </div>

      {/* Resize handle */}
      {isOpen && (
        <div
          onMouseDown={startResize}
          onDoubleClick={() => setSidebarWidth(260)}
          className={cn('no-drag absolute top-0 z-10 h-full w-1 cursor-col-resize transition-colors hover:bg-blue-400/40', right ? 'left-0' : 'right-0')}
        />
      )}
      {dockPreview &&
        createPortal(
          <div
            aria-hidden
            data-dock-preview={dockPreview}
            className={cn('pointer-events-none fixed inset-y-2 z-[400] rounded-xl border-2 border-[#2383e2] bg-[#2383e2]/10', dockPreview === 'right' ? 'right-2' : 'left-2')}
            style={{ width }}
          />,
          document.body,
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
