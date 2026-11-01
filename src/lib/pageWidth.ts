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

/** CSS max-width for the content column. */
export function widthStyle(width: PageWidth | undefined): { maxWidth: string } {
  return { maxWidth: width === 'full' ? 'none' : `${width ?? DEFAULT_PAGE_WIDTH}px` }
}

/** The width in px a page actually uses (for the slider), given the space available. */
export function effectiveWidth(width: PageWidth | undefined, available: number): number {
  if (width === 'full') return Math.max(MIN_PAGE_WIDTH, Math.round(available))
  return Math.min(width ?? DEFAULT_PAGE_WIDTH, Math.max(MIN_PAGE_WIDTH, Math.round(available)))
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
