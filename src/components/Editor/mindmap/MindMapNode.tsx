import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { mergeAttributes, Node, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { ListTree, PenLine, Trash2 } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'
import { insertBlockAtCursor, placeCursorAfter } from '../mermaid/MermaidNode'
import { countNodes, layoutMindMap, mindMapToList, newMindMap, normalizeMindMap, type MindMap } from './mindmapModel'
import { MindMapSvg } from './MindMapSvg'
import { MindMapEditor } from './MindMapEditor'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mindmap: {
      /** Inserts a mind map block and opens the editor. */
      insertMindMap: (map?: MindMap) => ReturnType
    }
  }
}

/** A mind map block: topics, sub-topics and notes, edited in a full-window editor. */
export const MindMapNode = Node.create({
  name: 'mindmap',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      map: {
        default: null,
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute('data-map') ?? 'null')
          } catch {
            return null
          }
        },
        renderHTML: (attrs) => ({ 'data-map': JSON.stringify(attrs.map) }),
      },
      align: {
        default: 'center',
        parseHTML: (el) => el.getAttribute('data-align') || 'center',
        renderHTML: (attrs) => ({ 'data-align': attrs.align }),
      },
      isNew: { default: false, rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mindmap"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mindmap' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MindMapView)
  },

  addCommands() {
    return {
      insertMindMap:
        (map) =>
        ({ tr, dispatch, state }) => {
          if (dispatch) insertBlockAtCursor(tr, state, this.type.create({ map: map ?? newMindMap(), isNew: true }))
          return true
        },
    }
  },
})

function MindMapView({ node, updateAttributes, deleteNode, selected, editor, getPos }: NodeViewProps) {
  const theme = useAppStore((s) => s.theme)
  const map = useMemo(() => normalizeMindMap(node.attrs.map), [node.attrs.map])
  const layout = useMemo(() => layoutMindMap(map), [map])
  const [open, setOpen] = useState<boolean>(!!node.attrs.isNew)
  const align = node.attrs.align as string
  const b = layout.bounds
  const pad = 24
  const w = b.maxX - b.minX + pad * 2
  const h = b.maxY - b.minY + pad * 2

  const close = (result: MindMap | null) => {
    setOpen(false)
    if (result) updateAttributes({ map: result, isNew: false })
    else if (node.attrs.isNew) updateAttributes({ isNew: false })
    requestAnimationFrame(() => {
      const pos = getPos()
      if (typeof pos === 'number' && !editor.isDestroyed) placeCursorAfter(editor, pos + editor.state.doc.nodeAt(pos)!.nodeSize)
    })
  }

  /** Replaces the mind map with a nested bullet list (root as a bold line). */
  const toOutline = () => {
    const pos = getPos()
    if (typeof pos !== 'number') return
    editor
      .chain()
      .focus()
      .insertContentAt({ from: pos, to: pos + node.nodeSize }, mindMapToList(map))
      .run()
  }

  return (
    <NodeViewWrapper
      data-drag-handle
      className={cn(
        'mindmap-block group/mm relative my-3 rounded-lg border transition-colors',
        selected ? 'border-blue-400/70' : 'border-transparent hover:border-black/10 dark:hover:border-white/10',
      )}
    >
      <div contentEditable={false} onDoubleClick={() => editor.isEditable && setOpen(true)} className="relative overflow-x-auto p-2">
        <div className={cn('flex', align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center')}>
          <svg
            className="mindmap-svg"
            viewBox={`${b.minX - pad} ${b.minY - pad} ${w} ${h}`}
            width={w}
            height={h}
            style={{ maxWidth: '100%', maxHeight: 560, height: 'auto' }}
            role="img"
            aria-label={`Mind map: ${map.root.text || 'Central topic'} (${countNodes(map.root)} topics)`}
          >
            <MindMapSvg layout={layout} theme={theme} />
          </svg>
        </div>
        {editor.isEditable && (
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover/mm:opacity-100">
            <ToolbarButton label="Edit mind map" onClick={() => setOpen(true)}>
              <PenLine size={14} /> Edit
            </ToolbarButton>
            <ToolbarButton label="Convert to outline" onClick={toOutline}>
              <ListTree size={14} /> To outline
            </ToolbarButton>
            <ToolbarButton label="Delete mind map" onClick={deleteNode}>
              <Trash2 size={14} />
            </ToolbarButton>
          </div>
        )}
      </div>
      {open && createPortal(<MindMapEditor initial={map} theme={theme} onClose={close} />, document.body)}
    </NodeViewWrapper>
  )
}

function ToolbarButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex items-center gap-1 rounded-md border border-black/10 bg-white/95 px-2 py-1 text-xs shadow-sm hover:bg-white dark:border-white/10 dark:bg-[#2a2a2a]/95 dark:hover:bg-[#333]"
    >
      {children}
    </button>
  )
}
