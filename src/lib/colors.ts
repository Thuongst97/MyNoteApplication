/** Office-style color palette: theme colors with tint/shade rows, and standard colors. */

export const THEME_COLORS = ['#FFFFFF', '#000000', '#E7E6E6', '#44546A', '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47']
export const STANDARD_COLORS = ['#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0']

function toHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}

function toHex(h: number, s: number, l: number): string {
  const f = (t: number) => {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q
    t = (t + 1) % 1
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p
    return Math.round(v * 255).toString(16).padStart(2, '0')
  }
  return ('#' + (s === 0 ? [l, l, l].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('') : f(h + 1 / 3) + f(h) + f(h - 1 / 3))).toUpperCase()
}

/** Lighten (amount > 0, towards white) or darken (amount < 0) a color by a fraction of its luminance range. */
export function adjust(hex: string, amount: number): string {
  const [h, s, l] = toHsl(hex)
  return toHex(h, s, amount >= 0 ? l + (1 - l) * amount : l * (1 + amount))
}

/** The 5 variations Office shows under a theme color, from lightest to darkest. */
export function variations(hex: string): string[] {
  const l = toHsl(hex)[2]
  if (l >= 0.99) return [-0.05, -0.15, -0.25, -0.35, -0.5].map((a) => adjust(hex, a))
  if (l > 0.8) return [-0.1, -0.25, -0.5, -0.75, -0.9].map((a) => adjust(hex, a))
  if (l < 0.2) return [0.5, 0.35, 0.25, 0.15, 0.05].map((a) => adjust(hex, a))
  return [0.8, 0.6, 0.4, -0.25, -0.5].map((a) => adjust(hex, a))
}

/** Grid of theme colors: first row the colors, then 5 rows of variations (row-major). */
export function themeGrid(): string[][] {
  const cols = THEME_COLORS.map(variations)
  return [THEME_COLORS, ...[0, 1, 2, 3, 4].map((r) => cols.map((c) => c[r]))]
}

/** Colors picked recently (most recent first), shared by text and fill pickers. */
const recent: string[] = []
export function recentColors(): string[] {
  return recent.slice()
}
export function rememberColor(c: string) {
  const v = c.toUpperCase()
  const i = recent.indexOf(v)
  if (i >= 0) recent.splice(i, 1)
  recent.unshift(v)
  recent.length = Math.min(recent.length, 10)
}

export const sameColor = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.toUpperCase() === b.toUpperCase()
