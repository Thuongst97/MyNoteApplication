import { useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Blocks, Check, Code2, Copy, Maximize2, Square, Trash2, X, type LucideIcon } from 'lucide-react'
import { blockFrameClass } from '../blockBorder'
import { DiagramViewer } from '@/components/ui/DiagramViewer'
import { cn, isMacLike } from '@/lib/utils'
import { placeCursorAfter } from '../mermaid/MermaidNode'

/** What makes a source block a Markdown block, an HTML block… */
export interface SourceKind {
  /** "Markdown", "HTML" */
  name: string
  icon: LucideIcon
  /** Shown above the editor. */
  hint: string
  help: { url: string; label: string }
  template: string
  /** Renders the source (read-only, selectable). */
  Render: (props: { source: string; className?: string }) => React.ReactElement
  /** HTML to replace the block with when turning it into editable blocks (none: no button). */
  toBlocksHtml?: (source: string) => string
  /** Diagram blocks: offer a full-window viewer (zoom & pan) for the rendered SVG. */
  expandable?: boolean
  /** Has a frame (on by default, `border` attribute) with a Border toggle, like drawings. */
  borderToggle?: boolean
  /** Extra controls under the editor (e.g. the PlantUML server). */
  EditorFooter?: () => React.ReactElement
}

/**
 * A block that stores source text (Markdown, HTML…) and shows it rendered; Edit to change
 * the source with a live preview. The rendered text can be selected and copied.
 */
