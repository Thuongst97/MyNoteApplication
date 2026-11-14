import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { SLIDE_THEMES, type SlideTheme, type ThemeId } from '@/lib/slideThemes'
import { starterDeck } from '@/lib/themeDecks'
import { cn } from '@/lib/utils'
import { DeckContext, SlideView, type DeckInfo } from './SlideCanvas'

/** A theme's title slide, as a picture. */
function ThemeThumb({ theme }: { theme: SlideTheme }) {
  const slide = useMemo(() => starterDeck(theme)[0], [theme])
  const deck: DeckInfo = useMemo(() => ({ theme, footer: null, title: '', total: 1, numberOf: () => 1 }), [theme])
  return (
    <DeckContext.Provider value={deck}>
      <div className="pointer-events-none">
        <SlideView slide={slide} still />
      </div>
    </DeckContext.Provider>
  )
}

/**
 * Choose a presentation theme: 7 premium tech & automotive themes (or none). A new deck can
 * start from the theme's sample slides; an existing one just takes on the new look.
 */
export function ThemeGallery({
  current,
  fresh,
  onPick,
  onClose,
}: {
  current: ThemeId | null
  /** The deck is new and empty: offer the sample slides (on by default). */
  fresh: boolean
  onPick: (theme: ThemeId | null, withSamples: boolean) => void
  onClose: () => void
}) {
  const [samples, setSamples] = useState(fresh)
  const [look, setLook] = useState<'all' | 'light' | 'dark'>('all')
  const shown = SLIDE_THEMES.filter((t) => look === 'all' || (look === 'dark') === t.dark)
  useEffect(() => {
    document.body.classList.add('drawing-open')
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('drawing-open')
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Presentation theme" className="flex max-h-full w-full max-w-[1180px] animate-pop-in flex-col rounded-2xl bg-white text-ink-light shadow-2xl dark:bg-[#1f1f1f] dark:text-ink-dark">
        <div className="flex items-start gap-4 px-7 pb-4 pt-6">
          <div className="flex-1">
            <div className="text-xl font-semibold tracking-tight">{fresh ? 'Start your presentation' : 'Presentation theme'}</div>
            <div className="mt-1 text-sm opacity-60">Premium themes for tech & automotive topics. Fonts, colors, cards, charts and the title slide all follow the theme.</div>
          </div>
          <div role="group" aria-label="Show themes" className="flex rounded-lg bg-black/5 p-0.5 text-sm dark:bg-white/10">
            {(
              [
                ['all', 'All'],
                ['light', 'Light'],
                ['dark', 'Dark'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={look === id}
                onClick={() => setLook(id)}
                className={cn('rounded-md px-3 py-1', look === id ? 'bg-white font-medium shadow-sm dark:bg-[#3a3a3a]' : 'opacity-60 hover:opacity-100')}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-md p-1.5 opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <div className="grid min-h-0 grid-cols-2 gap-5 overflow-y-auto px-7 pb-2 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-label={`${t.name} theme`}
              aria-pressed={current === t.id}
              onClick={() => onPick(t.id, samples)}
              className="group text-left"
            >
              <div className={cn('overflow-hidden rounded-xl ring-1 transition-all group-hover:ring-2 group-hover:ring-[#2383e2]', current === t.id ? 'ring-2 ring-[#2383e2]' : 'ring-black/10 dark:ring-white/10')}>
                <ThemeThumb theme={t} />
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
                {t.name}
                {current === t.id && <Check size={14} className="text-[#2383e2]" />}
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-45">{t.tag}</div>
            </button>
          ))}
          <button type="button" aria-label="No theme" aria-pressed={current === null} onClick={() => onPick(null, false)} className="group text-left">
            <div className={cn('flex aspect-video items-center justify-center rounded-xl border-2 border-dashed text-sm opacity-60 transition-all group-hover:opacity-100', current === null ? 'border-[#2383e2]' : 'border-black/15 dark:border-white/15')}>
              Plain (no theme)
            </div>
            <div className="mt-2 text-sm font-semibold">Plain</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-45">Your own style</div>
          </button>
        </div>
        <div className="flex items-center gap-3 border-t border-black/5 px-7 py-4 dark:border-white/10">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={samples} onChange={(e) => setSamples(e.target.checked)} className="accent-[#2383e2]" />
            {fresh ? 'Start with sample slides (title, agenda, key numbers, chart, closing)' : 'Replace my slides with the sample slides'}
          </label>
          <span className="ml-auto text-xs opacity-45">{fresh ? 'You can change the theme any time.' : 'Your content stays; only the look changes.'}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
