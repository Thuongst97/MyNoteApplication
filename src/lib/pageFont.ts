/**
 * Per-page fonts (like Notion's Default / Serif / Mono, plus a few more). Every font is
 * bundled with the app (works offline). Fonts without Vietnamese letters fall back to a
 * similar font that has them.
 */
export interface PageFont {
  /** Stored on the page; null = the app's default font. */
  id: string | null
  label: string
  /** CSS font-family; undefined = inherit the app font. */
  stack?: string
  /** Text size factor for fonts that look small (handwriting). */
  scale?: number
}

export const PAGE_FONTS: PageFont[] = [
  { id: null, label: 'Default' },
  { id: 'serif', label: 'Serif', stack: "'Lora', Georgia, 'Times New Roman', serif" },
  { id: 'mono', label: 'Mono', stack: "'iA Writer Mono', 'JetBrains Mono', ui-monospace, Menlo, monospace" },
  { id: 'writer', label: 'Writer', stack: "'iA Writer Quattro', 'Inter', ui-sans-serif, sans-serif" },
  { id: 'inter', label: 'Inter', stack: "'Inter', ui-sans-serif, system-ui, sans-serif" },
  { id: 'book', label: 'Book', stack: "'Merriweather', Georgia, serif" },
  { id: 'code', label: 'Code', stack: "'JetBrains Mono', ui-monospace, Menlo, monospace" },
  { id: 'rounded', label: 'Rounded', stack: "'Nunito', ui-rounded, ui-sans-serif, sans-serif" },
  { id: 'hand', label: 'Handwriting', stack: "'Caveat', 'Nunito', cursive", scale: 1.25 },
]

const BY_ID = new Map(PAGE_FONTS.filter((f) => f.id).map((f) => [f.id as string, f]))

/** A known font id, or null (default) for anything else. */
export function normalizeFont(value: unknown): string | null {
  return typeof value === 'string' && BY_ID.has(value) ? value : null
}

export function pageFont(id: string | null | undefined): PageFont {
  return (id && BY_ID.get(id)) || PAGE_FONTS[0]
}

/** Style for the page column (title + content). */
export function fontStyle(id: string | null | undefined): { fontFamily?: string; fontSize?: string } {
  const f = pageFont(id)
  return { ...(f.stack && { fontFamily: f.stack }), ...(f.scale && { fontSize: `${f.scale}em` }) }
}
