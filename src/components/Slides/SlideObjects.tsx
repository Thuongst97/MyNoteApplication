import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/react'
import { GripVertical } from 'lucide-react'
import { Editor } from '@/components/Editor/Editor'
import { InSlideContext } from '@/components/Editor/BlockEditPanel'
import { MAIN_FRAME, MIN_BOX_H, MIN_BOX_W, SLIDE_H, SLIDE_W, buildSteps, snapBox, type Rect, type SlideBox, type SlideData } from '@/lib/presentation'
import { cn } from '@/lib/utils'
import { rectStyle, useAutoFit } from './SlideCanvas'
import { runInsert } from './InsertMenu'
import { registerSlideEditor } from './slidesFind'

/** New boxes waiting for their editor to be filled with a block (box id → slash command title). */
const pendingInserts = new Map<string, string>()
export const requestInsert = (boxId: string, title: string) => pendingInserts.set(boxId, title)

/** What is selected on the slide: the main text area, a box, or nothing. */
export type SlideSelection = 'main' | string | null

export interface ActiveEditor {
  editor: TiptapEditor
  /** The box the editor belongs to (null: the main text area). */
  boxId: string | null
}

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/** A rectangle after dragging `handle` by (dx, dy) slide px; boxes only change width. */
export function dragRect(start: Rect, handle: Handle, dx: number, dy: number, widthOnly: boolean): Rect {
  if (handle === 'move') return { ...start, x: Math.round(start.x + dx), y: Math.round(start.y + dy) }
  let { x, y, w, h } = start
  if (handle.includes('e')) w = Math.max(MIN_BOX_W, start.w + dx)
  if (handle.includes('w')) {
    w = Math.max(MIN_BOX_W, start.w - dx)
    x = start.x + start.w - w
  }
  if (!widthOnly) {
    if (handle.includes('s')) h = Math.max(MIN_BOX_H, start.h + dy)
    if (handle.includes('n')) {
      h = Math.max(MIN_BOX_H, start.h - dy)
      y = start.y + start.h - h
    }
  }
  return { x: Math.round(x), y: Math.round(y), w: Math.round(Math.min(w, SLIDE_W * 1.5)), h: Math.round(h) }
}

/**
 * The editable slide: the main text area and every box, each in a frame that can be moved
 * (drag its edge or grip) and resized (side / corner handles), with snapping guides.
 */
