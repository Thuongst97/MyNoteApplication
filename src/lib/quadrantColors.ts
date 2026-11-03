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

/** Background choices for a quadrant: plain white, or a Windows Sticky Notes color. */
export type QuadrantBackground = 'white' | 'yellow' | 'green' | 'pink' | 'purple' | 'blue' | 'gray' | 'charcoal'
export type QuadrantBackgrounds = Partial<Record<QuadrantId, QuadrantBackground>>

/**
 * Sticky Notes palette (as in Windows): a pale paper body and a slightly deeper band across
 * the top. Charcoal is dark paper, so its text is light.
 */
export const STICKY: Record<Exclude<QuadrantBackground, 'white'>, { label: string; body: string; band: string; dark?: boolean }> = {
  yellow: { label: 'Yellow', body: '#FFF7D1', band: '#FFF2AB' },
  green: { label: 'Green', body: '#E4F9E0', band: '#CBF1C4' },
  pink: { label: 'Pink', body: '#FFE4F1', band: '#FFCCE5' },
  purple: { label: 'Purple', body: '#F2E6FF', band: '#E7CFFF' },
  blue: { label: 'Blue', body: '#E2F1FF', band: '#CDE9FF' },
  gray: { label: 'Gray', body: '#F3F2F1', band: '#E0E0E0' },
  charcoal: { label: 'Charcoal', body: '#696969', band: '#454545', dark: true },
}

export const QUADRANT_BACKGROUNDS: QuadrantBackground[] = ['white', 'yellow', 'green', 'pink', 'purple', 'blue', 'gray', 'charcoal']

/** Keeps only known background choices for known quadrants. */
export function cleanQuadrantBackgrounds(raw: unknown): QuadrantBackgrounds {
  const out: QuadrantBackgrounds = {}
  if (!raw || typeof raw !== 'object') return out
  for (const id of IDS) {
    const v = (raw as Record<string, unknown>)[id]
    if (typeof v === 'string' && (QUADRANT_BACKGROUNDS as string[]).includes(v)) out[id] = v as QuadrantBackground
  }
  return out
}
