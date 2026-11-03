import { useEffect, useRef, useState } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import { ArrowDownToLine, ArrowUpToLine, ChevronDown, Copy, Plus, SquareDashedMousePointer, Trash2, Type } from 'lucide-react'
import { SLASH_COMMANDS } from '@/components/Editor/slashCommands'
import { cn } from '@/lib/utils'

/** Things that can be put on a slide as their own box (titles of slash commands). */
export const INSERTABLE: Array<{ title: string; label?: string; width: number }> = [
  { title: 'Text', label: 'Text box', width: 480 },
  { title: 'Chart', width: 760 },
  { title: 'Table', width: 640 },
  { title: 'Image', width: 560 },
  { title: 'Code', width: 680 },
  { title: 'Mermaid diagram', width: 720 },
  { title: 'PlantUML', width: 720 },
  { title: 'Drawing', width: 640 },
  { title: 'Mind map', width: 720 },
  { title: 'Block equation', label: 'Equation', width: 520 },
  { title: 'Callout', width: 560 },
  { title: 'HTML', width: 640 },
  { title: 'Interactive HTML', width: 640 },
]

/** Fills a new box's empty editor with the block of a slash command (e.g. a chart). */
export function runInsert(editor: TiptapEditor, title: string) {
  const item = SLASH_COMMANDS.find((c) => c.title === title)
  if (!item || title === 'Text') {
    editor.commands.focus('start')
    return
  }
  item.run(editor, { from: 1, to: 1 })
  // The block is added after the box's empty first line: drop that line.
  const doc = editor.state.doc
  const first = doc.firstChild
  if (doc.childCount > 1 && first?.type.name === 'paragraph' && first.content.size === 0) {
    editor.view.dispatch(editor.state.tr.delete(0, first.nodeSize))
  }
}

/** "Insert" menu (new boxes) and arrange actions for the selected box. */
export function InsertMenu({
  onInsert,
  canDetach,
  onDetach,
  boxSelected,
  onForward,
  onBackward,
  onDuplicateBox,
  onDeleteBox,
}: {
  onInsert: (title: string, width: number) => void
  canDetach: boolean
  onDetach: () => void
  boxSelected: boolean
  onForward: () => void
  onBackward: () => void
  onDuplicateBox: () => void
  onDeleteBox: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])
  const btn = 'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm hover:bg-black/5 disabled:opacity-35 dark:hover:bg-white/10'
  const icon = 'flex h-8 w-8 items-center justify-center rounded-md hover:bg-black/5 disabled:opacity-35 dark:hover:bg-white/10'

  return (
    <>
      <div ref={ref} className="relative">
        <button type="button" className={btn} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
          <Plus size={15} className="opacity-70" /> Insert <ChevronDown size={13} className="opacity-60" />
        </button>
        {open && (
          <div role="menu" className="absolute left-0 top-full z-50 mt-1 grid w-[300px] animate-pop-in grid-cols-2 gap-0.5 rounded-lg border border-black/10 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#252525]">
            {INSERTABLE.map((it) => {
              const cmd = SLASH_COMMANDS.find((c) => c.title === it.title)
              const Icon = it.title === 'Text' ? Type : (cmd?.icon ?? Type)
              return (
                <button
                  key={it.title}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    onInsert(it.title, it.width)
                  }}
                  className="flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <Icon size={15} className="shrink-0 opacity-70" /> {it.label ?? it.title}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <button
        type="button"
        className={btn}
        disabled={!canDetach}
        onMouseDown={(e) => e.preventDefault() /* keep the cursor in the block */}
        onClick={onDetach}
        title="Put the block with the cursor (chart, code, image…) in its own box you can move anywhere"
      >
        <SquareDashedMousePointer size={15} className="opacity-70" /> Detach block
      </button>
      {boxSelected && (
        <div className="flex items-center" role="group" aria-label="Arrange box">
          <button type="button" className={icon} title="Bring forward" aria-label="Bring forward" onClick={onForward}>
            <ArrowUpToLine size={15} />
          </button>
          <button type="button" className={icon} title="Send backward" aria-label="Send backward" onClick={onBackward}>
            <ArrowDownToLine size={15} />
          </button>
          <button type="button" className={icon} title="Duplicate box" aria-label="Duplicate box" onClick={onDuplicateBox}>
            <Copy size={15} />
          </button>
          <button type="button" className={cn(icon, 'hover:text-red-600')} title="Delete box (Delete)" aria-label="Delete box" onClick={onDeleteBox}>
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </>
  )
}
