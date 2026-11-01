import { useEffect, useState } from 'react'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { AlertTriangle, Check, Copy, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { renderMermaid, type MermaidResult } from '../mermaid/renderMermaid'
import { CODE_LANGUAGES, detectLanguage, languageLabel } from './codeHighlight'

/** Code block: highlighted code with a language picker and a copy button. */
export function CodeBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const language: string | null = node.attrs.language || null
  const code = node.textContent
  const [copied, setCopied] = useState(false)
  const detected = language ? null : detectLanguage(code)
  const effective = language ?? detected
  const isMermaid = effective === 'mermaid'
  const preview = node.attrs.preview !== false

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

  const known = !language || CODE_LANGUAGES.some((l) => l.id === language)

  return (
    <NodeViewWrapper className="code-block" data-language={effective ?? undefined}>
      <div className="code-block-toolbar" contentEditable={false}>
        <select
          className="code-block-lang"
          value={language ?? ''}
          disabled={!editor.isEditable}
          onChange={(e) => updateAttributes({ language: e.target.value || null })}
          title="Language"
          aria-label="Code language"
        >
          <option value="">{detected ? `Auto · ${languageLabel(detected)}` : 'Auto-detect'}</option>
          {!known && <option value={language!}>{language}</option>}
          {CODE_LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <div className="code-block-actions">
          {isMermaid && (
            <button
              type="button"
              className="code-block-btn always"
              onClick={() => updateAttributes({ preview: !preview })}
              title={preview ? 'Hide diagram' : 'Show diagram'}
              aria-pressed={preview}
            >
              {preview ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{preview ? 'Hide diagram' : 'Show diagram'}</span>
            </button>
          )}
          <button type="button" className="code-block-btn" onClick={copy} title="Copy code" aria-label="Copy code">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
      <pre spellCheck={false}>
        <NodeViewContent<'code'> as="code" className={effective ? `hljs language-${effective}` : 'hljs'} />
      </pre>
      {isMermaid && preview && <MermaidPreview code={code} />}
    </NodeViewWrapper>
  )
}

/** Live diagram under a Mermaid code block (re-rendered shortly after typing stops). */
function MermaidPreview({ code }: { code: string }) {
  const theme = useAppStore((s) => s.theme)
  const [result, setResult] = useState<MermaidResult | null>(null)
  const [pending, setPending] = useState(true)

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
    <div className="code-block-preview" contentEditable={false}>
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
