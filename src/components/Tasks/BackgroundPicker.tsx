import { useRef, useState } from 'react'
import { Check, PaintBucket } from 'lucide-react'
import { Popover } from '@/components/ui/Popover'
import { STICKY, QUADRANT_BACKGROUNDS, type QuadrantBackground } from '@/lib/quadrantColors'
import { cn } from '@/lib/utils'

/** Paint-bucket button with the quadrant background choices: default tint, white, Sticky Notes colors. */
export function BackgroundPicker({
  value,
  tint,
  label,
  onChange,
  className,
}: {
  value: QuadrantBackground | undefined
  /** The default tint (shown on the "Default" swatch). */
  tint: string
  label: string
  onChange: (bg: QuadrantBackground | null) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const swatch = (id: QuadrantBackground | null) => {
    if (!id) return { background: tint }
    if (id === 'white') return { background: '#ffffff' }
    const s = STICKY[id]
    return { background: `linear-gradient(180deg, ${s.band} 0 34%, ${s.body} 34% 100%)` }
  }
  const name = (id: QuadrantBackground | null) => (!id ? 'Default' : id === 'white' ? 'White' : STICKY[id].label)
  const choices: Array<QuadrantBackground | null> = [null, ...QUADRANT_BACKGROUNDS]

  return (
    <div className={cn('relative', className)}>
      <button
        ref={ref}
        type="button"
        aria-label={`${label} background`}
        aria-expanded={open}
        title="Background"
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 w-6 items-center justify-center rounded-md text-[#57534E] hover:bg-black/5 hover:text-[#1C1917] dark:text-[#BDB7AC] dark:hover:bg-white/10"
      >
        <PaintBucket size={14} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={ref} className="w-60 p-2.5">
        <div className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#57534E] dark:text-[#BDB7AC]">Background</div>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={`${label} background`}>
          {choices.map((id) => {
            const active = (value ?? null) === id
            return (
              <button
                key={id ?? 'default'}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={name(id)}
                onClick={() => {
                  onChange(id)
                  setOpen(false)
                }}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg p-1.5 text-[11px] text-[#44403C] hover:bg-black/[0.04] dark:text-[#D6D3D1] dark:hover:bg-white/[0.06]',
                  active && 'bg-black/[0.05] dark:bg-white/[0.08]',
                )}
              >
                <span className="relative h-9 w-full rounded-md border border-black/10 shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:border-white/15" style={swatch(id)}>
                  {active && (
                    <Check size={14} strokeWidth={3} className={cn('absolute bottom-1 right-1', id === 'charcoal' ? 'text-white' : 'text-[#1C1917]')} />
                  )}
                </span>
                {name(id)}
              </button>
            )
          })}
        </div>
        <p className="mt-2 px-0.5 text-[11px] text-[#6B655E] dark:text-[#A8A29E]">Sticky colors apply in light mode.</p>
      </Popover>
    </div>
  )
}
