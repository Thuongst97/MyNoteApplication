import { useEffect, useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { AlertTriangle, AlignCenter, AlignLeft, AlignRight, Check, Code2, Loader2, Maximize2, Trash2, Workflow, X } from 'lucide-react'
import { DiagramViewer } from '@/components/ui/DiagramViewer'
import { useAppStore } from '@/stores/useAppStore'
import { cn, isMacLike } from '@/lib/utils'
import { MERMAID_TEMPLATE, renderMermaid, type MermaidResult } from './renderMermaid'
import { placeCursorAfter } from './MermaidNode'

/** Shows a rendered mermaid diagram; double-click (or Edit) to change the code. */
export function MermaidView({ node, updateAttributes, deleteNode, selected, editor, getPos }: NodeViewProps) {
  const code: string = node.attrs.code ?? ''
  const theme = useAppStore((s) => s.theme)
  const [editing, setEditing] = useState(code.trim() === '')
  const [draft, setDraft] = useState(code)
  const [saved, setSaved] = useState<MermaidResult | null>(null)
  const [preview, setPreview] = useState<MermaidResult | null>(null)
  const [expanded, setExpanded] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Render the saved code.
  useEffect(() => {
    if (!code.trim()) {
      setSaved(null)
      return
    }
    let cancelled = false
    void renderMermaid(code, theme).then((r) => !cancelled && setSaved(r))
    return () => {
      cancelled = true
    }
  }, [code, theme])

  // Live preview while editing (debounced).
  useEffect(() => {
    if (!editing) return
    if (!draft.trim()) {
      setPreview(null)
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      void renderMermaid(draft, theme).then((r) => !cancelled && setPreview(r))
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [draft, editing, theme])

  useEffect(() => {
    if (editing) requestAnimationFrame(() => textareaRef.current?.focus())
  }, [editing])

  const startEdit = () => {
    if (!editor.isEditable) return
    setDraft(code)
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
    updateAttributes({ code: next })
    setEditing(false)
    leave()
  }

  const cancel = () => {
    if (!code.trim()) {
      deleteNode()
      return
    }
    setDraft(code)
    setEditing(false)
    leave()
  }

  const shown = editing ? preview : saved
  const mod = isMacLike() ? '⌘' : 'Ctrl'

  return (
    <NodeViewWrapper
      className={cn(
        'mermaid-block group/mermaid relative my-2 rounded-lg border transition-colors',
        editing || selected ? 'border-blue-400/70' : 'border-transparent hover:border-black/10 dark:hover:border-white/10',
      )}
      data-drag-handle
    >
      {editing ? (
        <div contentEditable={false} className="no-drag rounded-lg bg-[#f7f6f3] p-3 dark:bg-[#202020]">
          <div className="mb-2 flex items-center gap-2 text-xs opacity-60">
            <Workflow size={14} /> Mermaid diagram — paste or type the code
            <a className="ml-auto underline" href="https://mermaid.js.org/intro/syntax-reference.html" target="_blank" rel="noreferrer">
              Syntax help
            </a>
          </div>
          <textarea
            ref={textareaRef}
            value={draft}
            spellCheck={false}
            placeholder={MERMAID_TEMPLATE}
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
                // Indent instead of leaving the field.
                e.preventDefault()
                const el = e.currentTarget
                const { selectionStart: s, selectionEnd: end } = el
                const next = draft.slice(0, s) + '  ' + draft.slice(end)
                setDraft(next)
                requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2))
              }
            }}
            rows={Math.min(18, Math.max(5, draft.split('\n').length + 1))}
            className="block w-full resize-y rounded-md border border-black/10 bg-white p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-blue-400 dark:border-white/10 dark:bg-[#191919]"
          />
          <div className="mt-2 flex items-center gap-2">
            {!draft.trim() && (
              <button
                type="button"
                onClick={() => setDraft(MERMAID_TEMPLATE)}
                className="rounded-md px-2 py-1 text-xs opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
              >
                Use example
              </button>
            )}
            <span className="ml-auto text-xs opacity-40">{mod}+Enter to save · Esc to cancel</span>
            <button
              type="button"
              onClick={cancel}
              className="flex items-center gap-1 rounded-md px-2.5 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X size={14} /> Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="flex items-center gap-1 rounded-md bg-blue-500 px-2.5 py-1 text-sm text-white hover:bg-blue-600"
            >
              <Check size={14} /> Save
            </button>
          </div>
          {draft.trim() && (
            <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
              <div className="mb-1 text-xs opacity-50">Preview</div>
              <DiagramOutput result={shown} />
            </div>
          )}
        </div>
      ) : (
        <div contentEditable={false} onDoubleClick={startEdit} className="relative px-2 py-3">
          <DiagramOutput result={shown} onFix={startEdit} align={node.attrs.align} />
          {shown?.svg && !editor.isEditable && (
            <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover/mermaid:opacity-100">
              <ToolbarButton label="Expand diagram" onClick={() => setExpanded(true)}>
                <Maximize2 size={14} />
              </ToolbarButton>
            </div>
          )}
          {editor.isEditable && (
            <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover/mermaid:opacity-100">
              {shown?.svg && (
                <ToolbarButton label="Expand diagram" onClick={() => setExpanded(true)}>
                  <Maximize2 size={14} /> Expand
                </ToolbarButton>
              )}
              {(
                [
                  ['left', AlignLeft],
                  ['center', AlignCenter],
                  ['right', AlignRight],
                ] as const
              ).map(([value, Icon]) => (
                <ToolbarButton key={value} label={`Align ${value}`} active={node.attrs.align === value} onClick={() => updateAttributes({ align: value })}>
                  <Icon size={14} />
                </ToolbarButton>
              ))}
              <ToolbarButton label="Edit diagram" onClick={startEdit}>
                <Code2 size={14} /> Edit
              </ToolbarButton>
              <ToolbarButton label="Delete diagram" onClick={deleteNode}>
                <Trash2 size={14} />
              </ToolbarButton>
            </div>
          )}
        </div>
      )}
      {expanded && shown?.svg && <DiagramViewer svg={shown.svg} title="Mermaid diagram" onClose={() => setExpanded(false)} />}
    </NodeViewWrapper>
  )
}

function DiagramOutput({ result, onFix, align = 'center' }: { result: MermaidResult | null; onFix?: () => void; align?: string }) {
  if (!result)
    return (
      <div className="flex items-center gap-2 py-6 text-sm opacity-50">
        <Loader2 size={14} className="animate-spin" /> Rendering diagram…
      </div>
    )
  if (result.error)
    return (
      <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
        <div className="mb-1 flex items-center gap-1.5 font-medium">
          <AlertTriangle size={14} /> Can’t render this diagram
        </div>
        <pre className="whitespace-pre-wrap font-mono text-xs opacity-80">{result.error}</pre>
        {onFix && (
          <button type="button" onClick={onFix} className="mt-2 text-xs underline">
            Edit code
          </button>
        )}
      </div>
    )
  return (
    <div
      className={cn(
        'mermaid-svg flex overflow-x-auto',
        align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center',
      )}
      // Rendered by mermaid with securityLevel 'strict' (sanitised SVG).
      dangerouslySetInnerHTML={{ __html: result.svg ?? '' }}
    />
  )
}

function ToolbarButton({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1 rounded-md border border-black/10 bg-white/95 px-2 py-1 text-xs shadow-sm hover:bg-white dark:border-white/10 dark:bg-[#2a2a2a]/95 dark:hover:bg-[#333]',
        active && 'text-blue-600 dark:text-blue-400',
      )}
    >
      {children}
    </button>
  )
}
