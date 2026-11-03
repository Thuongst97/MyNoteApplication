import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import { createEditorExtensions } from '@/components/Editor/extensions'
import { StaticBlocksContext } from '@/components/Editor/staticBlocks'
import { MAIN_FRAME, PAD_X, PAD_Y, SLIDE_BACKGROUNDS, SLIDE_H, SLIDE_W, buildCss, buildSteps, type Rect, type SlideBox, type SlideData } from '@/lib/presentation'
import { InkLayer } from './InkLayer'
import { fontStyle } from '@/lib/pageFont'
import { cn } from '@/lib/utils'

/** Slides are laid out on a fixed 16:9 canvas (SLIDE_W×SLIDE_H) and zoomed to whatever box shows them. */
export { SLIDE_W, SLIDE_H, PAD_X, PAD_Y }

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
export function useAutoFit(deps: unknown[], min = 0.5, avail = SLIDE_H - PAD_Y * 2) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)
  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const fit = () => {
      const natural = el.scrollHeight / zoomRef.current
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

/** Blocks rendered read-only by the real editor (so every block looks as on a page). */
function useReadOnlyEditor(content: JSONContent) {
  const extensions = useMemo(() => createEditorExtensions(), [])
  const editor = useEditor({ editable: false, extensions, content, immediatelyRender: true, editorProps: { attributes: { class: 'notion-editor' } } })
  // Follow edits without re-creating the editor.
  useEffect(() => {
    if (!editor || editor.isDestroyed || content === undefined) return
    editor.commands.setContent(content, { emitUpdate: false })
    // Nothing looks selected in a picture of the slide (a chart first in a box would be).
    editor.commands.setTextSelection(editor.state.doc.content.size)
  }, [editor, content])
  return editor
}

/** Position style of a rectangle on the slide. */
export const rectStyle = (r: Pick<Rect, 'x' | 'y' | 'w'> & { h?: number }): React.CSSProperties => ({
  position: 'absolute',
  left: r.x,
  top: r.y,
  width: r.w,
  ...(r.h !== undefined && { height: r.h }),
})

/** The slide's main text area, read-only, at its frame; too much content shrinks to fit. */
export const SlideBody = memo(function SlideBody({ content, frame = MAIN_FRAME }: { content: JSONContent; frame?: Rect }) {
  const editor = useReadOnlyEditor(content)
  const { innerRef, zoom } = useAutoFit([editor, content, frame.h], 0.5, frame.h)
  return (
    <div className="slide-main" style={rectStyle(frame)}>
      <div ref={innerRef} className="slide-content" style={{ zoom }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
})

/** A box (chart, code, text…) read-only at its place. */
export const SlideBoxView = memo(function SlideBoxView({ box }: { box: SlideBox }) {
  const editor = useReadOnlyEditor(box.content)
  return (
    <div className="slide-box" data-box-id={box.id} style={rectStyle(box)}>
      <div className="slide-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
})

/** A whole read-only slide (thumbnails, present mode). */
/**
 * A whole read-only slide (thumbnails, present mode). `step`: how many of its click
 * animations are revealed (default: all); `animate` plays the last revealed one.
 * `children` go over the slide (e.g. a drawing layer).
 */
export const SlideView = memo(function SlideView({
  slide,
  font,
  width,
  className,
  still,
  step,
  animate,
  children,
}: {
  slide: SlideData
  font?: string | null
  width?: number
  className?: string
  still?: boolean
  step?: number
  animate?: boolean
  children?: ReactNode
}) {
  const scope = `pn-s${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const steps = useMemo(() => buildSteps(slide), [slide])
  const css = step === undefined || !steps.length ? '' : buildCss(`.${scope}`, steps, step, animate)
  return (
    <SlideFrame slide={slide} font={font} width={width} className={cn(scope, className)}>
      {css && <style>{css}</style>}
      <StaticBlocksContext.Provider value={!!still}>
        <SlideBody content={slide.content} frame={slide.frame} />
        {slide.boxes?.map((b) => <SlideBoxView key={b.id} box={b} />)}
      </StaticBlocksContext.Provider>
      {children ?? (slide.ink?.length ? <InkLayer strokes={slide.ink} /> : null)}
    </SlideFrame>
  )
})
