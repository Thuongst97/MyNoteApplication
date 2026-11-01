import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import type { Slice } from '@tiptap/pm/model'
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Copy, GripVertical, Link2, ListTree, Plus, Trash2 } from 'lucide-react'
import { ensureBlockId, REFERENCEABLE } from './links/BlockIds'
import { pageUrl } from '@/lib/links'
import { useAppStore } from '@/stores/useAppStore'
import { listToMindMap } from './mindmap/mindmapModel'
import { MenuItem, Popover } from '@/components/ui/Popover'
import { cn, isMacLike } from '@/lib/utils'
import { blockAt, blockDrag, computeBlockDrop, deleteBlock, duplicateBlock, moveBlock, performBlockDrop, type BlockTarget } from './blockMove'

interface HandleState extends BlockTarget {
  top: number
  left: number
  /** Block box relative to the container, used to keep the handle steady while reaching for it. */
  box: { top: number; bottom: number; textLeft: number }
}

const ALIGNABLE = new Set(['image', 'mermaid', 'chart', 'drawing', 'mindmap'])

/**
 * Notion-style block handle: hover a block to show "+" and a "⋮⋮" grip.
 * Drag the grip to move the block (a blue line shows where it lands);
 * click it for a menu (move, duplicate, delete, align).
 */
