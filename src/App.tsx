import { useEffect } from 'react'
import { FilePlus, Loader2 } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { TopBar } from '@/components/TitleBar/TopBar'
import { PageView } from '@/components/Editor/PageView'
import { SearchModal } from '@/components/Search/SearchModal'
import { TaskMatrix } from '@/components/Tasks/TaskMatrix'
import { GraphView } from '@/components/Graph/GraphView'
import { WhiteboardPage } from '@/components/Whiteboard/WhiteboardPage'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useTaskStore } from '@/stores/useTaskStore'
import { useAppStore } from '@/stores/useAppStore'
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts'
import { useAppZoom } from '@/hooks/useAppZoom'
import { api } from '@/lib/api'
import { autoSaver } from '@/lib/autoSave'

export default function App() {
  const theme = useAppStore((s) => s.theme)
  const isLoaded = useAppStore((s) => s.isLoaded)
  const activePageId = useAppStore((s) => s.activePageId)
  const view = useAppStore((s) => s.view)
  const activePage = useAppStore((s) => s.pages.find((p) => p.id === s.activePageId))
  const activeExists = !!activePage
  const toast = useAppStore((s) => s.toast)
  const { loadPages, createPage } = useAppStore.getState()

  useGlobalShortcuts()
  const zoom = useAppZoom()

  useEffect(() => {
    void loadPages()
    void useTaskStore.getState().load()
    // Clicking a reminder notification opens the task in the matrix.
    return api.tasks.onOpenTask((id) => useAppStore.getState().openTasks(id))
  }, [loadPages])

  // Apply theme class to <html>.
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
  }, [theme])

  // Flush pending debounced saves before the window closes.
  useEffect(() => {
    const off = api.onFlushRequest(() => autoSaver.flushAll())
    const onUnload = () => void autoSaver.flushAll()
    window.addEventListener('beforeunload', onUnload)
    return () => {
      off()
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas-light text-ink-light dark:bg-canvas-dark dark:text-ink-dark">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden" id="canvas-scroll">
          <ErrorBoundary what={view === 'page' ? 'this page' : `the ${view} view`} resetKey={`${view}:${activePageId}`}>
          {!isLoaded ? (
            <div className="flex h-full items-center justify-center opacity-50">
              <Loader2 className="animate-spin" />
            </div>
          ) : view === 'tasks' ? (
            <TaskMatrix />
          ) : view === 'graph' ? (
            <GraphView />
          ) : activePageId && activeExists && activePage?.kind === 'whiteboard' ? (
            <WhiteboardPage key={activePageId} pageId={activePageId} />
          ) : activePageId && activeExists ? (
            <PageView key={activePageId} pageId={activePageId} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 opacity-70">
              <p className="text-sm">No page selected.</p>
              <button
                type="button"
                onClick={() => void createPage(null)}
                className="flex items-center gap-2 rounded-md bg-black/5 px-3 py-1.5 text-sm hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
              >
                <FilePlus size={15} /> Create a page
              </button>
            </div>
          )}
          </ErrorBoundary>
        </div>
      </main>
      <SearchModal />
      {zoom.visible && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-14 z-[300] flex animate-pop-in items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm shadow-lg dark:border-white/10 dark:bg-[#252525]"
        >
          <span className="tabular-nums">Zoom {Math.round(zoom.zoom * 100)}%</span>
          {Math.abs(zoom.zoom - 1) > 0.001 && (
            <button type="button" onClick={zoom.reset} className="rounded px-1.5 py-0.5 text-xs text-blue-600 hover:bg-blue-500/10 dark:text-blue-400">
              Reset
            </button>
          )}
        </div>
      )}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="fixed bottom-6 left-1/2 z-[300] -translate-x-1/2 animate-pop-in rounded-lg bg-[#2f2f2f] px-4 py-2 text-sm text-white shadow-xl dark:bg-[#ebebea] dark:text-[#191919]"
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
