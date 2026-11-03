import { useRef } from 'react'
import { Pipette, Ban } from 'lucide-react'
import { STANDARD_COLORS, THEME_COLORS, recentColors, rememberColor, sameColor, themeGrid } from '@/lib/colors'
import { cn } from '@/lib/utils'

interface EyeDropperCtor {
  new (): { open: () => Promise<{ sRGBHex: string }> }
}

const label = (hex: string, row: number, col: number) => {
  if (row === 0) return `Theme color ${hex}`
  const base = THEME_COLORS[col]
  return `${base}, variation ${row} (${hex})`
}

/**
 * Office-style color picker: theme colors with lighter/darker variations, standard colors,
 * recent colors, an "Automatic"/"No Fill" choice, the system color dialog and an eyedropper.
 */
export function ColorPalette({
  value,
  onPick,
  noneLabel,
  noneIcon = 'auto',
  moreLabel,
}: {
  value: string | null
  onPick: (color: string | null) => void
  noneLabel: string
  noneIcon?: 'auto' | 'none'
  moreLabel: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pick = (c: string | null) => {
    if (c) rememberColor(c)
    onPick(c)
  }
  const EyeDropper = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper
  const recent = recentColors()
  const grid = themeGrid()

  const swatch = (c: string, title: string, gap?: boolean) => (
    <button
      key={title}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={sameColor(value, c)}
      onClick={() => pick(c)}
      className={cn(
        'h-[15px] w-[15px] border border-black/15 hover:z-10 hover:outline hover:outline-2 hover:outline-orange-400 dark:border-white/20',
        sameColor(value, c) && 'z-10 outline outline-2 outline-orange-500',
        gap && 'mb-1',
      )}
      style={{ background: c }}
    />
  )

  return (
    <div className="w-[214px] text-sm" role="dialog" aria-label={moreLabel.replace(/…$/, '')}>
      <button
        type="button"
        onClick={() => pick(null)}
        className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/10', !value && 'font-medium')}
      >
        {noneIcon === 'none' ? (
          <Ban size={15} className="opacity-60" />
        ) : (
          <span className="h-4 w-4 rounded-sm border border-black/20 bg-black dark:border-white/30 dark:bg-white" />
        )}
        {noneLabel}
      </button>
      <PaletteTitle>Theme Colors</PaletteTitle>
      <div className="grid grid-cols-10 justify-items-center gap-x-[5px] px-2">
        {grid.map((row, r) => row.map((c, i) => swatch(c, label(c, r, i), r === 0)))}
      </div>
      <PaletteTitle>Standard Colors</PaletteTitle>
      <div className="grid grid-cols-10 justify-items-center gap-x-[5px] px-2">{STANDARD_COLORS.map((c) => swatch(c, `Standard color ${c}`))}</div>
      {recent.length > 0 && (
        <>
          <PaletteTitle>Recent Colors</PaletteTitle>
          <div className="grid grid-cols-10 justify-items-center gap-x-[5px] px-2">{recent.map((c) => swatch(c, `Recent color ${c}`))}</div>
        </>
      )}
      <div className="mt-1.5 border-t border-black/10 pt-1 dark:border-white/10">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/10"
        >
          <span className="h-4 w-4 rounded-full" style={{ background: 'conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)' }} />
          {moreLabel}
        </button>
        <input
          ref={inputRef}
          type="color"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          value={value && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '#000000'}
          onChange={(e) => pick(e.target.value.toUpperCase())}
        />
        {EyeDropper && (
          <button
            type="button"
            onClick={() => {
              new EyeDropper()
                .open()
                .then((r) => pick(r.sRGBHex.toUpperCase()))
                .catch(() => {})
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Pipette size={15} className="opacity-70" /> Eyedropper
          </button>
        )}
      </div>
    </div>
  )
}

const PaletteTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-1.5 mt-2 bg-black/[0.04] px-2 py-0.5 text-xs font-semibold dark:bg-white/[0.06]">{children}</div>
)
