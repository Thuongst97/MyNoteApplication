import { useEffect, useRef, useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COLOR_CHOICES, isHexColor } from '@/components/Editor/chart/chartModel'

interface Props {
  /** The color currently shown (custom or automatic). */
  color: string
  /** The custom color, or null when automatic. */
  custom: string | null | undefined
  onChange: (color: string | null) => void
  label: string
  /** Preset colors (default: the chart palette). */
  choices?: string[]
  /** Text of the button that clears the custom color. */
  autoLabel?: string
  /** 'swatch' (default): a small color square; 'icon': a palette icon button. */
  trigger?: 'swatch' | 'icon'
  /** Which side the palette opens towards. */
  align?: 'left' | 'right'
  className?: string
}

/** Swatch button that opens a small palette: preset colors, a custom color and "Auto". */
export function ColorPicker({
  color,
  custom,
  onChange,
  label,
  choices = COLOR_CHOICES,
  autoLabel = 'Auto',
  trigger = 'swatch',
  align = 'left',
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const swatch = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Focus goes back to the swatch, so the chart editor's shortcuts (Ctrl+Enter, Esc) keep working.
  const close = () => {
    setOpen(false)
    swatch.current?.focus()
  }
  const pick = (c: string | null) => {
    onChange(c)
    close()
  }

  return (
    <div ref={root} className={cn('relative inline-flex', className)}>
      {trigger === 'icon' ? (
        <button
          ref={swatch}
          type="button"
          title={`${label} — change color`}
          aria-label={`Color of ${label}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#6B7280] transition-colors hover:bg-white/80 hover:text-[#1F2937] dark:text-[#9CA3AF] dark:hover:bg-white/10 dark:hover:text-white"
        >
          <Palette size={15} />
        </button>
      ) : (
        <button
          ref={swatch}
          type="button"
          title={`${label} — change color`}
          aria-label={`Color of ${label}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="h-4 w-4 shrink-0 rounded-sm ring-1 ring-black/10 transition-transform hover:scale-110 dark:ring-white/20"
          style={{ background: color }}
        />
      )}
      {open && (
        <div
          role="dialog"
          aria-label={`Color of ${label}`}
          onKeyDown={(e) => {
            // Esc closes the palette only (not the chart editor).
            if (e.key === 'Escape') {
              e.stopPropagation()
              close()
            }
          }}
          className={cn(
            'absolute z-50 w-[184px]',
            trigger === 'icon' ? 'top-8' : 'top-6',
            align === 'right' ? 'right-0' : 'left-0',
            ' rounded-lg border border-black/10 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#252525]',
          )}
        >
          <div className="grid grid-cols-6 gap-1.5">
            {choices.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={`Use ${c}`}
                onClick={() => pick(c)}
                className="flex h-6 w-6 items-center justify-center rounded ring-1 ring-black/10 hover:scale-110 dark:ring-white/15"
                style={{ background: c }}
              >
                {custom?.toLowerCase() === c.toLowerCase() && <Check size={13} className="text-white drop-shadow" />}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 border-t border-black/5 pt-2 text-xs dark:border-white/10">
            <label className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-black/5 dark:hover:bg-white/10">
              <input
                type="color"
                value={isHexColor(custom) ? custom : color}
                onChange={(e) => onChange(e.target.value)}
                aria-label="Custom color"
                className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
              />
              Custom…
            </label>
            <button
              type="button"
              onClick={() => pick(null)}
              className={cn(
                'ml-auto rounded px-1.5 py-0.5 hover:bg-black/5 dark:hover:bg-white/10',
                !custom && 'font-semibold text-blue-600 dark:text-blue-400',
              )}
            >
              {autoLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