export function SlideEditSurface({
  pageId,
  slide,
  selected,
  onSelect,
  onEditMain,
  onEditBox,
  onFrame,
  onBox,
  onActive,
  onDeleteBox,
}: {
  pageId: string
  slide: SlideData
  selected: SlideSelection
  onSelect: (s: SlideSelection) => void
  onEditMain: (content: JSONContent) => void
  onEditBox: (id: string, content: JSONContent) => void
  onFrame: (frame: Rect) => void
  onBox: (id: string, patch: Partial<SlideBox>) => void
  onActive: (a: ActiveEditor | null) => void
  onDeleteBox: (id: string) => void
}) {
  const [guides, setGuides] = useState<Array<{ axis: 'x' | 'y'; at: number }>>([])
  const frame = slide.frame ?? MAIN_FRAME
  const boxes = slide.boxes ?? []
  const surfaceRef = useRef<HTMLDivElement>(null)
  const boxEls = useRef(new Map<string, HTMLElement>())

  /** Every other object's rectangle (for snapping). */
  const othersThan = (id: string): Rect[] => {
    const out: Rect[] = id === 'main' ? [] : [frame]
    for (const b of boxes) if (b.id !== id) out.push({ x: b.x, y: b.y, w: b.w, h: boxEls.current.get(b.id)?.offsetHeight ?? MIN_BOX_H })
    return out
  }

  // Arrow keys nudge the selected object; Delete removes a selected box; Esc unselects.
  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t?.closest?.('[contenteditable="true"], input, textarea, select')) return
      if (document.body.classList.contains('drawing-open')) return
      const step = e.shiftKey ? 10 : 1
      const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      if (d[e.key]) {
        e.preventDefault()
        const [dx, dy] = d[e.key]
        if (selected === 'main') onFrame({ ...frame, x: frame.x + dx, y: frame.y + dy })
        else {
          const b = boxes.find((x) => x.id === selected)
          if (b) onBox(b.id, { x: b.x + dx, y: b.y + dy })
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== 'main') {
        e.preventDefault()
        onDeleteBox(selected)
      } else if (e.key === 'Escape') onSelect(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, frame, boxes, onFrame, onBox, onDeleteBox, onSelect])

  const steps = buildSteps(slide)
  const boxOrder = (id: string) => {
    const i = steps.findIndex((s) => s.box === id)
    return i < 0 ? null : i + 1
  }

  return (
    <div ref={surfaceRef} className="absolute inset-0" data-testid="slide-edit-surface">
      {/* Clicking the empty slide unselects. */}
      <div className="absolute inset-0" onMouseDown={() => onSelect(null)} />
      <ObjectFrame
        id="main"
        rect={frame}
        selected={selected === 'main'}
        label="Text area"
        onSelect={() => onSelect('main')}
        onCommit={(r) => onFrame(r)}
        snapOthers={() => othersThan('main')}
        onGuides={setGuides}
      >
        <MainEditor pageId={pageId} slide={slide} frame={frame} onEdit={onEditMain} onActive={onActive} onFocus={() => onSelect('main')} />
      </ObjectFrame>
      {boxes.map((b) => (
        <ObjectFrame
          key={b.id}
          id={b.id}
          rect={{ x: b.x, y: b.y, w: b.w, h: 0 }}
          autoHeight
          selected={selected === b.id}
          label="Box"
          badge={boxOrder(b.id)}
          elRef={(el) => (el ? boxEls.current.set(b.id, el) : boxEls.current.delete(b.id))}
          onSelect={() => onSelect(b.id)}
          onCommit={(r) => onBox(b.id, { x: r.x, y: r.y, w: r.w })}
          snapOthers={() => othersThan(b.id)}
          onGuides={setGuides}
        >
          <BoxEditor pageId={pageId} box={b} onEdit={onEditBox} onActive={onActive} onFocus={() => onSelect(b.id)} />
        </ObjectFrame>
      ))}
      {guides.map((g, i) => (
        <div
          key={i}
          className="pointer-events-none absolute z-30 bg-[#e8467c]"
          style={g.axis === 'x' ? { left: g.at - 1, top: 0, width: 2, height: SLIDE_H } : { top: g.at - 1, left: 0, height: 2, width: SLIDE_W }}
          data-testid="snap-guide"
        />
      ))}
    </div>
  )
}

