import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { JSONContent, Editor as TiptapEditor } from '@tiptap/react'
import { Check, ChevronDown, Copy, Eraser, Highlighter, LayoutTemplate, Loader2, Paintbrush, PenLine, Play, Plus, Sparkles, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { autoSaver } from '@/lib/autoSave'
import { useAppStore } from '@/stores/useAppStore'
import { Editor } from '@/components/Editor/Editor'
import { InSlideContext } from '@/components/Editor/BlockEditPanel'
import { HIGHLIGHT_COLORS, INK_COLORS, buildSteps, LAYOUTS, SLIDE_BACKGROUNDS, duplicateSlide, moveSlide, newSlide, normalizePresentation, slideTitle, type SlideBackground, type SlideData, type SlideLayout } from '@/lib/presentation'
import { cn } from '@/lib/utils'
import { PAD_X, PAD_Y, SlideFrame, SlideView, useAutoFit } from './SlideCanvas'
import { PresentMode, type ShowInk } from './PresentMode'
import { InkLayer, PEN_WIDTHS, type InkTool } from './InkLayer'
import { AnimationPanel } from './AnimationPanel'

interface DrawState {
  tool: InkTool
  penColor: string
  hlColor: string
  width: number
}

const THUMB_W = 168

/**
 * A presentation page: slide thumbnails on the left, the current slide (editable) in the
 * middle, and a toolbar for new slides, layout, background and Present. Mount with key={pageId}.
 */
export function PresentationPage({ pageId }: { pageId: string }) {
  const meta = useAppStore((s) => s.pages.find((p) => p.id === pageId))
  const [slides, setSlides] = useState<SlideData[] | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [presenting, setPresenting] = useState<number | null>(null)
  const slidesRef = useRef<SlideData[]>([])
  const [draw, setDraw] = useState<DrawState | null>(null)
  const lastDraw = useRef<DrawState>({ tool: 'pen', penColor: INK_COLORS[1], hlColor: HIGHLIGHT_COLORS[0], width: PEN_WIDTHS[0] })
  const [panel, setPanel] = useState(false)
  const [slideEditor, setSlideEditor] = useState<TiptapEditor | null>(null)

  useEffect(() => {
    let cancelled = false
    void autoSaver
      .flush(pageId)
      .then(() => api.readPage(pageId))
      .then((page) => {
        if (cancelled) return
        const p = normalizePresentation(page?.content)
        slidesRef.current = p.slides
        setSlides(p.slides)
        setCurrentId(p.slides[0].id)
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) useAppStore.getState().showToast('Failed to load the presentation')
      })
    return () => {
      cancelled = true
    }
  }, [pageId])

  /** Saves the slides (and shows them unless `quiet`: typing updates thumbnails a bit later). */
  const thumbTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commit = useCallback(
    (next: SlideData[], quiet = false) => {
      slidesRef.current = next
      autoSaver.schedule({ id: pageId, content: { type: 'slides', slides: next } as never })
      if (thumbTimer.current) clearTimeout(thumbTimer.current)
      if (quiet) thumbTimer.current = setTimeout(() => setSlides(slidesRef.current), 200)
      else setSlides(next)
    },
    [pageId],
  )
  useEffect(() => () => void (thumbTimer.current && clearTimeout(thumbTimer.current)), [])

  const list = slides ?? []
  const index = Math.max(0, list.findIndex((s) => s.id === currentId))
  const current = list[index]

  /** Changes one slide (`patch` may be computed from the slide's latest state). */
  const update = (id: string, patch: Partial<SlideData> | ((s: SlideData) => Partial<SlideData>)) =>
    commit(slidesRef.current.map((s) => (s.id === id ? clean({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }) : s)))
  const addSlide = (layout: SlideLayout = 'content') => {
    const s = newSlide(layout)
    if (current) s.background = current.background
    const at = slidesRef.current.findIndex((x) => x.id === currentId) + 1
    commit([...slidesRef.current.slice(0, at), s, ...slidesRef.current.slice(at)])
    setCurrentId(s.id)
  }
  const duplicate = (id: string) => {
    const { slides: next, id: newId } = duplicateSlide(slidesRef.current, id)
    commit(next)
    if (newId) setCurrentId(newId)
  }
  const remove = (id: string) => {
    const all = slidesRef.current
    if (all.length <= 1) return
    const i = all.findIndex((s) => s.id === id)
    const next = all.filter((s) => s.id !== id)
    commit(next)
    if (id === currentId) setCurrentId(next[Math.min(i, next.length - 1)].id)
  }
  const onEdit = useCallback(
    (id: string, content: JSONContent) => commit(slidesRef.current.map((s) => (s.id === id ? { ...s, content } : s)), true),
    [commit],
  )

  /** After a show: ink the presenter chose to keep is added to the slides. */
  const endShow = (at: number, keep?: ShowInk) => {
    setPresenting(null)
    if (keep) commit(slidesRef.current.map((s) => (keep[s.id]?.length ? { ...s, ink: [...(s.ink ?? []), ...keep[s.id]] } : s)))
    const s = slidesRef.current[at]
    if (s) setCurrentId(s.id)
  }
  const setDrawing = (next: DrawState | null) => {
    if (next) lastDraw.current = next
    setDraw(next)
  }

  // Esc leaves drawing mode.
  useEffect(() => {
    if (!draw) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDraw(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draw])

  // F5 presents from the first slide, Shift+F5 from the current one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F5' || presenting !== null || document.body.classList.contains('drawing-open')) return
      e.preventDefault()
      setPresenting(e.shiftKey ? index : 0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, presenting])

  if (!meta) return null
  if (!slides || !current) {
    return (
      <div className="flex h-full items-center justify-center opacity-50">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col" data-testid="presentation-page">
      <Toolbar
        slide={current}
        onAdd={addSlide}
        onLayout={(layout) => update(current.id, { layout })}
        onBackground={(background) => update(current.id, { background })}
        onApplyBackgroundToAll={() => commit(slidesRef.current.map((s) => ({ ...s, background: current.background })))}
        onPresent={(fromCurrent) => setPresenting(fromCurrent ? index : 0)}
        drawing={!!draw}
        onToggleDraw={() => setDrawing(draw ? null : lastDraw.current)}
        animating={panel}
        onToggleAnimations={() => setPanel((p) => !p)}
      />
      {draw && (
        <DrawBar
          draw={draw}
          onChange={setDrawing}
          canClear={!!current.ink?.length}
          onClear={() => update(current.id, { ink: undefined })}
          onDone={() => setDraw(null)}
        />
      )}
      <div className="flex min-h-0 flex-1">
        <Thumbnails
          slides={slides}
          currentId={current.id}
          font={meta.font}
          onSelect={setCurrentId}
          onMove={(id, to) => commit(moveSlide(slidesRef.current, id, to))}
          onDuplicate={duplicate}
          onDelete={remove}
          onAdd={() => addSlide()}
        />
        <Stage>
          {(width) => (
            <SlideFrame slide={current} font={meta.font} width={width} className="rounded-sm shadow-[0_2px_16px_rgba(0,0,0,0.12)] ring-1 ring-black/10 dark:ring-white/10">
              <EditableSlide key={current.id} pageId={pageId} slide={current} onEdit={onEdit} onEditor={setSlideEditor} />
              <InkLayer
                strokes={current.ink ?? []}
                tool={draw?.tool ?? null}
                color={draw?.tool === 'highlighter' ? draw.hlColor : draw?.penColor}
                width={draw?.width}
                onAdd={(st) => update(current.id, (s) => ({ ink: [...(s.ink ?? []), st] }))}
                onErase={(keep) => update(current.id, { ink: keep })}
              />
            </SlideFrame>
          )}
        </Stage>
        {panel && (
          <AnimationPanel
            slide={current}
            editor={slideEditor}
            onChange={(patch) => update(current.id, patch)}
            onTransitionToAll={() => commit(slidesRef.current.map((s) => clean({ ...s, transition: current.transition })))}
            onPreview={() => setPresenting(index)}
            onClose={() => setPanel(false)}
          />
        )}
      </div>
      {presenting !== null && <PresentMode slides={slidesRef.current} font={meta.font} start={presenting} onClose={endShow} />}
    </div>
  )
}

/** The editor of the current slide (its blocks shrink to fit like the read-only views). */
function EditableSlide({
  pageId,
  slide,
  onEdit,
  onEditor,
}: {
  pageId: string
  slide: SlideData
  onEdit: (id: string, content: JSONContent) => void
  onEditor: (editor: TiptapEditor | null) => void
}) {
  const [version, setVersion] = useState(0)
  const { innerRef, zoom } = useAutoFit([version], 0.6)
  useEffect(() => () => onEditor(null), [onEditor])
  return (
    <div className="slide-body overflow-y-auto" style={{ padding: `${PAD_Y}px ${PAD_X}px` }}>
      <style>{animationBadges(slide)}</style>
      <div ref={innerRef} className="slide-content slide-editing" style={{ zoom }}>
        <InSlideContext.Provider value>
        <Editor
          pageId={pageId}
          variant="slide"
          onReady={onEditor}
          initialContent={slide.content}
          onChange={(json) => {
            onEdit(slide.id, json)
            setVersion((v) => v + 1)
          }}
        />
        </InSlideContext.Provider>
      </div>
    </div>
  )
}

/** The area around the current slide; gives its children the largest 16:9 width that fits. */
function Stage({ children }: { children: (width: number) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const pad = 48
      const w = el.clientWidth - pad * 2
      const h = el.clientHeight - pad * 2
      setWidth(Math.max(240, Math.floor(Math.min(w, (h * 16) / 9))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="flex min-w-0 flex-1 items-center justify-center overflow-auto bg-black/[0.035] p-12 dark:bg-white/[0.03]">
      {width > 0 && <div style={{ width }}>{children(width)}</div>}
    </div>
  )
}

function Thumbnails({
  slides,
  currentId,
  font,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onAdd,
}: {
  slides: SlideData[]
  currentId: string
  font?: string | null
  onSelect: (id: string) => void
  onMove: (id: string, to: number) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
}) {
  const [drag, setDrag] = useState<{ id: string; over: number } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const index = slides.findIndex((s) => s.id === currentId)

  // Keep the current slide's thumbnail in view.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-slide-id="${currentId}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [currentId])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const go = (i: number) => {
      const s = slides[Math.max(0, Math.min(slides.length - 1, i))]
      if (s) onSelect(s.id)
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') go(index + 1)
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') go(index - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(slides.length - 1)
    else if (e.key === 'Delete' || e.key === 'Backspace') onDelete(currentId)
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') onDuplicate(currentId)
    else if (e.key === 'Enter') onAdd()
    else return
    e.preventDefault()
  }

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Slides"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex w-[216px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-black/[0.07] px-3 py-4 outline-none dark:border-white/[0.07]"
    >
      {slides.map((s, i) => (
        <div
          key={s.id}
          data-slide-id={s.id}
          role="option"
          aria-selected={s.id === currentId}
          aria-label={`Slide ${i + 1}: ${slideTitle(s, i)}`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('application/x-premiumnote-slide', s.id)
            setDrag({ id: s.id, over: i })
          }}
          onDragOver={(e) => {
            if (!drag) return
            e.preventDefault()
            const r = e.currentTarget.getBoundingClientRect()
            const over = e.clientY < r.top + r.height / 2 ? i : i + 1
            if (over !== drag.over) setDrag({ ...drag, over })
          }}
          onDrop={(e) => {
            if (!drag) return
            e.preventDefault()
            const from = slides.findIndex((x) => x.id === drag.id)
            onMove(drag.id, drag.over > from ? drag.over - 1 : drag.over)
            setDrag(null)
          }}
          onDragEnd={() => setDrag(null)}
          onMouseDown={() => onSelect(s.id)}
          className={cn('group relative flex gap-2', drag?.id === s.id && 'opacity-40')}
        >
          {drag && drag.over === i && drag.id !== s.id && <DropLine top />}
          {drag && drag.over === i + 1 && i === slides.length - 1 && <DropLine />}
          <span className="w-4 shrink-0 pt-0.5 text-right text-[11px] tabular-nums opacity-50">{i + 1}</span>
          <div
            className={cn(
              'relative cursor-pointer overflow-hidden rounded-[5px] ring-1 transition-shadow',
              s.id === currentId ? 'ring-2 ring-blue-500' : 'ring-black/10 hover:ring-black/25 dark:ring-white/10 dark:hover:ring-white/25',
            )}
          >
            {/* Thumbnails are pictures: clicks select the slide, never edit it. */}
            <div className="pointer-events-none">
              <SlideView slide={s} font={font} width={THUMB_W} still />
            </div>
            {(!!s.transition || !!s.animations?.length) && (
              <span className="pointer-events-none absolute bottom-1 left-1 flex h-4 w-4 items-center justify-center rounded bg-black/55 text-white" title="Has animations" aria-hidden>
                <Sparkles size={10} />
              </span>
            )}
            <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
              <ThumbButton label="Duplicate slide" onClick={() => onDuplicate(s.id)}>
                <Copy size={12} />
              </ThumbButton>
              {slides.length > 1 && (
                <ThumbButton label="Delete slide" onClick={() => onDelete(s.id)}>
                  <Trash2 size={12} />
                </ThumbButton>
              )}
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="ml-6 flex items-center justify-center gap-1.5 rounded-[5px] border border-dashed border-black/15 py-2 text-xs opacity-70 hover:bg-black/[0.03] hover:opacity-100 dark:border-white/15 dark:hover:bg-white/[0.04]"
      >
        <Plus size={13} /> New slide
      </button>
    </div>
  )
}

function DropLine({ top }: { top?: boolean }) {
  return <div className={cn('pointer-events-none absolute left-6 right-0 h-0.5 rounded bg-blue-500', top ? '-top-[7px]' : '-bottom-[7px]')} />
}

function ThumbButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="flex h-5 w-5 items-center justify-center rounded bg-white/90 text-ink-light shadow-sm ring-1 ring-black/10 hover:bg-white"
    >
      {children}
    </button>
  )
}

function Toolbar({
  slide,
  onAdd,
  onLayout,
  onBackground,
  onApplyBackgroundToAll,
  onPresent,
  drawing,
  onToggleDraw,
  animating,
  onToggleAnimations,
}: {
  slide: SlideData
  onAdd: (layout: SlideLayout) => void
  onLayout: (layout: SlideLayout) => void
  onBackground: (bg: SlideBackground) => void
  onApplyBackgroundToAll: () => void
  onPresent: (fromCurrent: boolean) => void
  drawing: boolean
  onToggleDraw: () => void
  animating: boolean
  onToggleAnimations: () => void
}) {
  const [menu, setMenu] = useState<'add' | 'layout' | 'background' | 'present' | null>(null)
  const btn = 'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10'
  const toggle = (m: NonNullable<typeof menu>) => setMenu((x) => (x === m ? null : m))

  return (
    <div className="relative z-20 flex h-11 shrink-0 items-center gap-1 border-b border-black/[0.07] px-3 dark:border-white/[0.07]">
      <div className="flex items-center">
        <button type="button" className={cn(btn, 'rounded-r-none pr-2')} onClick={() => onAdd('content')} title="New slide (Enter in the slide list)">
          <Plus size={15} /> New slide
        </button>
        <button type="button" className={cn(btn, 'rounded-l-none px-1')} aria-label="New slide with layout" onClick={() => toggle('add')}>
          <ChevronDown size={14} />
        </button>
        {menu === 'add' && (
          <Menu onClose={() => setMenu(null)}>
            {LAYOUTS.map((l) => (
              <MenuItem key={l.id} onClick={() => (setMenu(null), onAdd(l.id))}>
                <LayoutIcon layout={l.id} /> {l.label}
              </MenuItem>
            ))}
          </Menu>
        )}
      </div>
      <div className="relative">
        <button type="button" className={btn} onClick={() => toggle('layout')}>
          <LayoutTemplate size={15} className="opacity-70" /> Layout
        </button>
        {menu === 'layout' && (
          <Menu onClose={() => setMenu(null)}>
            {LAYOUTS.map((l) => (
              <MenuItem key={l.id} active={slide.layout === l.id} onClick={() => (setMenu(null), onLayout(l.id))}>
                <LayoutIcon layout={l.id} /> {l.label}
              </MenuItem>
            ))}
          </Menu>
        )}
      </div>
      <div className="relative">
        <button type="button" className={btn} onClick={() => toggle('background')}>
          <Paintbrush size={15} className="opacity-70" /> Background
        </button>
        {menu === 'background' && (
          <Menu onClose={() => setMenu(null)} width={232}>
            <div className="grid grid-cols-5 gap-2 p-2" role="radiogroup" aria-label="Slide background">
              {(Object.keys(SLIDE_BACKGROUNDS) as SlideBackground[]).map((id) => {
                const b = SLIDE_BACKGROUNDS[id]
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={slide.background === id}
                    title={b.label}
                    aria-label={b.label}
                    onClick={() => onBackground(id)}
                    className={cn(
                      'h-8 w-8 rounded-md ring-1 ring-black/15 dark:ring-white/20',
                      slide.background === id && 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-[#252525]',
                      !b.color && 'bg-canvas-light dark:bg-canvas-dark',
                    )}
                    style={b.color ? { background: b.color } : undefined}
                  />
                )
              })}
            </div>
            <div className="mx-2 mb-1 border-t border-black/5 pt-1 dark:border-white/10">
              <MenuItem onClick={() => (setMenu(null), onApplyBackgroundToAll())}>Apply to all slides</MenuItem>
            </div>
          </Menu>
        )}
      </div>
      <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
      <button type="button" className={cn(btn, drawing && 'bg-blue-500/15 text-blue-700 dark:text-blue-300')} aria-pressed={drawing} onClick={onToggleDraw} title="Draw on the slide (pen, highlighter)">
        <PenLine size={15} className="opacity-70" /> Draw
      </button>
      <button type="button" className={cn(btn, animating && 'bg-blue-500/15 text-blue-700 dark:text-blue-300')} aria-pressed={animating} onClick={onToggleAnimations} title="Transitions and click animations">
        <Sparkles size={15} className="opacity-70" /> Animations
      </button>
      <div className="flex-1" />
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => onPresent(false)}
          title="Present from the beginning (F5)"
          className="flex h-8 items-center gap-1.5 rounded-l-md bg-[#2383e2] pl-3 pr-2.5 text-sm font-medium text-white hover:bg-[#1f75cb]"
        >
          <Play size={14} fill="currentColor" /> Present
        </button>
        <button
          type="button"
          aria-label="More present options"
          onClick={() => toggle('present')}
          className="flex h-8 items-center rounded-r-md border-l border-white/25 bg-[#2383e2] px-1.5 text-white hover:bg-[#1f75cb]"
        >
          <ChevronDown size={14} />
        </button>
        {menu === 'present' && (
          <Menu onClose={() => setMenu(null)} align="right" width={240}>
            <MenuItem onClick={() => (setMenu(null), onPresent(false))}>
              From the beginning <kbd className="ml-auto text-[11px] opacity-50">F5</kbd>
            </MenuItem>
            <MenuItem onClick={() => (setMenu(null), onPresent(true))}>
              From this slide <kbd className="ml-auto text-[11px] opacity-50">Shift+F5</kbd>
            </MenuItem>
          </Menu>
        )}
      </div>
    </div>
  )
}

