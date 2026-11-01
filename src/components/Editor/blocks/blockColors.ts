import type { Theme } from '@/stores/useAppStore'

/** Notion-like soft background colors for callouts and boards (light / dark). */
export const BLOCK_COLORS = {
  default: { label: 'Default', light: '#f1f1ef', dark: '#252525', accent: '#787774' },
  beige: { label: 'Beige', light: '#f4ece6', dark: '#2c2723', accent: '#9f6b53' },
  brown: { label: 'Brown', light: '#f4eeee', dark: '#2e2724', accent: '#9f6b53' },
  orange: { label: 'Orange', light: '#fbecdd', dark: '#36291f', accent: '#d9730d' },
  yellow: { label: 'Yellow', light: '#fbf3db', dark: '#372e20', accent: '#cb912f' },
  green: { label: 'Green', light: '#edf3ec', dark: '#242b26', accent: '#448361' },
  blue: { label: 'Blue', light: '#e7f3f8', dark: '#1f282d', accent: '#337ea9' },
  purple: { label: 'Purple', light: '#f6f3f9', dark: '#2a2430', accent: '#9065b0' },
  pink: { label: 'Pink', light: '#faf1f5', dark: '#2e2328', accent: '#c14c8a' },
  red: { label: 'Red', light: '#fdebec', dark: '#332523', accent: '#d44c47' },
  none: { label: 'No background', light: 'transparent', dark: 'transparent', accent: '#787774' },
} as const

export type BlockColor = keyof typeof BLOCK_COLORS
export const BLOCK_COLOR_IDS = Object.keys(BLOCK_COLORS) as BlockColor[]

export function normalizeBlockColor(v: unknown, fallback: BlockColor = 'default'): BlockColor {
  return typeof v === 'string' && v in BLOCK_COLORS ? (v as BlockColor) : fallback
}

export function blockBackground(color: unknown, theme: Theme): string {
  const c = BLOCK_COLORS[normalizeBlockColor(color)]
  return theme === 'dark' ? c.dark : c.light
}

export function blockAccent(color: unknown): string {
  return BLOCK_COLORS[normalizeBlockColor(color)].accent
}
