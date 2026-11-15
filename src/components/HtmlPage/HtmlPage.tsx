import { useCallback, useEffect, useRef, useState } from 'react'
import { Code2, Expand, Globe, Loader2, Minimize, RotateCw, X, Zap } from 'lucide-react'
import { api } from '@/lib/api'
import { autoSaver } from '@/lib/autoSave'
import { useAppStore } from '@/stores/useAppStore'
import { HtmlBlockRender } from '@/components/Editor/html/HtmlView'
import { SANDBOX_ESCAPE } from '@/components/Editor/html/HtmlSandbox'
import { cn } from '@/lib/utils'
import { normalizeHtmlPage, newHtmlPageContent, type HtmlPageContent } from './htmlPageModel'

/**
 * A page that is one web page (HTML, CSS, JavaScript) using the whole page area — like a
 * whiteboard is one canvas. Edit code opens the code beside a live preview; Full screen fills
 * the screen. Scripts run sandboxed, as in HTML blocks. Mount with key={pageId}.
 */
export function HtmlPage({ pageId }: { pageId: string }) {
  const meta = useAppStore((s) => s.pages.find((p) => p.id === pageId))
  const [content, setContent] = useState<HtmlPageContent | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [preview, setPreview] = useState('')
  const [reload, setReload] = useState(0)
  const [full, setFull] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    void autoSaver
      .flush(pageId)
      .then(() => api.readPage(pageId))
      .then((page) => {
        if (cancelled) return
        const c = page?.content as { type?: string } | null
        const next = c?.type === 'htmlPage' ? normalizeHtmlPage(c) : newHtmlPageContent()
        setContent(next)
        if (!c || useAppStore.getState().focusTitleFor === pageId) {
          // A brand-new page opens in the editor.
          if (useAppStore.getState().focusTitleFor === pageId) useAppStore.getState().clearFocusTitle()
          setDraft(next.source)
          setPreview(next.source)
          setEditing(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [pageId])

  const save = useCallback(
    (patch: Partial<HtmlPageContent>) => {
      setContent((cur) => {
        if (!cur) return cur
        const next = { ...cur, ...patch }
        autoSaver.schedule({ id: pageId, content: next as never })
        return next
      })
    },
    [pageId],
  )

  // Live preview while editing, and autosave of the code (code you write counts as trusted).
  useEffect(() => {
    if (!editing) return
    const t = setTimeout(() => {
      setPreview(draft)
      if (content && draft !== content.source) save({ source: draft, trusted: true })
    }, 400)
    return () => clearTimeout(t)
  }, [draft, editing, content, save])

  // Full screen (the whole screen, like a video): Esc or the button leaves it.
  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement && document.fullscreenElement === rootRef.current)
    // Esc leaves full screen, also when pressed inside the web page (the sandbox forwards it).
    const leave = () => {
      if (document.fullscreenElement === rootRef.current) void document.exitFullscreen().catch(() => {})
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && leave()
    document.addEventListener('fullscreenchange', onChange)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener(SANDBOX_ESCAPE, leave)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener(SANDBOX_ESCAPE, leave)
      if (document.fullscreenElement === rootRef.current) void document.exitFullscreen().catch(() => {})
    }
  }, [])
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void rootRef.current?.requestFullscreen?.().catch(() => {})
  }

  if (!meta) return null
  if (!content) {
    return (
      <div className="flex h-full items-center justify-center opacity-50">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  const btn = 'flex h-7 items-center gap-1 rounded-md px-2 text-xs hover:bg-black/5 dark:hover:bg-white/10'
  const attrs = { interactive: content.interactive, allowNetwork: content.allowNetwork, trusted: content.trusted }
  const setAttrs = (p: Record<string, unknown>) => save(p as Partial<HtmlPageContent>)

  return (
    <div ref={rootRef} className="flex h-full flex-col bg-canvas-light text-ink-light dark:bg-canvas-dark dark:text-ink-dark" data-testid="html-page">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-black/[0.06] px-3 dark:border-white/[0.08]">
        <span className="mr-auto truncate text-sm font-medium">{meta.title || 'Untitled web page'}</span>
        {editing && (
          <>
            <label className="flex cursor-pointer items-center gap-1.5 px-1 text-xs">
              <input type="checkbox" checked={content.interactive} onChange={(e) => save({ interactive: e.target.checked, trusted: true })} className="accent-blue-500" />
              <Zap size={13} className="opacity-70" /> Run JavaScript
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 px-1 text-xs" title="Load libraries or data over https">
              <input type="checkbox" checked={content.allowNetwork} disabled={!content.interactive} onChange={(e) => save({ allowNetwork: e.target.checked })} className="accent-blue-500" />
              <Globe size={13} className="opacity-70" /> Internet
            </label>
            <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />
          </>
        )}
        <button type="button" className={btn} title="Reload the page" aria-label="Reload" onClick={() => setReload((n) => n + 1)}>
          <RotateCw size={14} />
        </button>
        <button
          type="button"
          className={cn(btn, editing && 'bg-blue-500/10 text-blue-600 dark:text-blue-400')}
          aria-pressed={editing}
          onClick={() => {
            if (!editing) {
              setDraft(content.source)
              setPreview(content.source)
            } else if (draft !== content.source) save({ source: draft, trusted: true })
            setEditing((v) => !v)
          }}
        >
          {editing ? <X size={14} /> : <Code2 size={14} />} {editing ? 'Close code' : 'Edit code'}
        </button>
        <button type="button" className={btn} aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen (Esc)' : 'Full screen'} onClick={toggleFull}>
          {full ? <Minimize size={14} /> : <Expand size={14} />} {full ? 'Exit full screen' : 'Full screen'}
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        {editing && (
          <textarea
            aria-label="HTML code"
            value={draft}
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                // Tab indents (instead of leaving the editor).
                e.preventDefault()
                const el = e.currentTarget
                el.setRangeText('  ', el.selectionStart, el.selectionEnd, 'end')
                setDraft(el.value)
              }
            }}
            className="w-[45%] min-w-[280px] resize-none border-r border-black/[0.08] bg-[#fafafa] p-4 font-mono text-[13px] leading-relaxed text-[#1f2328] outline-none dark:border-white/[0.08] dark:bg-[#1e1e1e] dark:text-[#d4d4d4]"
          />
        )}
        <div key={reload} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto" data-testid="html-page-view">
          <HtmlBlockRender source={editing ? preview : content.source} className="markdown-body selectable-text p-4" attrs={attrs} setAttrs={setAttrs} fill />
        </div>
      </div>
    </div>
  )
}