function Menu({ children, onClose, align = 'left', width = 200 }: { children: React.ReactNode; onClose: () => void; align?: 'left' | 'right'; width?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    // Opened by this click: listen from the next one.
    const t = setTimeout(() => window.addEventListener('mousedown', onDown))
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  return (
    <div
      ref={ref}
      role="menu"
      className={cn(
        'absolute top-full z-50 mt-1 animate-pop-in rounded-lg border border-black/10 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#252525]',
        align === 'right' ? 'right-0' : 'left-0',
      )}
      style={{ width }}
    >
      {children}
    </div>
  )
}

function MenuItem({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn('flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10', active && 'bg-blue-500/10 text-blue-600 dark:text-blue-400')}
    >
      {children}
    </button>
  )
}

/** A tiny picture of a layout. */
function LayoutIcon({ layout }: { layout: SlideLayout }) {
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" className="shrink-0 opacity-70" aria-hidden>
      <rect x="0.5" y="0.5" width="21" height="13" rx="1.5" fill="none" stroke="currentColor" />
      {layout === 'title' && (
        <>
          <rect x="5" y="5" width="12" height="2" rx="1" fill="currentColor" />
          <rect x="7" y="8.5" width="8" height="1.2" rx="0.6" fill="currentColor" opacity="0.6" />
        </>
      )}
      {layout === 'content' && (
        <>
          <rect x="3" y="3" width="10" height="2" rx="1" fill="currentColor" />
          <rect x="3" y="6.5" width="15" height="1.2" rx="0.6" fill="currentColor" opacity="0.6" />
          <rect x="3" y="9" width="12" height="1.2" rx="0.6" fill="currentColor" opacity="0.6" />
        </>
      )}
    </svg>
  )
}