export function BlockHandle({ editor, containerRef, pageId }: { editor: Editor; containerRef: React.RefObject<HTMLDivElement>; pageId: string }) {
  const [state, setState] = useState<HandleState | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dropLine, setDropLine] = useState<{ top: number; left: number; width: number } | null>(null)
  const frozen = useRef(false)
  frozen.current = menuOpen || dragging
  const stateRef = useRef<HandleState | null>(null)
  stateRef.current = state

  const locate = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current
      if (!container || editor.isDestroyed) return
      const view = editor.view
      const content = view.dom.getBoundingClientRect()
      const x = Math.min(Math.max(clientX, content.left + 2), content.right - 2)
      const hit = view.posAtCoords({ left: x, top: clientY })
      if (!hit) return setState(null)
      const target = blockAt(view.state, hit.inside >= 0 ? hit.inside : hit.pos)
      if (!target) return setState(null)
      const dom = view.nodeDOM(target.pos) as HTMLElement | null
      if (!dom?.getBoundingClientRect) return setState(null)
      const rect = dom.getBoundingClientRect()
      const box = container.getBoundingClientRect()
      // Align the handle with the block's first line.
      const firstLine = (dom.matches('li') ? dom.querySelector('p') : dom) ?? dom
      const lh = parseFloat(getComputedStyle(firstLine).lineHeight)
      const lineHeight = Number.isFinite(lh) ? Math.min(lh, rect.height) : 24
      const isItem = target.node.type.name === 'listItem' || target.node.type.name === 'taskItem'
      setState({
        ...target,
        top: rect.top - box.top + Math.max(0, (lineHeight - 24) / 2),
        left: (isItem ? rect.left : content.left) - box.left - 50,
        box: { top: rect.top - box.top, bottom: rect.bottom - box.top, textLeft: rect.left - box.left },
      })
    },
    [editor, containerRef],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onMove = (e: MouseEvent) => {
      if (frozen.current) return
      // Moving left toward the handle (still level with its block): keep it where it is,
      // otherwise e.g. a list's bullet area would re-target the whole list.
      const cur = stateRef.current
      if (cur) {
        const box = container.getBoundingClientRect()
        const x = e.clientX - box.left
        const y = e.clientY - box.top
        if (y >= cur.box.top - 4 && y <= cur.box.bottom + 4 && x < cur.box.textLeft && x >= cur.left - 8) return
      }
      locate(e.clientX, e.clientY)
    }
    const onLeave = () => !frozen.current && setState(null)
    // Hide while typing, like Notion.
    const onKey = () => !frozen.current && setState(null)
    // While dragging a block by its handle: show our own drop line, and accept drops in the gutter too.
    const onDragOver = (e: DragEvent) => {
      const source = blockDrag.current
      if (!source) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      const drop = computeBlockDrop(editor.view, source, e.clientX, e.clientY)
      const box = container.getBoundingClientRect()
      setDropLine(drop ? { top: drop.line.top - box.top, left: drop.line.left - box.left, width: drop.line.width } : null)
    }
    const onDrop = (e: DragEvent) => {
      const source = blockDrag.current
      setDropLine(null)
      if (!source || e.defaultPrevented) return
      e.preventDefault()
      const drop = computeBlockDrop(editor.view, source, e.clientX, e.clientY)
      if (drop) performBlockDrop(editor.view, source, drop)
      blockDrag.current = null
    }
    container.addEventListener('dragover', onDragOver)
    container.addEventListener('drop', onDrop)
    container.addEventListener('mousemove', onMove)
    container.addEventListener('mouseleave', onLeave)
    editor.view.dom.addEventListener('keydown', onKey)
    return () => {
      container.removeEventListener('dragover', onDragOver)
      container.removeEventListener('drop', onDrop)
      container.removeEventListener('mousemove', onMove)
      container.removeEventListener('mouseleave', onLeave)
      editor.view.dom.removeEventListener('keydown', onKey)
    }
  }, [containerRef, editor, locate])

  // The block may have moved/changed after an edit; drop stale handles.
  useEffect(() => {
    const onUpdate = () => {
      if (!frozen.current) setState(null)
    }
    editor.on('update', onUpdate)
    return () => void editor.off('update', onUpdate)
  }, [editor])

  const line = dropLine && (
    <div
      className="pointer-events-none absolute z-30 h-[3px] rounded-full bg-[#2383e2]"
      style={{ top: dropLine.top - 1, left: dropLine.left, width: dropLine.width }}
    />
  )

  if (!state) return line || null

  /** Re-read the node at the stored position (the document may have changed). */
  const current = (): BlockTarget | null => {
    const node = editor.state.doc.nodeAt(state.pos)
    return node && node.type === state.node.type ? { pos: state.pos, node } : null
  }

  const selectBlock = () => {
    const t = current()
    if (!t) return
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, t.pos)))
    editor.view.focus()
  }

  const onDragStart = (e: React.DragEvent) => {
    const t = current()
    if (!t) return
    const view = editor.view
    const sel = NodeSelection.create(view.state.doc, t.pos)
    view.dispatch(view.state.tr.setSelection(sel))
    const slice = sel.content()
    const { dom, text } = view.serializeForClipboard(slice)
    e.dataTransfer.clearData()
    e.dataTransfer.setData('text/html', dom.innerHTML)
    e.dataTransfer.setData('text/plain', text)
    e.dataTransfer.effectAllowed = 'copyMove'
    const blockDom = view.nodeDOM(t.pos) as HTMLElement | null
    if (blockDom) e.dataTransfer.setDragImage(blockDom, 0, 0)
    // ProseMirror needs `dragging` set to treat this as an internal drag; the actual move is done
    // by performBlockDrop (via the editor's handleDrop), which places blocks by top/bottom half.
    ;(view as unknown as { dragging: { slice: Slice; move: boolean; node: NodeSelection } | null }).dragging = {
      slice,
      move: true,
      node: sel,
    }
    blockDrag.current = t
    document.body.classList.add('block-dragging')
    setDragging(true)
  }

  const onDragEnd = () => {
    const view = editor.view as unknown as { dragging: unknown }
    setTimeout(() => {
      view.dragging = null
      blockDrag.current = null
    }, 50)
    document.body.classList.remove('block-dragging')
    setDropLine(null)
    setDragging(false)
    setState(null)
  }

  const addBelow = () => {
    const t = current()
    if (!t) return
    // New line after the top-level block, with "/" typed to open the block menu.
    const $pos = editor.state.doc.resolve(t.pos)
    const top = $pos.depth >= 1 ? $pos.before(1) : t.pos
    const end = top + editor.state.doc.nodeAt(top)!.nodeSize
    editor.chain().insertContentAt(end, { type: 'paragraph' }).setTextSelection(end + 1).insertContent('/').focus().run()
    setState(null)
  }

  const run = (fn: (t: BlockTarget) => void) => {
    const t = current()
    setMenuOpen(false)
    setState(null)
    if (t) fn(t)
  }

  const setAlign = (align: 'left' | 'center' | 'right') =>
    run((t) => {
      editor.view.dispatch(editor.state.tr.setNodeMarkup(t.pos, undefined, { ...t.node.attrs, align }))
    })

  const align = state.node.attrs.align as string | undefined
  const mod = isMacLike() ? '⌘' : 'Ctrl'

  return (
    <>
    {line}
    <div
      className={cn('no-drag absolute z-20 flex items-center gap-0.5 transition-opacity', dragging && 'opacity-40')}
      style={{ top: state.top, left: state.left }}
      contentEditable={false}
    >
      <button
        type="button"
        title="Add a block below"
        aria-label="Add a block below"
        onMouseDown={(e) => e.preventDefault()}
        onClick={addBelow}
        className="flex h-6 w-6 items-center justify-center rounded text-ink-light/35 hover:bg-black/5 hover:text-ink-light/70 dark:text-ink-dark/35 dark:hover:bg-white/10 dark:hover:text-ink-dark/70"
      >
        <Plus size={17} />
      </button>
      <div className="relative">
        <div
          role="button"
          tabIndex={-1}
          draggable
          title={`Drag to move · Click for options`}
          aria-label="Drag to move, click for options"
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => {
            selectBlock()
            setMenuOpen((o) => !o)
          }}
          data-block-handle
          className="flex h-6 w-5 cursor-grab items-center justify-center rounded text-ink-light/35 hover:bg-black/5 hover:text-ink-light/70 active:cursor-grabbing dark:text-ink-dark/35 dark:hover:bg-white/10 dark:hover:text-ink-dark/70"
        >
          <GripVertical size={17} />
        </div>
        <Popover
          open={menuOpen}
          onClose={() => {
            setMenuOpen(false)
            setState(null)
          }}
          className="left-0 top-7 w-56"
        >
          {ALIGNABLE.has(state.node.type.name) && (
            <>
              <div className="flex gap-1 px-1 pb-1 pt-0.5">
                {(
                  [
                    ['left', AlignLeft, 'Align left'],
                    ['center', AlignCenter, 'Align center'],
                    ['right', AlignRight, 'Align right'],
                  ] as const
                ).map(([value, Icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    title={label}
                    aria-label={label}
                    aria-pressed={align === value}
                    onClick={() => setAlign(value)}
                    className={cn(
                      'flex h-8 flex-1 items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10',
                      align === value && 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
                    )}
                  >
                    <Icon size={16} />
                  </button>
                ))}
              </div>
              <div className="my-1 h-px bg-black/5 dark:bg-white/10" />
            </>
          )}
          <MenuItem icon={<ArrowUp size={14} />} shortcut={`${mod}+⇧+↑`} onClick={() => run((t) => moveBlock(editor, 'up', t))}>
            Move up
          </MenuItem>
          <MenuItem icon={<ArrowDown size={14} />} shortcut={`${mod}+⇧+↓`} onClick={() => run((t) => moveBlock(editor, 'down', t))}>
            Move down
          </MenuItem>
          <MenuItem icon={<Copy size={14} />} onClick={() => run((t) => duplicateBlock(editor, t))}>
            Duplicate
          </MenuItem>
          {REFERENCEABLE.includes(state.node.type.name) && (
            <MenuItem
              icon={<Link2 size={14} />}
              onClick={() =>
                run((t) => {
                  const id = ensureBlockId(editor, t.pos)
                  if (!id) return
                  void navigator.clipboard.writeText(pageUrl(pageId, id))
                  useAppStore.getState().showToast('Link to block copied — paste it in any page')
                })
              }
            >
              Copy link to block
            </MenuItem>
          )}
          {(state.node.type.name === 'listItem' || state.node.type.name === 'taskItem') && (
            <MenuItem icon={<ListTree size={14} />} onClick={() => run((t) => turnListIntoMindMap(editor, t.pos))}>
              Turn list into mind map
            </MenuItem>
          )}
          <div className="my-1 h-px bg-black/5 dark:bg-white/10" />
          <MenuItem icon={<Trash2 size={14} />} danger shortcut="Del" onClick={() => run((t) => deleteBlock(editor, t))}>
            Delete
          </MenuItem>
        </Popover>
      </div>
    </div>
    </>
  )
}

/** Replaces the top-level list containing `pos` with a mind map of its items. */
export function turnListIntoMindMap(editor: Editor, pos: number) {
  const $pos = editor.state.doc.resolve(pos)
  if ($pos.depth < 1) return
  const from = $pos.before(1)
  const list = editor.state.doc.nodeAt(from)
  if (!list) return
  const { pages, activePageId } = useAppStore.getState()
  const title = pages.find((p) => p.id === activePageId)?.title.trim() || 'Central topic'
  const map = listToMindMap(list.toJSON(), title)
  editor
    .chain()
    .focus()
    .insertContentAt({ from, to: from + list.nodeSize }, { type: 'mindmap', attrs: { map } })
    .run()
}
