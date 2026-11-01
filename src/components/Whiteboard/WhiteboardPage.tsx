import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Shapes } from 'lucide-react'
import { api } from '@/lib/api'
import { autoSaver } from '@/lib/autoSave'
import { useAppStore } from '@/stores/useAppStore'
import { normalizeDrawing } from '@/components/Editor/drawing/drawingModel'
import { externalizeFiles, externalizeFilesSync, inlineFiles } from '@/lib/sceneFiles'

const WhiteboardCanvas = lazy(() => import('./WhiteboardCanvas'))

export interface WhiteboardContent {
  type: 'whiteboard'
  scene: { elements: unknown[]; files: Record<string, unknown>; background?: string }
}

/** A page that is one infinite canvas. Mount with key={pageId}. */
export function WhiteboardPage({ pageId }: { pageId: string }) {
  const meta = useAppStore((s) => s.pages.find((p) => p.id === pageId))
  const theme = useAppStore((s) => s.theme)
  const updatePageMeta = useAppStore((s) => s.updatePageMeta)
  const [content, setContent] = useState<WhiteboardContent | null>(null)

  // Saves keep images as asset files, not base64 inside the page. New images are
  // uploaded first; saves stay in order.
  const queue = useRef<Promise<void> | null>(null)
  const save = useCallback(
    (scene: WhiteboardContent['scene']) => {
      const write = (files: WhiteboardContent['scene']['files']) =>
        autoSaver.schedule({ id: pageId, content: { type: 'whiteboard', scene: { ...scene, files } } as never })
      const ready = queue.current ? null : externalizeFilesSync(scene.files)
      if (ready) return write(ready)
      const run: Promise<void> = (queue.current ?? Promise.resolve())
        .then(() => externalizeFiles(scene.files))
        .then(({ files }) => write(files))
        .finally(() => {
          if (queue.current === run) queue.current = null
        })
      queue.current = run
    },
    [pageId],
  )

  useEffect(() => {
    let cancelled = false
    void autoSaver
      .flush(pageId)
      .then(() => api.readPage(pageId))
      .then(async (page) => {
        if (cancelled) return
        // Damaged or unexpected content opens as an empty board instead of crashing.
        const c = page?.content as WhiteboardContent | null
        const scene = normalizeDrawing({ scene: c?.type === 'whiteboard' ? c.scene : null }).scene
        // Images are stored as asset files; Excalidraw needs them inline while open.
        const files = await inlineFiles(scene.files)
        if (cancelled) return
        setContent({ type: 'whiteboard', scene: { ...scene, files, background: typeof c?.scene?.background === 'string' ? scene.background : undefined } })
      })
    return () => {
      cancelled = true
    }
  }, [pageId])

  // App shortcuts pause while the canvas is on screen (it has its own).
  useEffect(() => {
    document.body.classList.add('drawing-open')
    return () => document.body.classList.remove('drawing-open')
  }, [])

  if (!meta) return null
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-6 pb-2 pt-1">
        <span className="text-xl leading-none">{meta.icon ?? <Shapes size={18} className="opacity-60" />}</span>
        <input
          value={meta.title}
          onChange={(e) => updatePageMeta(pageId, { title: e.target.value })}
          placeholder="Untitled whiteboard"
          className="min-w-0 flex-1 bg-transparent text-2xl font-bold tracking-tight outline-none placeholder:text-ink-light/25 dark:placeholder:text-ink-dark/25"
          aria-label="Whiteboard title"
        />
        <span className="text-xs opacity-40">Infinite canvas · scroll to pan, Ctrl+scroll to zoom</span>
      </div>
      <div className="relative min-h-0 flex-1 border-t border-black/5 dark:border-white/5">
        {content ? (
          <Suspense fallback={<Centered />}>
            <WhiteboardCanvas
              key={pageId}
              theme={theme}
              initial={content}
              onChange={save}
            />
          </Suspense>
        ) : (
          <Centered />
        )}
      </div>
    </div>
  )
}

function Centered() {
  return (
    <div className="flex h-full items-center justify-center opacity-50">
      <Loader2 className="animate-spin" />
    </div>
  )
}