/** Drops empty optional parts so saved slides stay small. */
function clean(s: SlideData): SlideData {
  const out = { ...s }
  if (!out.ink?.length) delete out.ink
  if (!out.animations?.length) delete out.animations
  if (!out.transition || out.transition === 'none') delete out.transition
  return out
}

/** Numbered badges next to the blocks that animate on click (in the slide editor). */
function animationBadges(slide: SlideData): string {
  const seen = new Map<number, number>()
  buildSteps({ ...slide, animations: slide.animations?.map((a) => ({ ...a, byItem: false })) }).forEach((st, i) => {
    if (!seen.has(st.block)) seen.set(st.block, i + 1)
  })
  return [...seen]
    .map(
      ([block, n]) =>
        `.slide-editing .ProseMirror > :nth-child(${block + 1}) { position: relative; }
.slide-editing .ProseMirror > :nth-child(${block + 1})::after { content: "${n}"; position: absolute; left: -46px; top: 0.25em; width: 26px; height: 26px; border-radius: 6px; background: #2383e2; color: #fff; font: 600 15px/26px Inter, system-ui, sans-serif; text-align: center; pointer-events: none; }`,
    )
    .join('\n')
}

/** Drawing tools under the toolbar: pen, highlighter, eraser, colors, thickness, clear. */
function DrawBar({ draw, onChange, canClear, onClear, onDone }: { draw: DrawState; onChange: (d: DrawState) => void; canClear: boolean; onClear: () => void; onDone: () => void }) {
  const tool = (t: InkTool, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={draw.tool === t}
      onClick={() => onChange({ ...draw, tool: t })}
      className={cn('flex h-7 items-center gap-1 rounded-md px-2 text-xs', draw.tool === t ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300' : 'hover:bg-black/5 dark:hover:bg-white/10')}
    >
      {icon} {label}
    </button>
  )
  const colors = draw.tool === 'highlighter' ? HIGHLIGHT_COLORS : INK_COLORS
  const color = draw.tool === 'highlighter' ? draw.hlColor : draw.penColor
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-black/[0.07] bg-blue-500/[0.04] px-3 dark:border-white/[0.07]" role="toolbar" aria-label="Drawing tools">
      {tool('pen', 'Pen', <PenLine size={14} />)}
      {tool('highlighter', 'Highlighter', <Highlighter size={14} />)}
      {tool('eraser', 'Eraser', <Eraser size={14} />)}
      {draw.tool !== 'eraser' && (
        <>
          <div className="mx-2 h-5 w-px bg-black/10 dark:bg-white/10" />
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Ink color">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`Color ${c}`}
                onClick={() => onChange(draw.tool === 'highlighter' ? { ...draw, hlColor: c } : { ...draw, penColor: c })}
                className={cn('h-5 w-5 rounded-full ring-1 ring-black/15 dark:ring-white/20', color === c && 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-[#191919]')}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="mx-2 h-5 w-px bg-black/10 dark:bg-white/10" />
          <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Thickness">
            {PEN_WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={draw.width === w}
                aria-label={`Thickness ${w}`}
                onClick={() => onChange({ ...draw, width: w })}
                className={cn('flex h-7 w-7 items-center justify-center rounded-md', draw.width === w ? 'bg-blue-500/15' : 'hover:bg-black/5 dark:hover:bg-white/10')}
              >
                <span className="rounded-full bg-current" style={{ width: Math.min(16, w + 2), height: Math.min(16, w + 2) }} />
              </button>
            ))}
          </div>
        </>
      )}
      <div className="flex-1" />
      <button type="button" disabled={!canClear} onClick={onClear} className="flex h-7 items-center gap-1 rounded-md px-2 text-xs hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10">
        <Trash2 size={13} /> Clear slide ink
      </button>
      <button type="button" onClick={onDone} className="ml-1 flex h-7 items-center gap-1 rounded-md bg-[#2383e2] px-2.5 text-xs font-medium text-white hover:bg-[#1f75cb]">
        <Check size={13} /> Done
      </button>
    </div>
  )
}
