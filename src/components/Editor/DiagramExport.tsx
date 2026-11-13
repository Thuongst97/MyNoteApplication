import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Copy, Download, ImageDown } from 'lucide-react'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/useAppStore'
import { diagramBackground, diagramSvg, svgToPng } from './pageCopy'

/**
 * "Export" for a rendered diagram (Mermaid, PlantUML): copy it as a picture (pastes into
 * Jira, mail, chat…) or save it as PNG or SVG. `getRoot` returns the element holding its SVG.
 */
export function DiagramExportButton({ getRoot, name }: { getRoot: () => Element | null | undefined; name: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])
  const toast = (m: string) => useAppStore.getState().showToast(m)

  const run = async (what: 'copy' | 'save') => {
    setOpen(false)
    const root = getRoot()
    const svg = diagramSvg(root)
    if (!svg) return toast('The diagram is not drawn yet')
    const bg = diagramBackground(root ?? null)
    try {
      if (what === 'copy') {
        await api.diagrams.copyImage(await svgToPng(svg, bg))
        toast('Diagram copied as an image')
      } else {
        const r = await api.diagrams.save(svg, await svgToPng(svg, bg), name)
        if (r.ok) toast('Diagram saved')
      }
    } catch (err) {
      toast(`Could not export the diagram: ${String((err as Error)?.message ?? err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')}`)
    }
  }

  const item = 'flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2 py-1.5 text-left text-xs hover:bg-black/5 dark:hover:bg-white/10'
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Copy or save the diagram as an image"
        aria-label="Export diagram"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md border border-black/10 bg-white/95 px-2 py-1 text-xs shadow-sm hover:bg-white dark:border-white/10 dark:bg-[#2a2a2a]/95 dark:hover:bg-[#333]"
      >
        <ImageDown size={14} /> Export <ChevronDown size={12} className="opacity-60" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-48 animate-pop-in rounded-lg border border-black/10 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#252525]">
          <button type="button" role="menuitem" className={item} onClick={() => void run('copy')}>
            <Copy size={14} className="opacity-70" /> Copy as image
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => void run('save')}>
            <Download size={14} className="opacity-70" /> Save as PNG or SVG…
          </button>
        </div>
      )}
    </div>
  )
}
