import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import { Check, ChevronDown, Copy, Eraser, Eye, EyeOff, Hash, Highlighter, LayoutDashboard, LayoutTemplate, Loader2, Paintbrush, Palette, PenLine, Play, Plus, Sparkles, StickyNote, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { autoSaver } from '@/lib/autoSave'
import { useAppStore } from '@/stores/useAppStore'
import { HIGHLIGHT_COLORS, INK_COLORS, MAIN_FRAME, MIN_BOX_H, MIN_BOX_W, alignRect, type AlignHow, cloneBox, newBox, LAYOUTS, SLIDE_BACKGROUNDS, duplicateSlide, moveSlide, newSlide, normalizePresentation, slideTitle, type FooterSettings, type SlideBackground, type SlideBox, type SlideData, type SlideLayout, type SlideMaster } from '@/lib/presentation'
import { slideTheme, type ThemeId } from '@/lib/slideThemes'
import { themedPresentation } from '@/lib/themeDecks'
import { ThemeGallery } from './ThemeGallery'
import { cn } from '@/lib/utils'
import { DeckContext, SLIDE_W, SlideFrame, SlideView, type DeckInfo } from './SlideCanvas'
import { SlideEditSurface, requestInsert, type ActiveEditor, type SlideSelection } from './SlideObjects'
import { InsertMenu } from './InsertMenu'
import { slidesFindProvider } from './slidesFind'
import { setFindTarget, useFindStore } from '@/stores/useFindStore'
import { blockAtCursor } from './AnimationPanel'
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

/** Deck-wide settings saved with the slides. */
interface DeckSettings {
  theme?: ThemeId
  footer?: FooterSettings
  master?: SlideMaster
}
/** Only the settings that are set (keeps saved pages small). */
const cleanDeck = (d: DeckSettings): DeckSettings => ({ ...(d.theme && { theme: d.theme }), ...(d.footer && { footer: d.footer }), ...(d.master && { master: d.master }) })
/** A master with nothing in it is no master. */
const cleanMaster = (m: SlideMaster): SlideMaster | undefined => {
  const out: SlideMaster = { ...m }
  if (!out.boxes?.length) delete out.boxes
  if (!out.background || out.background === 'default') delete out.background
  if (!out.onTitle) delete out.onTitle
  return out.boxes || out.background || out.onTitle ? out : undefined
}

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
  const [active, setActive] = useState<ActiveEditor | null>(null)
  const [selected, setSelected] = useState<SlideSelection>(null)
  /** Deck-wide settings: theme and footer. */
  const [deckSettings, setDeckSettings] = useState<DeckSettings>({})
  const deckRef = useRef<DeckSettings>({})
  const [gallery, setGallery] = useState<null | { fresh: boolean }>(null)
  /** Editing the slide master instead of a slide. */
  const [masterMode, setMasterMode] = useState(false)
  // A presentation that was just created opens the theme gallery.
  const justCreated = useRef(useAppStore.getState().focusTitleFor === pageId)
  useEffect(() => {
    if (justCreated.current) useAppStore.getState().clearFocusTitle()
  }, [])

  useEffect(() => {
    let cancelled = false
    void autoSaver
      .flush(pageId)
      .then(() => api.readPage(pageId))
      .then((page) => {
        if (cancelled) return
        const p = normalizePresentation(page?.content)
        slidesRef.current = p.slides
        deckRef.current = { theme: p.theme, footer: p.footer, master: p.master }
        setDeckSettings(deckRef.current)
        setSlides(p.slides)
        setCurrentId(p.slides[0].id)
        if (justCreated.current && !p.theme) setGallery({ fresh: true })
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
      autoSaver.schedule({ id: pageId, content: { type: 'slides', slides: next, ...cleanDeck(deckRef.current) } as never })
      if (thumbTimer.current) clearTimeout(thumbTimer.current)
      if (quiet) thumbTimer.current = setTimeout(() => setSlides(slidesRef.current), 200)
      else setSlides(next)
      // An open find bar recounts its matches.
      if (useFindStore.getState().open) useFindStore.getState().contentChanged()
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

  /** Changes the deck's theme / footer (saved with the slides). */
  const updateDeck = (patch: DeckSettings) => {
    deckRef.current = { ...deckRef.current, ...patch }
    setDeckSettings(deckRef.current)
    commit(slidesRef.current)
  }
  const updateDeckRef = useRef(updateDeck)
  updateDeckRef.current = updateDeck
  const pickTheme = (id: ThemeId | null, withSamples: boolean) => {
    setGallery(null)
    const theme = slideTheme(id)
    if (theme && withSamples) {
      const deck = themedPresentation(theme)
      deckRef.current = { theme: deck.theme, footer: deck.footer, master: deckRef.current.master }
      setDeckSettings(deckRef.current)
      commit(deck.slides)
      setCurrentId(deck.slides[0].id)
    } else updateDeck({ theme: theme?.id })
  }
  const deckInfo: DeckInfo = useMemo(() => {
    const ids = (slides ?? []).map((s) => s.id)
    return {
      theme: slideTheme(deckSettings.theme),
      footer: deckSettings.footer ?? null,
      title: meta?.title ?? '',
      total: ids.length,
      numberOf: (id) => ids.indexOf(id) + 1,
      master: deckSettings.master ?? null,
      setFooter: (patch) => {
        const next = { ...(deckRef.current.footer ?? { slideNumbers: false }), ...patch }
        updateDeckRef.current({ footer: next.slideNumbers || next.text || next.date ? next : undefined })
      },
    }
  }, [deckSettings, slides, meta?.title])

  // Objects on the slide: insert, detach, arrange.
  // Another slide: nothing selected (reset while rendering, before the new slide's editors report in).
  const [shownSlide, setShownSlide] = useState(currentId)
  if (shownSlide !== currentId) {
    setShownSlide(currentId)
    setSelected(null)
    setActive(null)
  }
  /** The boxes being edited: the slide master's (master view) or the current slide's. */
  const boxesNow = (): SlideBox[] => (masterMode ? (deckRef.current.master?.boxes ?? []) : (current?.boxes ?? []))
  /** Changes the boxes being edited (master view: the master's, else the current slide's). */
  const editBoxes = (fn: (boxes: SlideBox[]) => SlideBox[], quiet = false) => {
    if (masterMode) {
      const m = deckRef.current.master ?? {}
      const boxes = fn(m.boxes ?? [])
      deckRef.current = { ...deckRef.current, master: cleanMaster({ ...m, boxes }) }
      setDeckSettings(deckRef.current)
      commit(slidesRef.current, quiet)
    } else if (current) {
      if (quiet) commit(slidesRef.current.map((s) => (s.id === current.id ? { ...s, boxes: fn(s.boxes ?? []) } : s)), true)
      else update(current.id, (s) => ({ boxes: fn(s.boxes ?? []) }))
    }
  }
  const deleteBox = (id: string) => {
    if (masterMode) editBoxes((bs) => bs.filter((b) => b.id !== id))
    else update(currentId!, (s) => ({ boxes: s.boxes?.filter((b) => b.id !== id), animations: s.animations?.filter((a) => a.blockId !== id) }))
    setSelected(null)
    setActive((a) => (a?.boxId === id ? null : a))
  }
  const insertBox = (title: string, width: number) => {
    if (!current) return
    const n = boxesNow().length
    const box = newBox({ w: width, x: Math.round((SLIDE_W - width) / 2) + (n % 5) * 24, y: 140 + (n % 5) * 24 })
    requestInsert(box.id, title)
    editBoxes((bs) => [...bs, box])
    setSelected(box.id)
  }
  /** Moves the block with the cursor into its own box, where it is now on the slide. */
  const detachBlock = () => {
    const ed = active?.editor
    if (!ed || ed.isDestroyed || !current || masterMode) return
    const hit = blockAtCursor(ed)
    if (!hit) return
    const dom = ed.view.nodeDOM(hit.pos) as HTMLElement | null
    const surface = dom?.closest('.slide-surface') as HTMLElement | null
    const sr = surface?.getBoundingClientRect()
    const r = dom?.getBoundingClientRect?.()
    const scale = sr && sr.width ? sr.width / SLIDE_W : 1
    const at = sr && r ? { x: Math.round((r.left - sr.left) / scale), y: Math.round((r.top - sr.top) / scale), w: Math.max(MIN_BOX_W, Math.round(r.width / scale)) } : {}
    const json = hit.node.toJSON()
    const box = newBox(at, { type: 'doc', content: [json] })
    // An animated block keeps its animation as an animated box.
    if (typeof json.attrs?.blockId === 'string' && current.animations?.some((a) => a.blockId === json.attrs.blockId)) box.id = json.attrs.blockId
    const tr = ed.state.doc.childCount === 1 ? ed.state.tr.replaceWith(0, ed.state.doc.content.size, ed.schema.nodes.paragraph.create()) : ed.state.tr.delete(hit.pos, hit.pos + hit.node.nodeSize)
    ed.view.dispatch(tr)
    update(current.id, (s) => ({ boxes: [...(s.boxes ?? []), box] }))
    setSelected(box.id)
    setActive(null)
  }
  const arrange = (dir: 1 | -1) => {
    const id = selected
    if (!id || id === 'main' || !current) return
    editBoxes((bs) => {
      const list = [...bs]
      const i = list.findIndex((b) => b.id === id)
      const j = Math.max(0, Math.min(list.length - 1, i + dir))
      if (i < 0 || i === j) return bs
      ;[list[i], list[j]] = [list[j], list[i]]
      return list
    })
  }
  /** Lines the selected box (or the text area) up with the slide's margins or center. */
  const alignSelected = (how: AlignHow) => {
    if (!current || !selected) return
    const el = document.querySelector<HTMLElement>(`[data-testid="slide-edit-surface"] [data-object-id="${selected}"]`)
    const rect = selected === 'main' ? (current.frame ?? MAIN_FRAME) : (() => {
      const b = boxesNow().find((x) => x.id === selected)
      return b ? { x: b.x, y: b.y, w: b.w, h: el?.offsetHeight ?? MIN_BOX_H } : null
    })()
    if (!rect) return
    const to = alignRect(rect, how)
    if (selected === 'main') update(current.id, { frame: { ...(current.frame ?? MAIN_FRAME), x: to.x, y: to.y } })
    else editBoxes((bs) => bs.map((b) => (b.id === selected ? { ...b, x: to.x, y: to.y } : b)))
  }
  const duplicateBox = () => {
    const b = boxesNow().find((x) => x.id === selected)
    if (!b || !current) return
    const copy = cloneBox(b)
    editBoxes((bs) => [...bs, copy])
    setSelected(copy.id)
  }
  const setMasterOpts = (patch: Partial<SlideMaster>) => {
    deckRef.current = { ...deckRef.current, master: cleanMaster({ ...(deckRef.current.master ?? {}), ...patch }) }
    setDeckSettings(deckRef.current)
    commit(slidesRef.current)
  }
  const toggleMaster = () => {
    setMasterMode((m) => !m)
    setSelected(null)
    setActive(null)
    setDraw(null)
  }

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

  // Ctrl+F finds in every slide of this presentation.
  const currentRef = useRef(currentId)
  currentRef.current = currentId
  useEffect(() => {
    const provider = slidesFindProvider({ slides: () => slidesRef.current, currentId: () => currentRef.current, open: setCurrentId })
    const off = setFindTarget(provider)
    return () => {
      off()
      provider.dispose()
    }
  }, [])

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

  // Presenting skips hidden slides.
  const shown = slidesRef.current.filter((s) => !s.hidden)
  const showStart = presenting === null ? 0 : Math.max(0, shown.findIndex((s) => slidesRef.current.indexOf(s) >= presenting))

  return (
    <DeckContext.Provider value={deckInfo}>
    <div className="flex h-full min-w-0 flex-col overflow-hidden" data-testid="presentation-page">
      <Toolbar
        slide={current}
        onAdd={addSlide}
        onLayout={(layout) => update(current.id, { layout })}
        onBackground={(background) => update(current.id, { background })}
        onApplyBackgroundToAll={() => commit(slidesRef.current.map((s) => ({ ...s, background: current.background })))}
        onPresent={(fromCurrent) => setPresenting(fromCurrent ? index : 0)}
        deckTools={
          <>
            <button aria-label="Theme" type="button" className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10" onClick={() => setGallery({ fresh: false })} title="Presentation theme">
              <Palette size={15} className="opacity-70" /> <span className="tb-label">Theme</span>
            </button>
            <FooterMenu footer={deckSettings.footer} title={meta.title} onChange={(footer) => updateDeck({ footer: footer ?? undefined })} />
          </>
        }
        objects={
          <InsertMenu
            onInsert={insertBox}
            canDetach={!!active && !active.editor.isDestroyed}
            onDetach={detachBlock}
            boxSelected={!!selected && selected !== 'main'}
            onForward={() => arrange(1)}
            onBackward={() => arrange(-1)}
            onDuplicateBox={duplicateBox}
            onDeleteBox={() => selected && selected !== 'main' && deleteBox(selected)}
            canAlign={!!selected}
            onAlign={alignSelected}
          />
        }
        masterMode={masterMode}
        onToggleMaster={toggleMaster}
        hideMaster={!!current.hideMaster}
        hasMaster={!!deckSettings.master?.boxes?.length}
        onToggleHideMaster={() => update(current.id, (s) => ({ hideMaster: s.hideMaster ? undefined : true }))}
        drawing={!!draw}
        onToggleDraw={() => setDrawing(draw ? null : lastDraw.current)}
        animating={panel}
        onToggleAnimations={() => setPanel((p) => !p)}
      />
      {masterMode && (
        <MasterBar
          master={deckSettings.master}
          onBackground={(background) => setMasterOpts({ background })}
          onTitle={(onTitle) => setMasterOpts({ onTitle })}
          onClose={toggleMaster}
        />
      )}
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
          onToggleHidden={(id) => update(id, (s) => ({ hidden: s.hidden ? undefined : true }))}
        />
        <div className="flex min-w-0 flex-1 flex-col">
        <Stage>
          {(width) =>
            masterMode ? (
              <SlideFrame
                slide={{ id: '__master', layout: 'content', background: 'default' }}
                font={meta.font}
                width={width}
                editing
                noMaster
                className="rounded-sm shadow-[0_2px_16px_rgba(0,0,0,0.12)] ring-2 ring-[#2383e2]"
              >
                <SlideEditSurface
                  key="__master"
                  pageId={pageId}
                  slide={{ id: '__master', layout: 'content', background: 'default', content: { type: 'doc', content: [] }, boxes: deckSettings.master?.boxes ?? [] }}
                  noMain
                  selected={selected}
                  onSelect={setSelected}
                  onEditMain={() => {}}
                  onEditBox={(id, json) => editBoxes((bs) => bs.map((b) => (b.id === id ? { ...b, content: json } : b)), true)}
                  onFrame={() => {}}
                  onBox={(id, patch) => editBoxes((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)))}
                  onActive={setActive}
                  onDeleteBox={deleteBox}
                />
              </SlideFrame>
            ) : (
            <SlideFrame slide={current} font={meta.font} width={width} editing className="rounded-sm shadow-[0_2px_16px_rgba(0,0,0,0.12)] ring-1 ring-black/10 dark:ring-white/10">
              <SlideEditSurface
                key={current.id}
                pageId={pageId}
                slide={current}
                selected={selected}
                onSelect={setSelected}
                onEditMain={(json) => onEdit(current.id, json)}
                onEditBox={(id, json) => commit(slidesRef.current.map((s) => (s.id === current.id ? { ...s, boxes: s.boxes?.map((b) => (b.id === id ? { ...b, content: json } : b)) } : s)), true)}
                onFrame={(frame) => update(current.id, { frame })}
                onBox={(id, patch) => update(current.id, (s) => ({ boxes: s.boxes?.map((b) => (b.id === id ? { ...b, ...patch } : b)) }))}
                onActive={setActive}
                onDeleteBox={deleteBox}
              />
              <InkLayer
                strokes={current.ink ?? []}
                tool={draw?.tool ?? null}
                color={draw?.tool === 'highlighter' ? draw.hlColor : draw?.penColor}
                width={draw?.width}
                onAdd={(st) => update(current.id, (s) => ({ ink: [...(s.ink ?? []), st] }))}
                onErase={(keep) => update(current.id, { ink: keep })}
              />
            </SlideFrame>
            )
          }
        </Stage>
        <NotesPanel key={current.id} value={current.notes ?? ''} onChange={(notes) => commit(slidesRef.current.map((s) => (s.id === current.id ? { ...s, notes: notes || undefined } : s)), true)} />
        </div>
        {panel && !masterMode && (
          <AnimationPanel
            slide={current}
            editor={active?.editor ?? null}
            boxId={active?.boxId ?? (selected && selected !== 'main' ? selected : null)}
            onChange={(patch) => update(current.id, patch)}
            onTransitionToAll={() => commit(slidesRef.current.map((s) => clean({ ...s, transition: current.transition })))}
            onPreview={() => setPresenting(index)}
            onClose={() => setPanel(false)}
          />
        )}
      </div>
      {presenting !== null && shown.length > 0 && (
        <PresentMode slides={shown} font={meta.font} start={showStart} onClose={(at, keep) => endShow(slidesRef.current.indexOf(shown[at]), keep)} />
      )}
      {gallery && <ThemeGallery current={deckSettings.theme ?? null} fresh={gallery.fresh} onPick={pickTheme} onClose={() => setGallery(null)} />}
    </div>
    </DeckContext.Provider>
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
  onToggleHidden,
}: {
  slides: SlideData[]
  currentId: string
  font?: string | null
  onSelect: (id: string) => void
  onMove: (id: string, to: number) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
  onToggleHidden: (id: string) => void
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
          aria-label={`Slide ${i + 1}: ${slideTitle(s, i)}${s.hidden ? ' (hidden)' : ''}`}
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
            <div className={cn('pointer-events-none', s.hidden && 'opacity-35')}>
              <SlideView slide={s} font={font} width={THUMB_W} still />
            </div>
            {s.hidden && (
              <span className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white" data-testid="hidden-badge">
                <EyeOff size={11} /> Hidden
              </span>
            )}
            {(!!s.transition || !!s.animations?.length) && (
              <span className="pointer-events-none absolute bottom-1 left-1 flex h-4 w-4 items-center justify-center rounded bg-black/55 text-white" title="Has animations" aria-hidden>
                <Sparkles size={10} />
              </span>
            )}
            <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
              <ThumbButton label={s.hidden ? 'Show slide' : 'Hide slide'} onClick={() => onToggleHidden(s.id)}>
                {s.hidden ? <Eye size={12} /> : <EyeOff size={12} />}
              </ThumbButton>
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
  deckTools,
  objects,
  masterMode,
  onToggleMaster,
  hideMaster,
  hasMaster,
  onToggleHideMaster,
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
  deckTools: React.ReactNode
  objects: React.ReactNode
  masterMode: boolean
  onToggleMaster: () => void
  hideMaster: boolean
  hasMaster: boolean
  onToggleHideMaster: () => void
  drawing: boolean
  onToggleDraw: () => void
  animating: boolean
  onToggleAnimations: () => void
}) {
  const [menu, setMenu] = useState<'add' | 'layout' | 'background' | 'present' | null>(null)
  const btn = 'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10'
  const toggle = (m: NonNullable<typeof menu>) => setMenu((x) => (x === m ? null : m))

  return (
    <div className="slide-toolbar relative z-20 flex h-11 min-w-0 shrink-0 items-center gap-1 whitespace-nowrap border-b border-black/[0.07] px-3 dark:border-white/[0.07]">
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
        <button aria-label="Layout" type="button" className={btn} onClick={() => toggle('layout')}>
          <LayoutTemplate size={15} className="opacity-70" /> <span className="tb-label">Layout</span>
        </button>
        {menu === 'layout' && (
          <Menu onClose={() => setMenu(null)}>
            {LAYOUTS.map((l) => (
              <MenuItem key={l.id} active={slide.layout === l.id} onClick={() => (setMenu(null), onLayout(l.id))}>
                <LayoutIcon layout={l.id} /> {l.label}
              </MenuItem>
            ))}
            {hasMaster && (
              <div className="mt-1 border-t border-black/5 pt-1 dark:border-white/10">
                <MenuItem active={hideMaster} onClick={() => (setMenu(null), onToggleHideMaster())}>
                  <EyeOff size={14} className="opacity-70" /> Hide master objects here
                </MenuItem>
              </div>
            )}
          </Menu>
        )}
      </div>
      <div className="relative">
        <button aria-label="Background" type="button" className={btn} onClick={() => toggle('background')}>
          <Paintbrush size={15} className="opacity-70" /> <span className="tb-label">Background</span>
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
      {deckTools}
      <button aria-label="Master" type="button" className={cn(btn, masterMode && 'bg-blue-500/15 text-blue-700 dark:text-blue-300')} aria-pressed={masterMode} onClick={onToggleMaster} title="Slide master: objects shown on every slide">
        <LayoutDashboard size={15} className="opacity-70" /> <span className="tb-label">Master</span>
      </button>
      <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
      {objects}
      <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
      <button aria-label="Draw" type="button" className={cn(btn, drawing && 'bg-blue-500/15 text-blue-700 dark:text-blue-300')} aria-pressed={drawing} onClick={onToggleDraw} title="Draw on the slide (pen, highlighter)">
        <PenLine size={15} className="opacity-70" /> <span className="tb-label">Draw</span>
      </button>
      <button aria-label="Animations" type="button" className={cn(btn, animating && 'bg-blue-500/15 text-blue-700 dark:text-blue-300')} aria-pressed={animating} onClick={onToggleAnimations} title="Transitions and click animations">
        <Sparkles size={15} className="opacity-70" /> <span className="tb-label">Animations</span>
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
  if (!out.boxes?.length) delete out.boxes
  if (!out.animations?.length) delete out.animations
  if (!out.transition || out.transition === 'none') delete out.transition
  return out
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

/** Speaker notes for the current slide (under the slide, like PowerPoint). */
function NotesPanel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(() => !!value)
  const [text, setText] = useState(value)
  return (
    <div className="shrink-0 border-t border-black/[0.07] dark:border-white/[0.07]">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex h-8 w-full items-center gap-1.5 px-4 text-xs font-medium opacity-60 hover:opacity-100">
        <StickyNote size={13} /> Speaker notes {!open && value && <span className="truncate font-normal opacity-70">— {value.split('\n')[0]}</span>}
        <ChevronDown size={13} className={cn('ml-auto transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <textarea
          aria-label="Speaker notes"
          value={text}
          placeholder="Click to add notes for this slide…"
          onChange={(e) => {
            setText(e.target.value)
            onChange(e.target.value)
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="block h-24 w-full resize-none bg-transparent px-4 pb-3 text-sm leading-relaxed outline-none"
        />
      )}
    </div>
  )
}

/** Slide numbers and footer text / date for the whole deck. */
function FooterMenu({ footer, title, onChange }: { footer: FooterSettings | undefined; title: string; onChange: (f: FooterSettings | null) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])
  const f: FooterSettings = footer ?? { slideNumbers: false }
  const set = (patch: Partial<FooterSettings>) => {
    const next = { ...f, ...patch }
    onChange(next.slideNumbers || next.text || next.date ? next : null)
  }
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
  return (
    <div ref={ref} className="relative">
      <button aria-label="Footer" type="button" className={cn('flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10', open && 'bg-black/5 dark:bg-white/10')} onClick={() => setOpen((o) => !o)} title="Slide numbers & footer">
        <Hash size={15} className="opacity-70" /> <span className="tb-label">Footer</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Slide numbers and footer" className="absolute left-0 top-full z-50 mt-1 w-[300px] animate-pop-in rounded-lg border border-black/10 bg-white p-3 text-sm shadow-lg dark:border-white/10 dark:bg-[#252525]">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide opacity-50">On every slide</div>
          <label className="flex cursor-pointer items-center gap-2 py-1">
            <input type="checkbox" checked={f.slideNumbers} onChange={(e) => set({ slideNumbers: e.target.checked })} className="accent-[#2383e2]" /> Slide numbers <span className="ml-auto text-xs opacity-45">03 / 12</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 py-1">
            <input type="checkbox" checked={!!f.text} onChange={(e) => set({ text: e.target.checked ? title || 'Presentation' : undefined })} className="accent-[#2383e2]" /> Footer text
          </label>
          {!!f.text && (
            <input aria-label="Text in footer" value={f.text} onChange={(e) => set({ text: e.target.value || ' ' })} className="mb-1 ml-6 w-[calc(100%-1.5rem)] rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none focus:border-[#2383e2] dark:border-white/15" />
          )}
          <label className="flex cursor-pointer items-center gap-2 py-1">
            <input type="checkbox" checked={!!f.date} onChange={(e) => set({ date: e.target.checked ? today : undefined })} className="accent-[#2383e2]" /> Date
          </label>
          {!!f.date && (
            <input aria-label="Date in footer" value={f.date} onChange={(e) => set({ date: e.target.value || ' ' })} className="mb-1 ml-6 w-[calc(100%-1.5rem)] rounded border border-black/10 bg-transparent px-2 py-1 text-sm outline-none focus:border-[#2383e2] dark:border-white/15" />
          )}
          <div className="my-2 h-px bg-black/5 dark:bg-white/10" />
          <label className="flex cursor-pointer items-center gap-2 py-1">
            <input type="checkbox" checked={f.hideOnTitle !== false} onChange={(e) => set({ hideOnTitle: e.target.checked ? undefined : false })} className="accent-[#2383e2]" /> Don’t show on title slides
          </label>
          <label className="flex cursor-pointer items-center gap-2 py-1">
            <input type="checkbox" checked={f.caps !== false} onChange={(e) => set({ caps: e.target.checked ? undefined : false })} className="accent-[#2383e2]" /> ALL CAPS
          </label>
          <p className="mt-1 text-xs opacity-50">Tip: click the footer on the slide to edit its text.</p>
        </div>
      )}
    </div>
  )
}

/** Slide master view: what master objects are, the master background, title slides, Close. */
function MasterBar({ master, onBackground, onTitle, onClose }: { master?: SlideMaster; onBackground: (b: SlideBackground) => void; onTitle: (on: boolean) => void; onClose: () => void }) {
  const bg = master?.background ?? 'default'
  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-b border-blue-500/25 bg-blue-500/[0.06] px-4 text-sm" role="toolbar" aria-label="Slide master">
      <LayoutDashboard size={15} className="text-[#2383e2]" />
      <span className="font-medium">Slide master</span>
      <span className="master-hint min-w-0 truncate text-xs opacity-60">Objects you add here (logo, tagline, shapes…) appear behind the content of every slide. Use Insert to add them.</span>
      <div className="ml-auto flex items-center gap-1" role="radiogroup" aria-label="Master background">
        <span className="mr-1 text-xs opacity-60">Background</span>
        {(Object.keys(SLIDE_BACKGROUNDS) as SlideBackground[]).map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={bg === id}
            aria-label={`Master background ${SLIDE_BACKGROUNDS[id].label}`}
            title={SLIDE_BACKGROUNDS[id].label}
            onClick={() => onBackground(id)}
            className={cn('h-5 w-5 rounded ring-1 ring-black/15 dark:ring-white/20', bg === id && 'ring-2 ring-[#2383e2] ring-offset-1 dark:ring-offset-[#191919]', !SLIDE_BACKGROUNDS[id].color && 'bg-canvas-light dark:bg-canvas-dark')}
            style={SLIDE_BACKGROUNDS[id].color ? { background: SLIDE_BACKGROUNDS[id].color! } : undefined}
          />
        ))}
      </div>
      <label className="flex cursor-pointer items-center gap-1.5 text-xs">
        <input type="checkbox" checked={!!master?.onTitle} onChange={(e) => onTitle(e.target.checked)} className="accent-[#2383e2]" /> Also on title slides
      </label>
      <button type="button" onClick={onClose} className="flex h-7 items-center gap-1 rounded-md bg-[#2383e2] px-2.5 text-xs font-medium text-white hover:bg-[#1f75cb]">
        <Check size={13} /> Close master
      </button>
    </div>
  )
}
