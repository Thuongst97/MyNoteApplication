import { useEffect, useState } from 'react'
import { AlertCircle, Check, ChevronsRight, Loader2 } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { autoSaver, type SaveStatus } from '@/lib/autoSave'
import { isElectron, platform } from '@/lib/api'
import { cn } from '@/lib/utils'
import { WindowControls } from './WindowControls'
import { PageOptions } from './PageOptions'
import { TabBar } from '@/components/Tabs/TabBar'

/**
 * Top of the main canvas, one row: back/forward, tabs, new tab, save status, page options
 * and window controls; the empty space drags the window.
 */
export function TopBar() {
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen)
  const pages = useAppStore((s) => s.pages)
  const activePageId = useAppStore((s) => s.activePageId)
  const view = useAppStore((s) => s.view)
  const { toggleSidebar } = useAppStore.getState()
  const isMac = platform === 'darwin'
  const showWindowControls = isElectron && !isMac

  const byId = new Map(pages.map((p) => [p.id, p]))

  return (
    <header className="flex shrink-0 flex-col">
      <div
        className={cn(
          'drag flex items-center gap-1 bg-black/[0.035] pl-2 dark:bg-white/[0.035]',
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
            className="no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          >
            <ChevronsRight size={17} />
          </button>
        )}
        <TabBar />
        {/* Free space to drag the window by. */}
        <div className="min-w-6 flex-1 self-stretch" />
        <SaveIndicator />
        {view === 'page' && activePageId && (byId.get(activePageId)?.kind ?? 'doc') === 'doc' && (
          <div className="no-drag">
            <PageOptions pageId={activePageId} />
          </div>
        )}
        {showWindowControls && <WindowControls />}
      </div>

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