export function SourceBlockView({ node, updateAttributes, deleteNode, selected, editor, getPos, kind }: NodeViewProps & { kind: SourceKind }) {
  const { Render } = kind
  // While this block is selected as a whole (e.g. it's the first block when the page opens),
  // the browser can't select text inside it. Pressing the mouse on the text moves the
  // editor's selection next to the block, so dragging selects words (to copy them).
  const renderedRef = useRef<HTMLDivElement>(null)
  const releaseRef = useRef<(e: MouseEvent) => void>(() => {})
  releaseRef.current = (e: MouseEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
    const pos = getPos()
    const sel = editor.state.selection
    // Whole-block selection of this block? (checked by shape: works across module copies)
    if (typeof pos !== 'number' || sel.from !== pos || sel.to !== pos + node.nodeSize || !('node' in sel)) return
    const target = nearestTextPosition(editor.state.doc, sel.from, sel.to)
    if (target !== null) editor.commands.setTextSelection(target)
    // Nothing to put the cursor in (the block is the page's only block): add the empty line
    // the editor keeps at the end of a page anyway.
    else editor.chain().insertContentAt(sel.to, { type: 'paragraph' }).setTextSelection(sel.to + 1).run()
  }
  useEffect(() => {
    const el = renderedRef.current
    if (!el) return
    // Native (capture) listener: the editor handles mousedown before React would see it.
    const onDown = (e: MouseEvent) => releaseRef.current(e)
    el.addEventListener('mousedown', onDown, true)
    return () => el.removeEventListener('mousedown', onDown, true)
  })
  const source: string = node.attrs.source ?? ''
  const [editing, setEditing] = useState(source.trim() === '')
  const [draft, setDraft] = useState(source)
  const [preview, setPreview] = useState(source)
  const [copied, setCopied] = useState(false)
  const [expandedSvg, setExpandedSvg] = useState<string | null>(null)
  const expand = () => {
    const svg = renderedRef.current?.querySelector('svg')
    if (svg) setExpandedSvg(svg.outerHTML)
  }
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Live preview while editing (debounced so big documents stay smooth).
  useEffect(() => {
    if (!editing) return
    const t = setTimeout(() => setPreview(draft), 250)
    return () => clearTimeout(t)
  }, [draft, editing])

  useEffect(() => {
    if (editing) requestAnimationFrame(() => textareaRef.current?.focus())
  }, [editing])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const startEdit = () => {
    if (!editor.isEditable) return
    setDraft(source)
    setPreview(source)
    setEditing(true)
  }

  const leave = () =>
    requestAnimationFrame(() => {
      const pos = getPos()
      if (typeof pos === 'number' && !editor.isDestroyed) placeCursorAfter(editor, pos + editor.state.doc.nodeAt(pos)!.nodeSize)
    })

  const save = () => {
    const next = draft.replace(/\s+$/, '')
    if (!next.trim()) {
      deleteNode()
      return
    }
    updateAttributes({ source: next })
    setEditing(false)
    leave()
  }

  const cancel = () => {
    if (!source.trim()) {
      deleteNode()
      return
    }
    setDraft(source)
    setEditing(false)
    leave()
  }

  /** Replaces this block with normal editable blocks. */
  const convert = () => {
    const pos = getPos()
    if (typeof pos !== 'number') return
    editor
      .chain()
      .focus()
      .insertContentAt({ from: pos, to: pos + node.nodeSize }, kind.toBlocksHtml?.(source) ?? '')
      .run()
  }

  const copy = () => void navigator.clipboard.writeText(source).then(() => setCopied(true), () => {})
  const mod = isMacLike() ? '⌘' : 'Ctrl'

  return (
    <NodeViewWrapper
      className={cn(
        'markdown-block group/md relative my-2',
        kind.borderToggle
          ? blockFrameClass(editing || selected, node.attrs.border !== false)
          : cn('rounded-lg border transition-colors', editing || selected ? 'border-blue-400/70' : 'border-transparent hover:border-black/10 dark:hover:border-white/10'),
      )}
    >
      {editing ? (
        <div contentEditable={false} className="no-drag rounded-lg bg-[#f7f6f3] p-3 dark:bg-[#202020]">
          <div className="mb-2 flex items-center gap-2 text-xs opacity-60">
            <kind.icon size={14} /> {kind.hint}
            <a className="ml-auto underline" href={kind.help.url} target="_blank" rel="noreferrer">
              {kind.help.label}
            </a>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <textarea
              ref={textareaRef}
              value={draft}
              spellCheck={false}
              placeholder={kind.template}
              aria-label={`${kind.name} source`}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  save()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  cancel()
                } else if (e.key === 'Tab') {
                  e.preventDefault()
                  const el = e.currentTarget
                  const { selectionStart: s, selectionEnd: end } = el
                  setDraft(draft.slice(0, s) + '  ' + draft.slice(end))
                  requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2))
                }
              }}
              className="block max-h-[70vh] min-h-[220px] w-full resize-y rounded-md border border-black/10 bg-white p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-blue-400 dark:border-white/10 dark:bg-[#191919]"
            />
            <div className="max-h-[70vh] min-h-[220px] overflow-auto rounded-md border border-black/5 bg-white px-4 py-2 dark:border-white/5 dark:bg-[#191919]">
              {preview.trim() ? <Render source={preview} className="markdown-body" /> : <div className="py-2 text-sm opacity-40">Preview</div>}
            </div>
          </div>
          {kind.EditorFooter && <kind.EditorFooter />}
          <div className="mt-2 flex items-center gap-2">
            {!draft.trim() && (
              <button
                type="button"
                onClick={() => setDraft(kind.template)}
                className="rounded-md px-2 py-1 text-xs opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
              >
                Use example
              </button>
            )}
            <span className="ml-auto text-xs opacity-40">{mod}+Enter to save · Esc to cancel</span>
            <button type="button" onClick={cancel} className="flex items-center gap-1 rounded-md px-2.5 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10">
              <X size={14} /> Cancel
            </button>
            <button type="button" onClick={save} className="flex items-center gap-1 rounded-md bg-blue-500 px-2.5 py-1 text-sm text-white hover:bg-blue-600">
              <Check size={14} /> Save
            </button>
          </div>
        </div>
      ) : (
        <div ref={renderedRef} contentEditable={false} className="relative px-1 py-1">
          {/* Selectable, copyable text: double-click selects a word; use Edit to change the source. */}
          <Render source={source} className="markdown-body selectable-text" />
          {editor.isEditable && (
            <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover/md:opacity-100">
              {kind.expandable && (
                <ToolbarButton label="Expand diagram" onClick={expand}>
                  <Maximize2 size={14} /> Expand
                </ToolbarButton>
              )}
              {kind.borderToggle && (
                <ToolbarButton
                  label={node.attrs.border !== false ? 'Hide border' : 'Show border'}
                  active={node.attrs.border !== false}
                  onClick={() => updateAttributes({ border: node.attrs.border === false })}
                >
                  <Square size={14} /> Border
                </ToolbarButton>
              )}
              <ToolbarButton label={`Edit ${kind.name}`} onClick={startEdit}>
                <Code2 size={14} /> Edit
              </ToolbarButton>
              {kind.toBlocksHtml && (
                <ToolbarButton label="Turn into editable blocks" onClick={convert}>
                <Blocks size={14} /> To blocks
              </ToolbarButton>
              )}
              <ToolbarButton label={`Copy ${kind.name}`} onClick={copy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </ToolbarButton>
              <ToolbarButton label="Delete" onClick={deleteNode}>
                <Trash2 size={14} />
              </ToolbarButton>
            </div>
          )}
        </div>
      )}
      {expandedSvg && <DiagramViewer svg={expandedSvg} title={`${kind.name} diagram`} onClose={() => setExpandedSvg(null)} />}
    </NodeViewWrapper>
  )
}

function ToolbarButton({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-md border border-black/10 bg-white/95 px-2 py-1 text-xs shadow-sm hover:bg-white dark:border-white/10 dark:bg-[#2a2a2a]/95 dark:hover:bg-[#333]',
        active && 'text-blue-600 dark:text-blue-400',
      )}
    >
      {children}
    </button>
  )
}

/** A cursor position in the nearest text block after `to` (or before `from`), or null. */
function nearestTextPosition(doc: NodeViewProps['node'], from: number, to: number): number | null {
  let after: number | null = null
  doc.nodesBetween(to, doc.content.size, (n, p) => {
    if (after !== null) return false
    if (n.isTextblock && p >= to) {
      after = p + 1
      return false
    }
    return true
  })
  if (after !== null) return after
  let before: number | null = null
  doc.nodesBetween(0, from, (n, p) => {
    if (n.isTextblock && p + n.nodeSize <= from) before = p + n.nodeSize - 1
    return true
  })
  return before
}
