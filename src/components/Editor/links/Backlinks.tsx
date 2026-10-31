import { useEffect, useState } from 'react'
import { ChevronRight, FileText, Link2, Shapes } from 'lucide-react'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'

/** "Linked from" — pages that link to this page. */
export function Backlinks({ pageId }: { pageId: string }) {
  const linksVersion = useAppStore((s) => s.linksVersion)
  const pages = useAppStore((s) => s.pages)
  const [sources, setSources] = useState<string[]>([])
  const [open, setOpen] = useState(true)

  useEffect(() => {
    let cancelled = false
    void api.getLinks().then((edges) => {
      if (!cancelled) setSources([...new Set(edges.filter((e) => e.target === pageId).map((e) => e.source))])
    })
    return () => {
      cancelled = true
    }
  }, [pageId, linksVersion])

  const list = sources.map((id) => pages.find((p) => p.id === id)).filter(Boolean)
  if (list.length === 0) return null
  return (
    <div className="-mt-[26vh] mb-16 border-t border-black/5 pt-3 dark:border-white/10">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 text-sm opacity-60 hover:opacity-100">
        <ChevronRight size={14} className={cn('transition-transform', open && 'rotate-90')} />
        <Link2 size={14} /> Linked from {list.length} page{list.length > 1 ? 's' : ''}
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col">
          {list.map((p) => (
            <button
              key={p!.id}
              type="button"
              onClick={() => useAppStore.getState().setActivePage(p!.id)}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            >
              <span className="flex w-5 justify-center leading-none">
                {p!.icon ?? (p!.kind === 'whiteboard' ? <Shapes size={15} className="opacity-60" /> : <FileText size={15} className="opacity-60" />)}
              </span>
              <span className="truncate underline decoration-black/20 underline-offset-[3px] dark:decoration-white/20">{p!.title || 'Untitled'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