/** Moves / resizes one object; shows its frame when hovered or selected. */
function ObjectFrame({
  id,
  rect,
  autoHeight,
  selected,
  label,
  badge,
  elRef,
  onSelect,
  onCommit,
  snapOthers,
  onGuides,
  children,
}: {
  id: string
  rect: Rect
  autoHeight?: boolean
  selected: boolean
  label: string
  badge?: number | null
  elRef?: (el: HTMLElement | null) => void
  onSelect: () => void
  onCommit: (r: Rect) => void
  snapOthers: () => Rect[]
  onGuides: (g: Array<{ axis: 'x' | 'y'; at: number }>) => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [draft, setDraft] = useState<Rect | null>(null)
  const shown = draft ?? rect

  const start = (handle: Handle) => (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    const el = ref.current!
    // The slide is drawn zoomed: screen px → slide px.
    const surface = el.closest('.slide-surface') as HTMLElement | null
    const scale = surface ? surface.getBoundingClientRect().width / SLIDE_W || 1 : 1
    const startRect = { ...rect, h: autoHeight ? el.offsetHeight : rect.h }
    const sx = e.clientX
    const sy = e.clientY
    let last = startRect
    const move = (ev: PointerEvent) => {
      let next = dragRect(startRect, handle, (ev.clientX - sx) / scale, (ev.clientY - sy) / scale, !!autoHeight)
      // Snap while moving (hold Alt to place freely).
      if (handle === 'move' && !ev.altKey) {
        const s = snapBox(next, snapOthers())
        next = { ...next, x: s.x, y: s.y }
        onGuides(s.guides)
      }
      last = next
      setDraft(next)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      onGuides([])
      setDraft(null)
      if (last !== startRect) onCommit(autoHeight ? { ...last, h: rect.h } : last)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const handles: Handle[] = autoHeight ? ['w', 'e'] : ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
  const pos: Record<Handle, string> = {
    move: '',
    n: 'left-1/2 -top-[7px] -translate-x-1/2 cursor-ns-resize',
    s: 'left-1/2 -bottom-[7px] -translate-x-1/2 cursor-ns-resize',
    e: 'top-1/2 -right-[7px] -translate-y-1/2 cursor-ew-resize',
    w: 'top-1/2 -left-[7px] -translate-y-1/2 cursor-ew-resize',
    ne: '-right-[7px] -top-[7px] cursor-nesw-resize',
    sw: '-left-[7px] -bottom-[7px] cursor-nesw-resize',
    nw: '-left-[7px] -top-[7px] cursor-nwse-resize',
    se: '-right-[7px] -bottom-[7px] cursor-nwse-resize',
  }

  return (
    <div
      ref={(el) => {
        ref.current = el
        elRef?.(el)
      }}
      data-object-id={id}
      className={cn('group/obj', selected ? 'z-20' : 'z-10')}
      style={{ ...rectStyle(autoHeight ? { x: shown.x, y: shown.y, w: shown.w } : shown), zIndex: undefined }}
      onMouseDownCapture={() => !selected && onSelect()}
    >
      {children}
      {/* Frame: a thin outline (hover / selected) with wide invisible edges to drag the object. */}
      <div
        className={cn(
          'pointer-events-none absolute -inset-[6px] rounded-[3px] border-2',
          selected ? 'border-[#2383e2]' : draft ? 'border-[#2383e2]/70' : 'border-transparent group-hover/obj:border-[#2383e2]/40',
        )}
      />
      {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
        <div
          key={side}
          aria-hidden
          onPointerDown={start('move')}
          className={cn(
            'absolute cursor-move',
            side === 'top' && '-left-[8px] -right-[8px] -top-[12px] h-[10px]',
            side === 'bottom' && '-bottom-[12px] -left-[8px] -right-[8px] h-[10px]',
            side === 'left' && '-bottom-[8px] -left-[12px] -top-[8px] w-[10px]',
            side === 'right' && '-bottom-[8px] -right-[12px] -top-[8px] w-[10px]',
          )}
        />
      ))}
      <button
        type="button"
        aria-label={`Move ${label.toLowerCase()}`}
        title={`Drag to move (${label.toLowerCase()}) · Alt: no snapping`}
        onPointerDown={start('move')}
        className={cn(
          'absolute -left-[46px] -top-[8px] flex h-[34px] w-[30px] cursor-move items-center justify-center rounded-md bg-[#2383e2] text-white shadow',
          selected || draft ? 'opacity-100' : 'opacity-0 group-hover/obj:opacity-70',
        )}
      >
        <GripVertical size={22} />
      </button>
      {badge != null && (
        <span className="pointer-events-none absolute -right-[10px] -top-[30px] flex h-[26px] min-w-[26px] items-center justify-center rounded-md bg-[#2383e2] px-1 text-[15px] font-semibold text-white">
          {badge}
        </span>
      )}
      {selected &&
        handles.map((h) => (
          <div
            key={h}
            aria-label={`Resize ${h}`}
            onPointerDown={start(h)}
            className={cn('absolute z-10 h-[14px] w-[14px] rounded-[3px] border-2 border-[#2383e2] bg-white', pos[h])}
          />
        ))}
    </div>
  )
}

/** The editor of the main text area (its blocks shrink to fit its frame). */
function MainEditor({
  pageId,
  slide,
  frame,
  onEdit,
  onActive,
  onFocus,
}: {
  pageId: string
  slide: SlideData
  frame: Rect
  onEdit: (content: JSONContent) => void
  onActive: (a: ActiveEditor | null) => void
  onFocus: () => void
}) {
  const [version, setVersion] = useState(0)
  const { innerRef, zoom } = useAutoFit([version, frame.h], 0.6, frame.h)
  const ready = useEditorTracking(null, onActive, onFocus)
  return (
    <div className="slide-main h-full overflow-y-auto" style={{ height: frame.h }}>
      <style>{animationBadges(slide)}</style>
      <div ref={innerRef} className="slide-content slide-editing" style={{ zoom }}>
        <InSlideContext.Provider value>
          <Editor
            pageId={pageId}
            variant="slide"
            onReady={ready}
            initialContent={slide.content}
            onChange={(json) => {
              onEdit(json)
              setVersion((v) => v + 1)
            }}
          />
        </InSlideContext.Provider>
      </div>
    </div>
  )
}

function BoxEditor({
  pageId,
  box,
  onEdit,
  onActive,
  onFocus,
}: {
  pageId: string
  box: SlideBox
  onEdit: (id: string, content: JSONContent) => void
  onActive: (a: ActiveEditor | null) => void
  onFocus: () => void
}) {
  const ready = useEditorTracking(box.id, onActive, onFocus)
  return (
    <div className="slide-box" data-box-id={box.id}>
      <div className="slide-content slide-box-editing">
        <InSlideContext.Provider value>
          <Editor pageId={pageId} variant="slide" onReady={ready} initialContent={box.content} onChange={(json) => onEdit(box.id, json)} />
        </InSlideContext.Provider>
      </div>
    </div>
  )
}

/** Reports which editor (main area or a box) the user is working in. */
function useEditorTracking(boxId: string | null, onActive: (a: ActiveEditor | null) => void, onFocus: () => void) {
  const editorRef = useRef<TiptapEditor | null>(null)
  const cbs = useRef({ onActive, onFocus })
  cbs.current = { onActive, onFocus }
  useEffect(
    () => () => {
      const ed = editorRef.current
      if (ed) cbs.current.onActive(null)
    },
    [],
  )
  return useCallback(
    (editor: TiptapEditor) => {
      editorRef.current = editor
      // Find in page (Ctrl+F) highlights in this slide's editors.
      registerSlideEditor(boxId ?? 'main', editor)
      // A box just inserted from the Insert menu: put its block in (chart, code…).
      const pending = boxId ? pendingInserts.get(boxId) : undefined
      if (pending && boxId) {
        pendingInserts.delete(boxId)
        setTimeout(() => {
          if (editor.isDestroyed) return
          runInsert(editor, pending)
          cbs.current.onActive({ editor, boxId })
        })
      }
      const focus = () => {
        cbs.current.onActive({ editor, boxId })
        cbs.current.onFocus()
      }
      editor.on('focus', focus)
      // The main text area is the default target (e.g. for animations) until something else is used.
      if (boxId === null) cbs.current.onActive({ editor, boxId })
    },
    [boxId],
  )
}

/** Numbered badges next to blocks of the main text area that animate on click. */
export function animationBadges(slide: SlideData): string {
  const seen = new Map<number, number>()
  buildSteps({ ...slide, animations: slide.animations?.map((a) => ({ ...a, byItem: false })) }).forEach((st, i) => {
    if (st.block >= 0 && !seen.has(st.block)) seen.set(st.block, i + 1)
  })
  return [...seen]
    .map(
      ([block, n]) =>
        `.slide-main .slide-editing .ProseMirror > :nth-child(${block + 1}) { position: relative; }
.slide-main .slide-editing .ProseMirror > :nth-child(${block + 1})::after { content: "${n}"; position: absolute; left: -46px; top: 0.25em; width: 26px; height: 26px; border-radius: 6px; background: #2383e2; color: #fff; font: 600 15px/26px Inter, system-ui, sans-serif; text-align: center; pointer-events: none; }`,
    )
    .join('\n')
}
