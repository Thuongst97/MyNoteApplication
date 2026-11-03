import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import { ChevronDown, Copy, LayoutTemplate, Loader2, Paintbrush, Play, Plus, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { autoSaver } from '@/lib/autoSave'
import { useAppStore } from '@/stores/useAppStore'
import { Editor } from '@/components/Editor/Editor'
import { LAYOUTS, SLIDE_BACKGROUNDS, duplicateSlide, moveSlide, newSlide, normalizePresentation, slideTitle, type SlideBackground, type SlideData, type SlideLayout } from '@/lib/presentation'
import { cn } from '@/lib/utils'
import { PAD_X, PAD_Y, SlideFrame, SlideView, useAutoFit } from './SlideCanvas'
import { PresentMode } from './PresentMode'

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

  const update = (id: string, patch: Partial<SlideData>) => commit(slidesRef.current.map((s) => (s.id === id ? { ...s, ...patch } : s)))
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
      />
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
              <EditableSlide key={current.id} pageId={pageId} slide={current} onEdit={onEdit} />
            </SlideFrame>
          )}
        </Stage>
      </div>
      {presenting !== null && <PresentMode slides={slidesRef.current} font={meta.font} start={presenting} onClose={(at) => {
        setPresenting(null)
        const s = slidesRef.current[at]
        if (s) setCurrentId(s.id)
      }} />}
    </div>
  )
}

/** The editor of the current slide (its blocks shrink to fit like the read-only views). */
function EditableSlide({ pageId, slide, onEdit }: { pageId: string; slide: SlideData; onEdit: (id: string, content: JSONContent) => void }) {
  const [version, setVersion] = useState(0)
  const { innerRef, zoom } = useAutoFit([version], 0.6)
  return (
    <div className="slide-body overflow-y-auto" style={{ padding: `${PAD_Y}px ${PAD_X}px` }}>
      <div ref={innerRef} className="slide-content slide-editing" style={{ zoom }}>
        <Editor
          pageId={pageId}
          variant="slide"
          initialContent={slide.content}
          onChange={(json) => {
            onEdit(slide.id, json)
            setVersion((v) => v + 1)
          }}
        />
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
              <SlideView slide={s} font={font} width={THUMB_W} />
            </div>
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
}: {
  slide: SlideData
  onAdd: (layout: SlideLayout) => void
  onLayout: (layout: SlideLayout) => void
  onBackground: (bg: SlideBackground) => void
  onApplyBackgroundToAll: () => void
  onPresent: (fromCurrent: boolean) => void
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
