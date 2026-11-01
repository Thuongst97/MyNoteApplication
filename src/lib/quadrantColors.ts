/** Custom quadrant colors for the Eisenhower Matrix (shared by the main process and the UI). */
export type QuadrantId = 'do' | 'schedule' | 'delegate' | 'eliminate'
export type QuadrantColors = Partial<Record<QuadrantId, string>>

const IDS: QuadrantId[] = ['do', 'schedule', 'delegate', 'eliminate']
const HEX = /^#[0-9a-f]{6}$/i

/** Keeps only `#rrggbb` colors for known quadrants. */
export function cleanQuadrantColors(raw: unknown): QuadrantColors {
  const out: QuadrantColors = {}
  if (!raw || typeof raw !== 'object') return out
  for (const id of IDS) {
    const c = (raw as Record<string, unknown>)[id]
    if (typeof c === 'string' && HEX.test(c)) out[id] = c.toLowerCase()
  }
  return out
}

/** Soft presets offered in the quadrant color picker. */
export const QUADRANT_PRESETS = [
  '#f87171', // muted rose
  '#e0896b', // terracotta
  '#d7b57e', // warm sand
  '#8fbf9f', // sage
  '#6bb5b0', // teal
  '#7fa7d9', // slate blue
  '#a99bd8', // lavender
  '#c994b8', // mauve
  '#9ca3af', // ghost gray
  '#6b7280', // slate
]

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (c: number[]) =>
  '#' +
  c
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
/** `amount` of `a` mixed into `b`. */
export const mix = (a: string, b: string, amount: number) => {
  const [x, y] = [rgb(a), rgb(b)]
  return toHex(x.map((v, i) => v * amount + y[i] * (1 - amount)))
}
export const alpha = (hex: string, a: number) => `rgba(${rgb(hex).join(', ')}, ${a})`

/**
 * Colors for a quadrant painted in a custom color: a whisper-light tint, a thin translucent
 * border, and an icon color that keeps enough contrast on the tint.
 */
export function quadrantPalette(hex: string, theme: 'light' | 'dark') {
  if (theme === 'dark') return { background: alpha(hex, 0.06), border: alpha(hex, 0.28), accent: mix(hex, '#ffffff', 0.8), ring: alpha(hex, 0.55) }
  return { background: mix(hex, '#ffffff', 0.07), border: alpha(hex, 0.45), accent: mix(hex, '#1f2937', 0.82), ring: alpha(hex, 0.5) }
}
