import { CheckSquare, FilePlus, FileText, Network, Shapes } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { openPageFromClick } from '@/stores/useTabsStore'

/** What a new tab shows: recently edited pages and quick actions. */
export function NewTabView() {
  const pages = useAppStore((s) => s.pages)
  const { createPage, openTasks, openGraph } = useAppStore.getState()
  const recent = [...pages].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12)
  const byId = new Map(pages.map((p) => [p.id, p]))
  const path = (id: string | null) => {
    const parts: string[] = []
    let cur = id ? byId.get(id) : undefined
    while (cur && parts.length < 3) {
      parts.unshift(cur.title || 'Untitled')
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return parts.join(' / ')
  }
  const action = 'flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm hover:bg-black/[0.04] dark:border-white/10 dark:hover:bg-white/[0.06]'

  return (
    <div className="mx-auto w-full max-w-[720px] px-8 py-14">
      <h1 className="mb-6 text-2xl font-semibold">New tab</h1>
      <div className="mb-8 flex flex-wrap gap-2">
        <button type="button" className={action} onClick={() => void createPage(null)}>
          <FilePlus size={15} className="opacity-70" /> New page
        </button>
        <button type="button" className={action} onClick={() => void createPage(null, { kind: 'whiteboard' })}>
          <Shapes size={15} className="opacity-70" /> New whiteboard
        </button>
        <button type="button" className={action} onClick={() => openTasks()}>
          <CheckSquare size={15} className="opacity-70" /> Tasks
        </button>
        <button type="button" className={action} onClick={() => openGraph()}>
          <Network size={15} className="opacity-70" /> Graph view
        </button>
      </div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide opacity-50">Recently edited</div>
      <ul className="flex flex-col">
        {recent.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={(e) => openPageFromClick(p.id, e)}
              onAuxClick={(e) => e.button === 1 && openPageFromClick(p.id, e)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            >
              <span className="flex w-5 shrink-0 justify-center">{p.icon ?? (p.kind === 'whiteboard' ? <Shapes size={15} className="opacity-60" /> : <FileText size={15} className="opacity-60" />)}</span>
              <span className="truncate">{p.title || 'Untitled'}</span>
              {p.parentId && <span className="ml-auto max-w-[45%] shrink-0 truncate text-xs opacity-40">{path(p.parentId)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
