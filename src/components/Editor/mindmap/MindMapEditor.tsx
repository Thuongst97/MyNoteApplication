import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronsDownUp,
  CornerDownRight,
  ListTree,
  Maximize2,
  Minus,
  NotebookPen,
  Palette,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import type { Theme } from '@/stores/useAppStore'
import { cn, isMacLike } from '@/lib/utils'
import { SERIES_COLORS } from '../chart/chartModel'
import {
  addChild,
  addSibling,
  findNode,
  findParent,
  isDescendant,
  layoutMindMap,
  moveNode,
  navigate,
  PALETTE_SIZE,
  removeNode,
  reorderNode,
  updateNode,
  type MindMap,
} from './mindmapModel'
import { MIND_TOKENS, MindMapSvg } from './MindMapSvg'

interface Props {
  initial: MindMap
  theme: Theme
  /** The saved map, or null when cancelled. */
  onClose: (map: MindMap | null) => void
}

type View = { x: number; y: number; k: number }

/** Full-window, keyboard-driven mind map editor. */
export function MindMapEditor({ initial, theme, onClose }: Props) {
  const [map, setMap] = useState<MindMap>(initial)
  const [past, setPast] = useState<MindMap[]>([])
  const [future, setFuture] = useState<MindMap[]>([])
  const [selected, setSelected] = useState<string>(initial.root.id)
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const [size, setSize] = useState({ w: 1000, h: 700 })
  const [showNotes, setShowNotes] = useState(true)
  const [colorOpen, setColorOpen] = useState(false)
  const [drag, setDrag] = useState<{ id: string; target: string | null; moved: boolean; sx: number; sy: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null)
  const dirty = past.length > 0

  const layout = useMemo(() => layoutMindMap(map), [map])
  const colors = SERIES_COLORS[theme]
  const tokens = MIND_TOKENS[theme]
  const sel = findNode(map.root, selected) ?? map.root
  const mod = isMacLike() ? '⌘' : 'Ctrl'

  /** Applies an edit with undo history. */
  const commit = useCallback((next: MindMap) => {
    setMap((cur) => {
      if (next === cur) return cur
      setPast((p) => [...p.slice(-99), cur])
      setFuture([])
      return next
    })
  }, [])

  const undo = () => {
    if (!past.length) return
    setFuture((f) => [map, ...f])
    setMap(past[past.length - 1])
    setPast((p) => p.slice(0, -1))
  }
  const redo = () => {
    if (!future.length) return
    setPast((p) => [...p, map])
    setMap(future[0])
    setFuture((f) => f.slice(1))
  }
  // Keep the selection valid after undo/redo/delete.
  useEffect(() => {
    if (!findNode(map.root, selected)) setSelected(map.root.id)
  }, [map, selected])

  // ---- sizing / view ----
  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width || 1000, h: e.contentRect.height || 700 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const fit = useCallback(() => {
    const b = layout.bounds
    const w = b.maxX - b.minX + 80
    const h = b.maxY - b.minY + 80
    const k = Math.min(1.4, Math.max(0.2, Math.min(size.w / w, size.h / h)))
    setView({ k, x: -((b.minX + b.maxX) / 2) * k, y: -((b.minY + b.maxY) / 2) * k })
  }, [layout, size])
  const fitted = useRef(false)
  useEffect(() => {
    if (!fitted.current && size.w) {
      fitted.current = true
      fit()
    }
  }, [fit, size])

  // Keep the selected topic on screen.
  useEffect(() => {
    const n = layout.byId.get(selected)
    if (!n) return
    const sx = size.w / 2 + view.x + n.x * view.k
    const sy = size.h / 2 + view.y + n.y * view.k
    const margin = 60
    let dx = 0
    let dy = 0
    if (sx < margin) dx = margin - sx
    if (sx > size.w - margin) dx = size.w - margin - sx
    if (sy < margin) dy = margin - sy
    if (sy > size.h - margin) dy = size.h - margin - sy
    if (dx || dy) setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, layout])

  useEffect(() => {
    document.body.classList.add('drawing-open')
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    rootRef.current?.focus()
    return () => document.body.classList.remove('drawing-open')
  }, [])

  // ---- editing actions ----
  const startEdit = (id: string, text?: string) => setEditing({ id, text: text ?? findNode(map.root, id)?.text ?? '' })
  const finishEdit = (save: boolean) => {
    if (!editing) return
    if (save) {
      const cur = findNode(map.root, editing.id)
      if (cur && cur.text !== editing.text) commit(updateNode(map, editing.id, { text: editing.text.trim() }))
    }
    setEditing(null)
    rootRef.current?.focus()
  }
  const doAddChild = (from = map) => {
    const r = addChild(from, selected)
    commit(r.map)
    setSelected(r.id)
    setEditing({ id: r.id, text: '' })
  }
  const doAddSibling = (from = map) => {
    const r = addSibling(from, selected)
    commit(r.map)
    setSelected(r.id)
    setEditing({ id: r.id, text: '' })
  }
  const doDelete = () => {
    if (selected === map.root.id) return
    const r = removeNode(map, selected)
    commit(r.map)
    setSelected(r.select)
  }
  const doToggle = (id = selected) => {
    const n = findNode(map.root, id)
    if (!n || !n.children.length || id === map.root.id) return
    commit(updateNode(map, id, { collapsed: !n.collapsed }))
  }

  const save = () => {
    if (editing) finishEdit(true)
    onClose(editing ? updateNode(map, editing.id, { text: editing.text.trim() }) : map)
  }
  const cancel = () => {
    if (dirty && !window.confirm('Discard changes to this mind map?')) return
    onClose(null)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (editing) return // handled by the input
    if ((e.target as HTMLElement).closest('input, textarea')) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        save()
      }
      return
    }
    const modKey = e.metaKey || e.ctrlKey
    if (modKey && e.key === 'Enter') return e.preventDefault(), save()
    if (modKey && e.key.toLowerCase() === 'z') return e.preventDefault(), e.shiftKey ? redo() : undo()
    if (modKey && e.key.toLowerCase() === 'y') return e.preventDefault(), redo()
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return e.preventDefault(), commit(reorderNode(map, selected, e.key === 'ArrowUp' ? -1 : 1))
    switch (e.key) {
      case 'Tab':
        e.preventDefault()
        return doAddChild()
      case 'Enter':
        e.preventDefault()
        return doAddSibling()
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        return doDelete()
      case 'F2':
        e.preventDefault()
        return startEdit(selected)
      case 'Home':
        e.preventDefault()
        return setSelected(map.root.id)
      case ' ':
        e.preventDefault()
        return doToggle()
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
        e.preventDefault()
        return setSelected(navigate(map, layout, selected, e.key))
    }
    // Typing a character starts editing the topic, replacing its text (like XMind).
    if (e.key.length === 1 && !modKey && !e.altKey) {
      e.preventDefault()
      startEdit(selected, e.key)
    }
  }

  // ---- pointer: select, drag to move, pan ----
  const toWorld = (cx: number, cy: number) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: (cx - r.left - size.w / 2 - view.x) / view.k, y: (cy - r.top - size.h / 2 - view.y) / view.k }
  }
  const hitTopic = (cx: number, cy: number, exclude: string) => {
    const p = toWorld(cx, cy)
    const moving = findNode(map.root, exclude)
    return (
      layout.nodes.find(
        (n) => n.id !== exclude && !(moving && isDescendant(moving, n.id)) && Math.abs(p.x - n.x) <= n.w / 2 + 6 && Math.abs(p.y - n.y) <= n.h / 2 + 6,
      )?.id ?? null
    )
  }
  const onTopicPointerDown = (id: string, e: React.PointerEvent) => {
    e.stopPropagation()
    if (editing && editing.id !== id) finishEdit(true)
    setSelected(id)
    if (id !== map.root.id) setDrag({ id, target: null, moved: false, sx: e.clientX, sy: e.clientY })
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag) {
      const moved = drag.moved || Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 5
      setDrag({ ...drag, moved, target: moved ? hitTopic(e.clientX, e.clientY, drag.id) : null })
    } else if (panRef.current) {
      const p = panRef.current
      setView((v) => ({ ...v, x: p.vx + e.clientX - p.sx, y: p.vy + e.clientY - p.sy }))
    }
  }
  const onPointerUp = () => {
    if (drag?.moved && drag.target) {
      const target = drag.target
      const r = findParent(map.root, drag.id)
      if (r?.id !== target) commit(moveNode(map, drag.id, target))
    }
    setDrag(null)
    panRef.current = null
  }
  const onWheel = (e: React.WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
      const mx = e.clientX - r.left - size.w / 2
      const my = e.clientY - r.top - size.h / 2
      const k = Math.min(3, Math.max(0.2, view.k * Math.exp(-e.deltaY * 0.0015)))
      setView((v) => ({ k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k }))
    }
  }

  const editingNode = editing ? layout.byId.get(editing.id) : null
  const zoomBy = (f: number) => setView((v) => ({ ...v, k: Math.min(3, Math.max(0.2, v.k * f)), x: v.x * f, y: v.y * f }))
  const btn = 'flex h-8 items-center gap-1.5 rounded-md px-2 text-sm hover:bg-black/5 disabled:opacity-35 disabled:hover:bg-transparent dark:hover:bg-white/10'

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-label="Mind map editor"
      onKeyDown={onKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      onPaste={(e) => e.stopPropagation()}
      className="no-drag fixed inset-0 z-[200] flex flex-col bg-white outline-none dark:bg-[#191919]"
    >
      {/* Toolbar */}
      <div className="drag flex h-12 shrink-0 items-center gap-1 border-b border-black/10 px-3 dark:border-white/10" style={{ paddingLeft: isMacLike() ? 84 : undefined }}>
        <span className="mr-2 flex items-center gap-1.5 text-sm font-medium">
          <ListTree size={16} className="text-blue-500" /> Mind map
        </span>
        <div className="no-drag flex items-center gap-0.5">
          <button type="button" className={btn} onClick={() => doAddChild()} title="Add sub-topic (Tab)">
            <CornerDownRight size={15} /> Sub-topic
          </button>
          <button type="button" className={btn} onClick={() => doAddSibling()} title="Add topic (Enter)">
            <Plus size={15} /> Topic
          </button>
          <button type="button" className={btn} onClick={doDelete} disabled={selected === map.root.id} title="Delete topic (Delete)" aria-label="Delete topic">
            <Trash2 size={15} />
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => doToggle()}
            disabled={selected === map.root.id || !sel.children.length}
            title="Fold / unfold (Space)"
            aria-label="Fold or unfold"
          >
            <ChevronsDownUp size={15} />
          </button>
          <div className="relative">
            <button type="button" className={btn} onClick={() => setColorOpen((o) => !o)} disabled={selected === map.root.id} title="Branch color" aria-label="Branch color">
              <Palette size={15} />
            </button>
            {colorOpen && selected !== map.root.id && (
              <div className="absolute left-0 top-9 z-10 flex animate-pop-in gap-1 rounded-lg border border-black/10 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#252525]">
                {Array.from({ length: PALETTE_SIZE }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Color ${i + 1}`}
                    onClick={() => {
                      // Color is set on the first-level branch the topic belongs to.
                      let branch = sel
                      let parent = findParent(map.root, branch.id)
                      while (parent && parent.id !== map.root.id) {
                        branch = parent
                        parent = findParent(map.root, branch.id)
                      }
                      commit(updateNode(map, branch.id, { color: i }))
                      setColorOpen(false)
                    }}
                    className="h-6 w-6 rounded-full ring-offset-1 hover:ring-2 hover:ring-black/20"
                    style={{ background: colors[i] }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
          <button type="button" className={btn} onClick={undo} disabled={!past.length} title={`Undo (${mod}+Z)`} aria-label="Undo">
            <Undo2 size={15} />
          </button>
          <button type="button" className={btn} onClick={redo} disabled={!future.length} title={`Redo (${mod}+Shift+Z)`} aria-label="Redo">
            <Redo2 size={15} />
          </button>
          <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
          <button
            type="button"
            className={btn}
            onClick={() => commit({ ...map, layout: map.layout === 'balanced' ? 'right' : 'balanced' })}
            title="Switch between both sides and right-only layout"
          >
            {map.layout === 'balanced' ? 'Both sides' : 'Right only'}
          </button>
          <button type="button" className={cn(btn, showNotes && 'text-blue-600 dark:text-blue-400')} onClick={() => setShowNotes((v) => !v)} aria-pressed={showNotes} title="Notes panel">
            <NotebookPen size={15} /> Notes
          </button>
        </div>
        <span className="ml-auto hidden text-xs opacity-40 xl:inline">Tab sub-topic · Enter topic · F2 edit · Space fold · Home center · drag to move</span>
        <button type="button" onClick={cancel} className="no-drag ml-3 flex items-center gap-1 rounded-md px-2.5 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10">
          <X size={14} /> Cancel
        </button>
        <button type="button" onClick={save} className="no-drag flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600">
          <Check size={14} /> Save
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Canvas */}
        <div
          ref={canvasRef}
          className={cn('relative min-w-0 flex-1 touch-none select-none overflow-hidden', panRef.current ? 'cursor-grabbing' : 'cursor-grab')}
          onPointerDown={(e) => {
            if (editing) finishEdit(true)
            panRef.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }
            ;(e.target as Element).setPointerCapture?.(e.pointerId)
            rootRef.current?.focus()
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
        >
          <svg className="h-full w-full" role="img" aria-label="Mind map">
            <g transform={`translate(${size.w / 2 + view.x},${size.h / 2 + view.y}) scale(${view.k})`}>
              <MindMapSvg
                layout={layout}
                theme={theme}
                selectedId={selected}
                dropTargetId={drag?.target}
                draggingId={drag?.moved ? drag.id : null}
                editingId={editing?.id}
                onNodePointerDown={onTopicPointerDown}
                onNodeDoubleClick={(id) => startEdit(id)}
                onToggle={(id) => doToggle(id)}
              />
            </g>
          </svg>

          {/* Inline topic editor */}
          {editing && editingNode && (
            <textarea
              autoFocus
              aria-label="Topic text"
              value={editing.text}
              onChange={(e) => setEditing({ ...editing, text: e.target.value.replace(/\n/g, '') })}
              onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
              onBlur={() => finishEdit(true)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Escape') {
                  e.preventDefault()
                  // Esc finishes editing and keeps the text; a new topic left empty is removed again.
                  const node = findNode(map.root, editing.id)
                  const text = editing.text.trim()
                  setEditing(null)
                  if (node && !node.text && !text && editing.id !== map.root.id) {
                    const r = removeNode(map, editing.id)
                    commit(r.map)
                    setSelected(r.select)
                  } else if (node && node.text !== text) commit(updateNode(map, editing.id, { text }))
                  rootRef.current?.focus()
                } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  const next = updateNode(map, editing.id, { text: editing.text.trim() })
                  setEditing(null)
                  if (e.metaKey || e.ctrlKey) {
                    commit(next)
                    onClose(next)
                  } else if (editing.id === map.root.id) {
                    commit(next)
                    rootRef.current?.focus()
                  } else doAddSibling(next)
                } else if (e.key === 'Tab') {
                  e.preventDefault()
                  const next = updateNode(map, editing.id, { text: editing.text.trim() })
                  setEditing(null)
                  doAddChild(next)
                }
              }}
              rows={1}
              className="absolute z-10 resize-none overflow-hidden rounded-md border-2 border-blue-500 bg-white px-2 text-center outline-none dark:bg-[#252525]"
              style={{
                left: size.w / 2 + view.x + (editingNode.x - editingNode.w / 2) * view.k - 2,
                top: size.h / 2 + view.y + (editingNode.y - editingNode.h / 2) * view.k - 2,
                width: Math.max(140, editingNode.w * view.k + 4),
                height: editingNode.h * view.k + 4,
                fontSize: (editingNode.depth === 0 ? 18 : editingNode.depth === 1 ? 15 : 14) * view.k,
                lineHeight: `${editingNode.h * view.k}px`,
                color: tokens.text,
              }}
            />
          )}

          <div className="absolute bottom-3 left-3 flex gap-1">
            {[
              { label: 'Zoom out', icon: Minus, run: () => zoomBy(1 / 1.2) },
              { label: 'Zoom in', icon: Plus, run: () => zoomBy(1.2) },
              { label: 'Fit to screen', icon: Maximize2, run: fit },
            ].map(({ label, icon: Icon, run }) => (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={label}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={run}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-black/10 bg-white hover:bg-black/5 dark:border-white/10 dark:bg-[#252525] dark:hover:bg-white/10"
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>

        {/* Notes panel: document the selected topic */}
        {showNotes && (
          <aside className="flex w-72 shrink-0 flex-col gap-2 border-l border-black/10 bg-[#f7f7f5] p-3 dark:border-white/10 dark:bg-[#202020]">
            <div className="text-xs font-medium uppercase tracking-wide opacity-50">Selected topic</div>
            <input
              aria-label="Selected topic"
              value={sel.text}
              placeholder={sel.id === map.root.id ? 'Central topic' : 'Topic'}
              onChange={(e) => commit(updateNode(map, sel.id, { text: e.target.value }))}
              className="rounded-md border border-black/10 bg-white px-2 py-1.5 text-sm font-medium outline-none focus:border-blue-400 dark:border-white/10 dark:bg-[#191919]"
            />
            <div className="mt-2 text-xs font-medium uppercase tracking-wide opacity-50">Notes</div>
            <textarea
              aria-label="Topic notes"
              value={sel.note ?? ''}
              placeholder="Document this topic: details, decisions, links…"
              onChange={(e) => commit(updateNode(map, sel.id, { note: e.target.value }))}
              className="min-h-[200px] flex-1 resize-none rounded-md border border-black/10 bg-white p-2 text-sm outline-none focus:border-blue-400 dark:border-white/10 dark:bg-[#191919]"
            />
            <p className="text-xs opacity-45">Topics with notes show a dot; hover them in the page to read the notes.</p>
          </aside>
        )}
      </div>
    </div>
  )
}

export default MindMapEditor
