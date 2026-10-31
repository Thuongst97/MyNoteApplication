import { lazy, Suspense, useState } from 'react'
import { createPortal } from 'react-dom'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Loader2, PenLine, Shapes, Trash2 } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'
import { placeCursorAfter } from '../mermaid/MermaidNode'
import type { DrawingData } from './drawingModel'

const DrawingEditor = lazy(() => import('./DrawingEditor'))

export function DrawingView({ node, updateAttributes, deleteNode, selected, editor, getPos }: NodeViewProps) {
  const theme = useAppStore((s) => s.theme)
  const data = node.attrs.data as DrawingData
  const [open, setOpen] = useState<boolean>(!!node.attrs.isNew)
  const align = node.attrs.align as string
  const svg = theme === 'dark' ? data.svgDark : data.svgLight
  const empty = !data.scene?.elements?.length

  const leave = () =>
    requestAnimationFrame(() => {
      const pos = getPos()
      if (typeof pos === 'number' && !editor.isDestroyed) placeCursorAfter(editor, pos + editor.state.doc.nodeAt(pos)!.nodeSize)
    })

  const close = (result: DrawingData | null) => {
    setOpen(false)
    if (result) updateAttributes({ data: result, isNew: false })
    else if (node.attrs.isNew && empty) {
      deleteNode()
      return
    } else if (node.attrs.isNew) updateAttributes({ isNew: false })
    leave()
  }

  return (
    <NodeViewWrapper
      data-drag-handle
      className={cn(
        'drawing-block group/drawing relative my-3 rounded-lg border transition-colors',
        selected ? 'border-blue-400/70' : 'border-transparent hover:border-black/10 dark:hover:border-white/10',
      )}
    >
      <div contentEditable={false} onDoubleClick={() => editor.isEditable && setOpen(true)} className="relative p-2">
        {empty ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-black/15 py-10 text-sm opacity-60 hover:opacity-100 dark:border-white/15"
          >
            <Shapes size={22} /> Empty drawing — click to draw
          </button>
        ) : (
          <div
            className={cn('drawing-svg flex', align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center')}
            // SVG produced by Excalidraw's exporter when the drawing was saved.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
        {editor.isEditable && !empty && (
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover/drawing:opacity-100">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex items-center gap-1 rounded-md border border-black/10 bg-white/95 px-2 py-1 text-xs shadow-sm hover:bg-white dark:border-white/10 dark:bg-[#2a2a2a]/95 dark:hover:bg-[#333]"
            >
              <PenLine size={14} /> Edit drawing
            </button>
            <button
              type="button"
              aria-label="Delete drawing"
              title="Delete drawing"
              onClick={deleteNode}
              className="flex items-center rounded-md border border-black/10 bg-white/95 px-2 py-1 text-xs shadow-sm hover:bg-white dark:border-white/10 dark:bg-[#2a2a2a]/95 dark:hover:bg-[#333]"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      {open &&
        createPortal(
          <Suspense
            fallback={
              <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 text-white">
                <Loader2 className="animate-spin" />
              </div>
            }
          >
            <DrawingEditor initial={data} theme={theme} onClose={close} />
          </Suspense>,
          document.body,
        )}
    </NodeViewWrapper>
  )
}
