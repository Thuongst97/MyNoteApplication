import { describe, expect, it } from 'vitest'
import { APP_THEMES, appTheme, appThemeVars, rgbChannels } from '@/lib/appThemes'
import { useAppStore } from '@/stores/useAppStore'

describe('app themes', () => {
  it('offers several light and dark themes, including Pure White', () => {
    const light = APP_THEMES.filter((t) => t.mode === 'light').map((t) => t.id)
    const dark = APP_THEMES.filter((t) => t.mode === 'dark').map((t) => t.id)
    expect(light).toEqual(['light', 'white', 'paper', 'sand', 'mint', 'sky', 'lavender', 'rose'])
    expect(dark).toEqual(['dark', 'midnight', 'arctic', 'graphite', 'forest'])
    expect(new Set(APP_THEMES.map((t) => t.id)).size).toBe(APP_THEMES.length)
  })
  it('sets the colors as CSS variables for its mode', () => {
    expect(rgbChannels('#F9F9F7')).toBe('249 249 247')
    expect(appThemeVars(appTheme('white', 'light'))).toEqual({ '--pn-canvas-light': '255 255 255', '--pn-sidebar-light': '249 249 247', '--pn-ink-light': '31 30 29' })
    expect(Object.keys(appThemeVars(appTheme('midnight', 'dark')))).toEqual(['--pn-canvas-dark', '--pn-sidebar-dark', '--pn-ink-dark'])
  })
  it('falls back to the classic theme of the mode for unknown or wrong-mode ids', () => {
    expect(appTheme('nope', 'light').id).toBe('light')
    expect(appTheme('midnight', 'light').id).toBe('light')
    expect(appTheme('paper', 'dark').id).toBe('dark')
  })
  it('picking a theme switches the mode and remembers one theme per mode', () => {
    const s = useAppStore.getState()
    s.setAppTheme('midnight')
    expect(useAppStore.getState()).toMatchObject({ theme: 'dark', darkTheme: 'midnight' })
    s.setAppTheme('paper')
    expect(useAppStore.getState()).toMatchObject({ theme: 'light', lightTheme: 'paper', darkTheme: 'midnight' })
    s.toggleTheme()
    expect(useAppStore.getState()).toMatchObject({ theme: 'dark', darkTheme: 'midnight' })
    s.setAppTheme('unknown')
    expect(useAppStore.getState().theme).toBe('dark')
  })
})
