/**
 * App themes: the colors of the window (page, sidebar, text). Each is a light or a dark
 * theme; the light/dark switch (Ctrl+Shift+L) moves between the chosen light theme and the
 * chosen dark one. Everything else (menus, blocks, diagrams) follows light or dark mode.
 */
export interface AppTheme {
  id: string
  name: string
  mode: 'light' | 'dark'
  /** Page background. */
  canvas: string
  sidebar: string
  /** Text. */
  ink: string
  /** Short description for the picker. */
  hint: string
}

export const APP_THEMES: AppTheme[] = [
  // Light
  { id: 'light', name: 'Classic Light', mode: 'light', canvas: '#FFFFFF', sidebar: '#F7F7F5', ink: '#37352F', hint: 'Clean white' },
  { id: 'white', name: 'Pure White', mode: 'light', canvas: '#FFFFFF', sidebar: '#F9F9F7', ink: '#1F1E1D', hint: 'Bright white, crisp dark text' },
  { id: 'paper', name: 'Paper', mode: 'light', canvas: '#FBF8F1', sidebar: '#F2ECDF', ink: '#3B3328', hint: 'Warm, easy on the eyes' },
  { id: 'sand', name: 'Sand', mode: 'light', canvas: '#FDF6E3', sidebar: '#F1E9D2', ink: '#4A5A61', hint: 'Soft yellow, low contrast' },
  { id: 'mint', name: 'Mint', mode: 'light', canvas: '#F7FBF8', sidebar: '#EAF3EE', ink: '#23332B', hint: 'Fresh green tint' },
  { id: 'sky', name: 'Sky', mode: 'light', canvas: '#F8FAFD', sidebar: '#ECF2F9', ink: '#1E2B3B', hint: 'Cool blue tint' },
  { id: 'lavender', name: 'Lavender', mode: 'light', canvas: '#FBFAFE', sidebar: '#F0EDF9', ink: '#2D2A3E', hint: 'Gentle violet tint' },
  { id: 'rose', name: 'Rose', mode: 'light', canvas: '#FDF9F9', sidebar: '#F6ECEE', ink: '#3A2B30', hint: 'Soft pink tint' },
  // Dark
  { id: 'dark', name: 'Classic Dark', mode: 'dark', canvas: '#191919', sidebar: '#202020', ink: '#D4D4D4', hint: 'Neutral dark gray' },
  { id: 'midnight', name: 'Midnight', mode: 'dark', canvas: '#0F141F', sidebar: '#151C2B', ink: '#D5DDEA', hint: 'Deep blue night' },
  { id: 'arctic', name: 'Arctic Night', mode: 'dark', canvas: '#2E3440', sidebar: '#353C4A', ink: '#E5E9F0', hint: 'Cool slate' },
  { id: 'graphite', name: 'Graphite', mode: 'dark', canvas: '#1B1C1F', sidebar: '#232428', ink: '#DADBDF', hint: 'Charcoal, high contrast' },
  { id: 'forest', name: 'Forest', mode: 'dark', canvas: '#141B17', sidebar: '#1A231E', ink: '#D5E3DA', hint: 'Dark green' },
]

export const DEFAULT_LIGHT = 'light'
export const DEFAULT_DARK = 'dark'

export const appTheme = (id: unknown, mode: 'light' | 'dark'): AppTheme =>
  APP_THEMES.find((t) => t.id === id && t.mode === mode) ?? APP_THEMES.find((t) => t.id === (mode === 'light' ? DEFAULT_LIGHT : DEFAULT_DARK))!

/** "#RRGGBB" → "R G B" (for rgb(var(--x) / alpha) colors). */
export function rgbChannels(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

/** CSS variables of a theme (the Tailwind canvas / sidebar / ink colors read them). */
export function appThemeVars(t: AppTheme): Record<string, string> {
  return {
    [`--pn-canvas-${t.mode}`]: rgbChannels(t.canvas),
    [`--pn-sidebar-${t.mode}`]: rgbChannels(t.sidebar),
    [`--pn-ink-${t.mode}`]: rgbChannels(t.ink),
  }
}
