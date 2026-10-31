import { useEffect, useState } from 'react'
import { AlertCircle, Check, CheckSquare, ChevronsRight, FileText, Loader2, Network, Shapes } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { autoSaver, type SaveStatus } from '@/lib/autoSave'
import { isElectron, platform } from '@/lib/api'
import { cn } from '@/lib/utils'
import { WindowControls } from './WindowControls'

/** Top bar of the main canvas: drag region, breadcrumbs, save status and window controls. */
export function TopBar() {
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen)
  const pages = useAppStore((s) => s.pages)
  const activePageId = useAppStore((s) => s.activePageId)
  const view = useAppStore((s) => s.view)
  const { toggleSidebar, setActivePage } = useAppStore.getState()
  const isMac = platform === 'darwin'
  const showWindowControls = isElectron && !isMac

  // Breadcrumb trail from the root to the active page.
  const trail = []
  const byId = new Map(pages.map((p) => [p.id, p]))
  let cur = activePageId && view === 'page' ? byId.get(activePageId) : undefined
  while (cur) {
    trail.unshift(cur)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }

  return (
    <header
      className={cn(
        'drag flex shrink-0 items-center gap-1 pl-3',
        // Keep room for the macOS traffic lights when the sidebar is collapsed.
        isMac && !isSidebarOpen && 'pl-[80px]',
        !showWindowControls && 'pr-3',
      )}
      style={{ height: 'var(--titlebar-h)' }}
    >
      {!isSidebarOpen && (
        <button
          type="button"
          title="Open sidebar (Ctrl+\)"
          aria-label="Open sidebar"
          onClick={toggleSidebar}
          className="no-drag flex h-7 w-7 items-center justify-center rounded-md opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        >
          <ChevronsRight size={17} />
        </button>
      )}

      <nav className="flex min-w-0 flex-1 items-center gap-0.5 text-sm" aria-label="Breadcrumb">
        {view === 'graph' && (
          <span className="flex items-center gap-1.5 px-1.5 py-0.5">
            <Network size={14} className="text-blue-500" /> Graph view
          </span>
        )}
        {view === 'tasks' && (
          <span className="flex items-center gap-1.5 px-1.5 py-0.5">
            <CheckSquare size={14} className="text-blue-500" /> Tasks
          </span>
        )}
        {trail.map((p, i) => (
          <span key={p.id} className="flex min-w-0 items-center gap-0.5">
            {i > 0 && <span className="px-0.5 opacity-30">/</span>}
            <button
              type="button"
              onClick={() => setActivePage(p.id)}
              className="no-drag flex min-w-0 max-w-[200px] items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <span className="shrink-0 text-[14px] leading-none">{p.icon ?? (p.kind === 'whiteboard' ? <Shapes size={14} className="opacity-60" /> : <FileText size={14} className="opacity-60" />)}</span>
              <span className="truncate">{p.title || 'Untitled'}</span>
            </button>
          </span>
        ))}
      </nav>

      <SaveIndicator />
      {showWindowControls && <WindowControls />}
    </header>
  )
}

function SaveIndicator() {
  const [status, setStatus] = useState<SaveStatus>(autoSaver.getStatus())
  useEffect(() => autoSaver.subscribe(setStatus), [])

  if (status === 'idle') return null
  return (
    <div className="flex shrink-0 items-center gap-1.5 px-2 text-xs opacity-50" aria-live="polite">
      {status === 'error' ? (
        <>
          <AlertCircle size={13} className="text-red-500" /> Save failed
        </>
      ) : status === 'saved' ? (
        <>
          <Check size={13} /> Saved
        </>
      ) : (
        <>
          <Loader2 size={13} className="animate-spin" /> Saving…
        </>
      )}
    </div>
  )
}
