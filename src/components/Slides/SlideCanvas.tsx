import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import { createEditorExtensions } from '@/components/Editor/extensions'
import { SLIDE_BACKGROUNDS, type SlideData } from '@/lib/presentation'
import { fontStyle } from '@/lib/pageFont'
import { cn } from '@/lib/utils'

/** Slides are laid out on a fixed 16:9 canvas and zoomed to whatever box shows them. */
export const SLIDE_W = 1280
export const SLIDE_H = 720
export const PAD_X = 88
export const PAD_Y = 64

/** Inline style + classes for a slide's background (dark ones get light text). */
export function slideLook(slide: Pick<SlideData, 'background' | 'layout'>) {
  const bg = SLIDE_BACKGROUNDS[slide.background] ?? SLIDE_BACKGROUNDS.default
  return {
    className: cn('slide-surface', `slide-layout-${slide.layout}`, bg.color && (bg.dark ? 'slide-dark' : 'slide-light')),
    style: bg.color ? { background: bg.color } : undefined,
  }
}

/** Zoom that makes a SLIDE_W-wide surface fill the measured box (or `width`). */
function useFitZoom(width?: number) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [boxW, setBoxW] = useState(width ?? 0)
  useLayoutEffect(() => {
    if (width) return setBoxW(width)
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth))
    ro.observe(el)
    setBoxW(el.clientWidth)
    return () => ro.disconnect()
  }, [width])
  return { boxRef, zoom: boxW > 0 ? boxW / SLIDE_W : 0.0001 }
}

/** A 16:9 box holding a SLIDE_W×SLIDE_H slide surface; `children` draw the slide's body. */
export function SlideFrame({
  slide,
  font,
  width,
  className,
  children,
}: {
  slide: Pick<SlideData, 'background' | 'layout'>
  font?: string | null
  width?: number
  className?: string
  children: ReactNode
}) {
  const { boxRef, zoom } = useFitZoom(width)
  const look = slideLook(slide)
  return (
    <div ref={boxRef} className={cn('relative w-full overflow-hidden', className)} style={{ aspectRatio: '16 / 9', ...(width && { width }) }}>
      <div
        className={cn('absolute left-0 top-0 bg-canvas-light text-ink-light dark:bg-canvas-dark dark:text-ink-dark', look.className)}
        style={{ width: SLIDE_W, height: SLIDE_H, zoom, ...fontStyle(font as never), ...look.style }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * Keeps a slide's blocks inside the slide: when there's too much, they shrink (down to
 * `min`), like PowerPoint's autofit. Returns the ref for the content box and the zoom.
 */
export function useAutoFit(deps: unknown[], min = 0.5) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)
  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const fit = () => {
      const natural = el.scrollHeight / zoomRef.current
      const avail = SLIDE_H - PAD_Y * 2
      const next = Math.max(min, Math.min(1, avail / Math.max(1, natural)))
      if (Math.abs(next - zoomRef.current) > 0.01) {
        zoomRef.current = next
        setZoom(next)
      }
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { innerRef, zoom }
}

/** A slide's blocks, read-only, rendered by the real editor so every block looks as on a page. */
export const SlideBody = memo(function SlideBody({ content }: { content: JSONContent }) {
  const extensions = useMemo(() => createEditorExtensions(), [])
  const editor = useEditor({ editable: false, extensions, content, immediatelyRender: true, editorProps: { attributes: { class: 'notion-editor' } } })
  // Follow edits without re-creating the editor.
  useEffect(() => {
    if (editor && !editor.isDestroyed && content !== undefined) editor.commands.setContent(content, { emitUpdate: false })
  }, [editor, content])
  const { innerRef, zoom } = useAutoFit([editor, content])

  return (
    <div className="slide-body" style={{ padding: `${PAD_Y}px ${PAD_X}px` }}>
      <div ref={innerRef} className="slide-content" style={{ zoom }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
})

/** A whole read-only slide (thumbnails, present mode). */
export const SlideView = memo(function SlideView({ slide, font, width, className }: { slide: SlideData; font?: string | null; width?: number; className?: string }) {
  return (
    <SlideFrame slide={slide} font={font} width={width} className={className}>
      <SlideBody content={slide.content} />
    </SlideFrame>
  )
})
