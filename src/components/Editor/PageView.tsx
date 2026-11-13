import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/react'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { autoSaver } from '@/lib/autoSave'
import { useAppStore } from '@/stores/useAppStore'
import { Editor } from './Editor'
import { PageHeader } from './PageHeader'
import { Backlinks } from './links/Backlinks'
import { WidthHandles } from './WidthHandles'
import { widthStyle, type PageWidth } from '@/lib/pageWidth'
import { fontStyle } from '@/lib/pageFont'
import { setFindTarget, useFindStore } from '@/stores/useFindStore'
import { editorFindProvider } from './find/editorFind'
import { copyPage } from './pageCopy'

/**
 * Loads a page's content and renders header + editor.
 * Mount with `key={pageId}` so each page gets a fresh editor instance.
 */
/** The page the last right-click happened on (its menu's "Copy page" copies that page). */
let lastContextPage: string | null = null

export function PageView({ pageId }: { pageId: string }) {
  const meta = useAppStore((s) => s.pages.find((p) => p.id === pageId))
  const focusTitleFor = useAppStore((s) => s.focusTitleFor)
  const updatePageMeta = useAppStore((s) => s.updatePageMeta)
  const clearFocusTitle = useAppStore((s) => s.clearFocusTitle)

  const [content, setContent] = useState<JSONContent | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const editorRef = useRef<TiptapEditor | null>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const [previewWidth, setPreviewWidth] = useState<PageWidth | undefined>(undefined)
  // Arrived via a block reference: remember which block to show once the editor is up.
  const pendingBlock = useRef<string | null>(null)
  if (pendingBlock.current === null) {
    const id = useAppStore.getState().highlightBlockId
    if (id) {
      pendingBlock.current = id
      useAppStore.setState({ highlightBlockId: null })
    }
  }
  const titleRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let cancelled = false
    // Any edits still waiting in the debounce must hit the disk before we read,
    // otherwise quickly switching A → B → A would show stale content.
    autoSaver
      .flush(pageId)
      .then(() => api.readPage(pageId))
      .then((page) => {
        if (!cancelled) setContent(page?.content ?? null)
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setError(String(err?.message ?? err))
      })
    return () => {
      cancelled = true
    }
  }, [pageId])

  const onChange = useCallback(
    (json: JSONContent) => {
      autoSaver.schedule({ id: pageId, content: json })
      // An open find bar recounts its matches.
      if (useFindStore.getState().open) useFindStore.getState().contentChanged()
    },
    [pageId],
  )

  // Ctrl+F finds in this page's editor.
  useEffect(() => setFindTarget(editorFindProvider(() => editorRef.current)), [])

  // If the user presses Enter in the title before the editor finished loading,
  // remember it and focus once the editor is ready.
  const pendingBodyFocus = useRef(false)
  const focusEditorStart = useCallback(() => {
    const editor = editorRef.current
    if (!editor) {
      pendingBodyFocus.current = true
      return
    }
    // Focus synchronously (commands.focus defers to the next frame, which can drop fast keystrokes).
    editor.commands.setTextSelection(1)
    editor.view.focus()
  }, [])
  const onEditorReady = useCallback(
    (editor: TiptapEditor) => {
      editorRef.current = editor
      useFindStore.getState().contentChanged()
      // TipTap may create the editor twice while mounting; act on the one that survives.
      setTimeout(() => {
        const blockId = pendingBlock.current
        if (!blockId || editor.isDestroyed) return
        pendingBlock.current = ''
        if (!editor.commands.flashBlock(blockId)) useAppStore.getState().showToast('That block no longer exists')
      }, 60)
      if (pendingBodyFocus.current) {
        pendingBodyFocus.current = false
        focusEditorStart()
      }
    },
    [focusEditorStart],
  )
  const focusTitleEnd = useCallback(() => {
    const el = titleRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  const autoFocusTitle = focusTitleFor === pageId
  useEffect(() => {
    if (autoFocusTitle) clearFocusTitle()
  }, [autoFocusTitle, clearFocusTitle])

  // Right-click on the page: its menu offers "Copy page" (as rich text, Markdown or plain text).
  const titleNow = useRef('')
  titleNow.current = meta?.title ?? ''
  useEffect(
    () =>
      api.pageMenu.onCopyPage((format) => {
        const editor = editorRef.current
        if (lastContextPage !== pageId || !editor || editor.isDestroyed) return
        copyPage(editor, titleNow.current, format)
          .then(() => useAppStore.getState().showToast(format === 'markdown' ? 'Page copied as Markdown' : format === 'text' ? 'Page copied as plain text' : 'Page copied'))
          .catch((err) => useAppStore.getState().showToast(`Could not copy the page: ${String((err as Error)?.message ?? err)}`))
      }),
    [pageId],
  )

  if (!meta) return null
  // While dragging a width handle, preview the new width before saving it.
  const columnStyle = { ...widthStyle(previewWidth !== undefined ? previewWidth : meta.width), ...fontStyle(meta.font) }

  return (
    <div
      className="animate-fade-in"
      onContextMenu={(e) => {
        if (e.defaultPrevented) return
        lastContextPage = pageId
        api.pageMenu.setOnPage(true)
      }}
    >
      <PageHeader
        page={meta}
        titleRef={titleRef}
        autoFocusTitle={autoFocusTitle}
        onChange={(patch) => updatePageMeta(pageId, patch)}
        onEnterBody={focusEditorStart}
        columnStyle={columnStyle}
      />
      <div ref={columnRef} className="relative mx-auto w-full px-12 pt-2 md:px-24" style={columnStyle}>
        <WidthHandles columnRef={columnRef} onPreview={setPreviewWidth} onCommit={(width) => updatePageMeta(pageId, { width })} />
        {error ? (
          <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">Failed to load page: {error}</div>
        ) : content === undefined ? (
          <div className="flex items-center gap-2 py-4 text-sm opacity-50">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : (
          <Editor
            pageId={pageId}
            initialContent={content}
            onChange={onChange}
            onReady={onEditorReady}
            onExitTop={focusTitleEnd}
          />
        )}
        {content !== undefined && <Backlinks pageId={pageId} />}
      </div>
    </div>
  )
}
