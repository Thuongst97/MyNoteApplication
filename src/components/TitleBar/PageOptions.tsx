import { useState } from 'react'
import { FileUp, MoreHorizontal, MoveHorizontal, SpellCheck, Type } from 'lucide-react'
import { PAGE_FONTS, pageFont } from '@/lib/pageFont'
import { exportPageToFile } from '@/components/Editor/pageFiles'
import { Popover } from '@/components/ui/Popover'
import { useAppStore } from '@/stores/useAppStore'
import { effectiveWidth, MAX_PAGE_WIDTH, MIN_PAGE_WIDTH, normalizeWidth, WIDTH_PRESETS, widthLabel } from '@/lib/pageWidth'
import { cn } from '@/lib/utils'

/** "•••" menu in the top bar with per-page settings (page width). */
export function PageOptions({ pageId }: { pageId: string }) {
  const page = useAppStore((s) => s.pages.find((p) => p.id === pageId))
  const updatePageMeta = useAppStore((s) => s.updatePageMeta)
  const spellcheck = useAppStore((s) => s.spellcheck)
  const setSpellcheck = useAppStore((s) => s.setSpellcheck)
  const [open, setOpen] = useState(false)
  if (!page) return null
  const width = page.width ?? null
  const available = (document.getElementById('canvas-scroll')?.clientWidth ?? window.innerWidth) || 1200
  const sliderMax = Math.max(MIN_PAGE_WIDTH + 100, Math.min(MAX_PAGE_WIDTH, Math.round(available / 10) * 10))

  return (
    <div className="relative">
      <button
        type="button"
        title="Page options"
        aria-label="Page options"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="no-drag flex h-7 w-7 items-center justify-center rounded-md opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
      >
        <MoreHorizontal size={17} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="right-0 top-9 w-72 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <MoveHorizontal size={15} className="opacity-60" /> Page width
          <span className="ml-auto text-xs font-normal opacity-50">{widthLabel(width)}</span>
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-md bg-black/[0.04] p-0.5 dark:bg-white/[0.06]" role="radiogroup" aria-label="Page width">
          {WIDTH_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              role="radio"
              aria-checked={width === p.value}
              onClick={() => updatePageMeta(pageId, { width: p.value })}
              className={cn(
                'rounded px-1 py-1 text-xs',
                width === p.value ? 'bg-white font-medium shadow-sm dark:bg-[#3a3a3a]' : 'opacity-70 hover:opacity-100',
              )}
            >
              {p.label === 'Full width' ? 'Full' : p.label}
            </button>
          ))}
        </div>
        <input
          type="range"
          aria-label="Custom page width"
          min={MIN_PAGE_WIDTH}
          max={sliderMax}
          step={10}
          value={effectiveWidth(width, sliderMax)}
          onChange={(e) => {
            const v = Number(e.target.value)
            updatePageMeta(pageId, { width: v >= sliderMax ? 'full' : normalizeWidth(v) })
          }}
          className="mt-3 w-full accent-blue-500"
        />
        <p className="mt-1.5 text-[11px] opacity-50">Tip: you can also drag the left or right edge of the page. Double-click the edge to reset.</p>
        {page.kind !== 'whiteboard' && (
          <>
            <div className="-mx-3 my-3 h-px bg-black/5 dark:bg-white/10" />
            <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <Type size={15} className="opacity-60" /> Font
              <span className="ml-auto text-xs font-normal opacity-50">{pageFont(page.font).label}</span>
            </div>
            <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Page font">
              {PAGE_FONTS.map((f) => {
                const active = (page.font ?? null) === f.id
                return (
                  <button
                    key={f.label}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={f.label}
                    onClick={() => updatePageMeta(pageId, { font: f.id })}
                    className={cn(
                      'flex flex-col items-center rounded-md border px-1 pb-1 pt-1.5',
                      active ? 'border-blue-400 bg-blue-500/10' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/10',
                    )}
                  >
                    <span className="text-xl leading-tight" style={{ fontFamily: f.stack, fontSize: f.scale ? `${1.25 * f.scale}rem` : undefined }}>
                      Ag
                    </span>
                    <span className="truncate text-[11px] opacity-60">{f.label}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
        <div className="-mx-3 my-3 h-px bg-black/5 dark:bg-white/10" />
        <label className="-mx-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10" title="Red underlines under misspelled words (all pages)">
          <SpellCheck size={15} className="opacity-60" /> Spell check
          <span className="ml-auto text-[11px] opacity-45">all pages</span>
          <Switch checked={spellcheck} onChange={setSpellcheck} label="Spell check" />
        </label>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            void exportPageToFile(pageId, true)
          }}
          className="-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
        >
          <FileUp size={15} className="opacity-60" /> Export page…
          <span className="ml-auto text-[11px] opacity-45">.ncpage</span>
        </button>
      </Popover>
    </div>
  )
}

/** A small on/off switch. */
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault()
        onChange(!checked)
      }}
      className={cn('relative h-[18px] w-8 shrink-0 rounded-full transition-colors', checked ? 'bg-[#2383e2]' : 'bg-black/20 dark:bg-white/20')}
    >
      <span className={cn('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all', checked ? 'left-[16px]' : 'left-[2px]')} />
    </button>
  )
}
