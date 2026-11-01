/**
 * Page width: a max width in px (content column including its side padding),
 * 'full' to use the whole window, or null for the default.
 */
export type PageWidth = number | 'full' | null

export const DEFAULT_PAGE_WIDTH = 1200
export const MIN_PAGE_WIDTH = 600
export const MAX_PAGE_WIDTH = 2400

export const WIDTH_PRESETS: Array<{ label: string; value: PageWidth }> = [
  { label: 'Narrow', value: 900 },
  { label: 'Default', value: null },
  { label: 'Wide', value: 1500 },
  { label: 'Full width', value: 'full' },
]

/** Accepts anything stored and returns a valid width (rounded to 10px, clamped). */
export function normalizeWidth(value: unknown): PageWidth {
  if (value === 'full') return 'full'
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const w = Math.round(Math.min(MAX_PAGE_WIDTH, Math.max(MIN_PAGE_WIDTH, value)) / 10) * 10
  return w === DEFAULT_PAGE_WIDTH ? null : w
}

/**
 * Space kept free beside the column for every width except Full (up to 160px in total,
 * at most 12% of the page area). Without it, on a small or zoomed window, Default/Wide
 * would fill the whole page and look exactly like Full.
 */
export const SIDE_GUTTER_PX = 160
export const SIDE_GUTTER_RATIO = 0.12

/** CSS max-width for the content column. */
export function widthStyle(width: PageWidth | undefined): { maxWidth: string } {
  if (width === 'full') return { maxWidth: 'none' }
  return { maxWidth: `min(${width ?? DEFAULT_PAGE_WIDTH}px, calc(100% - min(${SIDE_GUTTER_PX}px, ${SIDE_GUTTER_RATIO * 100}%)))` }
}

/** The width in px a page actually uses (for the slider), given the space available. */
export function effectiveWidth(width: PageWidth | undefined, available: number): number {
  const avail = Math.round(available)
  if (width === 'full') return Math.max(MIN_PAGE_WIDTH, avail)
  // Same limit as widthStyle: a non-full page keeps its side gutter.
  const limit = avail - Math.min(SIDE_GUTTER_PX, avail * SIDE_GUTTER_RATIO)
  return Math.round(Math.min(width ?? DEFAULT_PAGE_WIDTH, limit))
}

/**
 * Width while dragging an edge handle: the column stays centered, so it is twice the
 * distance from the center to the pointer. Dragging (almost) to the window edge snaps to full width.
 */
export function widthFromDrag(centerX: number, pointerX: number, available: number): PageWidth {
  const raw = 2 * Math.abs(pointerX - centerX)
  if (raw >= available - 24) return 'full'
  return normalizeWidth(raw)
}

/** Label for the current width ("Default", "Full width" or "1040 px"). */
export function widthLabel(width: PageWidth | undefined): string {
  return WIDTH_PRESETS.find((p) => p.value === (width ?? null))?.label ?? `${width} px`
}
