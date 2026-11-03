import { useEffect, useState } from 'react'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { AlertTriangle, Check, ChevronDown, Copy, Eye, EyeOff, Loader2, Maximize2 } from 'lucide-react'
import { DiagramViewer } from '@/components/ui/DiagramViewer'
import { useAppStore } from '@/stores/useAppStore'
import { renderMermaid, type MermaidResult } from '../mermaid/renderMermaid'
import { CODE_LANGUAGES, detectLanguage, languageFromFileName, languageLabel } from './codeHighlight'

/**
 * Code block styled like a code window: traffic-light dots, file name / title, language pill
 * and Copy in the header; line numbers beside the highlighted code.
 */
export function CodeBlockView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const language: string | null = node.attrs.language || null
  const title: string = node.attrs.title ?? ''
  const code = node.textContent
  const [copied, setCopied] = useState(false)
  const detected = language ? null : detectLanguage(code)
  const effective = language ?? detected
  const isMermaid = effective === 'mermaid'
  const preview = node.attrs.preview !== false
  const lines = Math.max(1, code.split('\n').length)
  const editable = editor.isEditable

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const copy = () => {
    void navigator.clipboard.writeText(code).then(
      () => setCopied(true),
      () => {},
    )
  }

  /** Puts the cursor at the start of the code (Enter / ↓ in the title). */
  const focusCode = () => {
    const pos = getPos()
    if (typeof pos === 'number') editor.chain().focus().setTextSelection(pos + 1).run()
  }

  const known = !language || CODE_LANGUAGES.some((l) => l.id === language)
  const autoLabel = detected ? languageLabel(detected) : 'Plain text'

  return (
    <NodeViewWrapper className="code-block" data-language={effective ?? undefined}>
      <div className="code-block-header" contentEditable={false}>
        <span className="code-block-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {editable || title ? (
          <input
            className="code-block-title"
            value={title}
            readOnly={!editable}
            placeholder="File name or title"
            aria-label="Code block title"
            spellCheck={false}
            onChange={(e) => {
              // A title with a file extension sets the language (unless the user picked another one).
              const next = e.target.value
              const fromNew = languageFromFileName(next)
              const followsTitle = !language || language === languageFromFileName(title)
              updateAttributes(followsTitle ? { title: next, language: fromNew } : { title: next })
            }}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault()
                focusCode()
              }
            }}
          />
        ) : (
          <span className="flex-1" />
        )}
        <label className="code-block-lang" title="Language">
          <span>{language ? languageLabel(language) : autoLabel}</span>
          <ChevronDown size={11} strokeWidth={2.5} aria-hidden="true" />
          <select
            value={language ?? ''}
            disabled={!editable}
            onChange={(e) => updateAttributes({ language: e.target.value || null })}
            aria-label="Code language"
          >
            <option value="">{`Auto · ${autoLabel}`}</option>
            {!known && <option value={language!}>{language}</option>}
            {CODE_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        {isMermaid && (
          <button
            type="button"
            className="code-block-btn"
            onClick={() => updateAttributes({ preview: !preview })}
            title={preview ? 'Hide diagram' : 'Show diagram'}
            aria-pressed={preview}
          >
            {preview ? <EyeOff size={12} /> : <Eye size={12} />}
            <span>{preview ? 'Hide diagram' : 'Show diagram'}</span>
          </button>
        )}
        <button type="button" className="code-block-btn" onClick={copy} title="Copy code" aria-label="Copy code">
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="code-block-body">
        {/* One text node for all numbers (cheap to update on big blocks). */}
        <div className="code-block-gutter" contentEditable={false} aria-hidden="true">
          {lineNumbers(lines)}
        </div>
        <pre spellCheck={false}>
          <NodeViewContent<'code'> as="code" className={effective ? `hljs language-${effective}` : 'hljs'} />
        </pre>
      </div>
      {isMermaid && preview && <MermaidPreview code={code} />}
    </NodeViewWrapper>
  )
}

const numberCache = new Map<number, string>()
/** "1\n2\n…\nn" (memoized: recomputed only when the line count changes). */
function lineNumbers(n: number): string {
  let s = numberCache.get(n)
  if (!s) {
    s = Array.from({ length: n }, (_, i) => i + 1).join('\n')
    if (numberCache.size > 50) numberCache.clear()
    numberCache.set(n, s)
  }
  return s
}

/** Live diagram under a Mermaid code block (re-rendered shortly after typing stops). */
function MermaidPreview({ code }: { code: string }) {
  const theme = useAppStore((s) => s.theme)
  const [result, setResult] = useState<MermaidResult | null>(null)
  const [pending, setPending] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPending(true)
    const t = setTimeout(() => {
      void renderMermaid(code, theme).then((r) => {
        if (cancelled) return
        // Keep the last good diagram while the code is temporarily invalid mid-typing.
        setResult((prev) => (r.svg || !prev?.svg ? r : { ...prev, error: r.error }))
        setPending(false)
      })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [code, theme])

  return (
    <div className="code-block-preview group/preview relative" contentEditable={false}>
      {result?.svg && (
        <button
          type="button"
          title="Expand diagram"
          aria-label="Expand diagram"
          onClick={() => setExpanded(true)}
          className="absolute right-2 top-2 z-[1] flex items-center gap-1 rounded-md border border-black/10 bg-white/95 px-2 py-1 text-xs opacity-0 shadow-sm transition-opacity hover:bg-white group-hover/preview:opacity-100 dark:border-white/10 dark:bg-[#2a2a2a]/95 dark:hover:bg-[#333]"
        >
          <Maximize2 size={13} /> Expand
        </button>
      )}
      {expanded && result?.svg && <DiagramViewer svg={result.svg} title="Mermaid diagram" onClose={() => setExpanded(false)} />}
      {result?.svg ? (
        <div className="mermaid-svg flex justify-center overflow-x-auto" dangerouslySetInnerHTML={{ __html: result.svg }} />
      ) : pending ? (
        <div className="code-block-preview-msg">
          <Loader2 size={14} className="animate-spin" /> Rendering diagram…
        </div>
      ) : null}
      {result?.error && !pending && (
        <div className="code-block-preview-msg error" title={result.error}>
          <AlertTriangle size={14} />
          <span className="truncate">{result.error.split('\n')[0]}</span>
        </div>
      )}
    </div>
  )
}
