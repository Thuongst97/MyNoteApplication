import { createContext, memo, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import { createEditorExtensions } from '@/components/Editor/extensions'
import { StaticBlocksContext } from '@/components/Editor/staticBlocks'
import { MAIN_FRAME, PAD_X, PAD_Y, SLIDE_BACKGROUNDS, SLIDE_H, SLIDE_W, buildCss, buildSteps, footerShown, type FooterSettings, type Rect, type SlideBox, type SlideData } from '@/lib/presentation'
import { GRAIN_BG, themeVars, type SlideTheme } from '@/lib/slideThemes'
import { SurfaceThemeContext } from '@/components/Editor/docTheme'
import { InkLayer } from './InkLayer'
import { fontStyle } from '@/lib/pageFont'
import { cn } from '@/lib/utils'

/** Slides are laid out on a fixed 16:9 canvas (SLIDE_W×SLIDE_H) and zoomed to whatever box shows them. */
export { SLIDE_W, SLIDE_H, PAD_X, PAD_Y }

/** What every slide of a deck shares: its theme, footer and numbering. */
export interface DeckInfo {
  theme: SlideTheme | null
  footer: FooterSettings | null
  /** Title shown in the footer when no text is set. */
  title: string
  total: number
  /** 1-based number of a slide (0: unknown). */
  numberOf: (slideId: string) => number
}
export const DeckContext = createContext<DeckInfo | null>(null)

/** Inline style + classes for a slide's background (dark ones get light text) and theme. */
export function slideLook(slide: Pick<SlideData, 'background' | 'layout'>, theme?: SlideTheme | null) {
  const bg = SLIDE_BACKGROUNDS[slide.background] ?? SLIDE_BACKGROUNDS.default
  const dark = bg.color ? !!bg.dark : !!theme?.dark
  return {
    className: cn(
      'slide-surface',
      `slide-layout-${slide.layout}`,
      bg.color && (bg.dark ? 'slide-dark' : 'slide-light'),
      theme && `slide-themed theme-${theme.id}`,
      // Themed dark slides draw their blocks (callouts, code…) in dark style even in light mode.
      theme && dark && 'dark',
    ),
    style: { ...(theme ? themeVars(theme) : {}), ...(bg.color ? { background: bg.color } : theme ? { background: theme.bg, color: theme.text } : {}) } as React.CSSProperties,
    dark,
  }
}

/** The theme's background layers (pattern, glow, title artwork, grain), under the slide's blocks. */
function ThemeLayers({ theme, title }: { theme: SlideTheme; title: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden data-testid="theme-layers">
      {theme.pattern && <div className="absolute inset-0" style={{ background: theme.pattern }} />}
      {theme.glow && <div className="absolute inset-0" style={{ background: theme.glow }} />}
      {/* Static artwork made by the theme (not user content). */}
      {title && <div className="absolute inset-0" dangerouslySetInnerHTML={{ __html: theme.art() }} />}
      <div className="absolute inset-0" style={{ opacity: theme.grain, mixBlendMode: 'overlay', backgroundImage: GRAIN_BG }} />
    </div>
  )
}

/** Footer: hairline, text / date on the left, "03 / 12" on the right. */
function SlideFooter({ deck, slideId }: { deck: DeckInfo; slideId?: string }) {
  const f = deck.footer!
  const n = slideId ? deck.numberOf(slideId) : 0
  const left = [f.text ?? '', f.date ?? ''].filter(Boolean)
  return (
    <div className="slide-footer" data-testid="slide-footer">
      <span>{left.length ? left.join('  ·  ') : ''}</span>
      {f.slideNumbers && n > 0 && (
        <span>
          {String(n).padStart(2, '0')} <span style={{ opacity: 0.5 }}>/ {String(deck.total).padStart(2, '0')}</span>
        </span>
      )}
    </div>
  )
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
  slide: Pick<SlideData, 'background' | 'layout'> & { id?: string }
  font?: string | null
  width?: number
  className?: string
  children: ReactNode
}) {
  const { boxRef, zoom } = useFitZoom(width)
  const deck = useContext(DeckContext)
  const theme = deck?.theme ?? null
  const look = slideLook(slide, theme)
  return (
    <div ref={boxRef} className={cn('relative w-full overflow-hidden', className)} style={{ aspectRatio: '16 / 9', ...(width && { width }) }}>
      <div
        className={cn('absolute left-0 top-0', !theme && 'bg-canvas-light text-ink-light dark:bg-canvas-dark dark:text-ink-dark', look.className)}
        style={{ width: SLIDE_W, height: SLIDE_H, zoom, ...(theme ? {} : fontStyle(font as never)), ...look.style }}
      >
        {theme && <ThemeLayers theme={theme} title={slide.layout === 'title' && slide.background === 'default'} />}
        <SurfaceThemeContext.Provider value={theme ? (look.dark ? 'dark' : 'light') : null}>{children}</SurfaceThemeContext.Provider>
        {deck && footerShown(deck.footer, slide) && <SlideFooter deck={deck} slideId={slide.id} />}
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
