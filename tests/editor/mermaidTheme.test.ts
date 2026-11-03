import { describe, expect, it } from 'vitest'
import { DARK_THEME_VARIABLES as V, mermaidThemeConfig } from '@/components/Editor/mermaid/renderMermaid'

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const c = (k: string) => String(V[k])

describe('mermaid dark theme', () => {
  it('uses the customizable base theme in dark mode only', () => {
    expect(mermaidThemeConfig('dark')).toEqual({ theme: 'base', themeVariables: V })
    expect(mermaidThemeConfig('light')).toEqual({ theme: 'default' })
  })

  it('every color is a hex color (mermaid derives shades from them)', () => {
    for (const [k, v] of Object.entries(V)) if (typeof v === 'string' && /color|bkg|fill|border|^pie\d|^cScale|^git\d|background/i.test(k) && !/width|opacity/i.test(k)) expect(v, k).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('text is readable (WCAG AA 4.5:1) on what it sits on', () => {
    const pairs: Array<[string, string]> = [
      ['primaryTextColor', 'primaryColor'],
      ['nodeTextColor', 'mainBkg'],
      ['textColor', 'background'],
      ['stateLabelColor', 'stateBkg'],
      ['actorTextColor', 'actorBkg'],
      ['labelTextColor', 'labelBoxBkgColor'],
      ['noteTextColor', 'noteBkgColor'],
      ['classText', 'mainBkg'],
      ['transitionLabelColor', 'edgeLabelBackground'],
      ['relationLabelColor', 'relationLabelBackground'],
      ['taskTextColor', 'taskBkgColor'],
      ['taskTextOutsideColor', 'background'],
      ['pieTitleTextColor', 'background'],
      ['pieLegendTextColor', 'background'],
      ['quadrant1TextFill', 'quadrant1Fill'],
      ['quadrant4TextFill', 'quadrant4Fill'],
    ]
    for (const [fg, bg] of pairs) expect(contrast(c(fg), c(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
  })

  it('nodes, lines and slices stand out from the page', () => {
    // Borders and lines: at least 3:1 against the page (non-text contrast).
    for (const k of ['primaryBorderColor', 'nodeBorder', 'lineColor', 'actorBorder', 'stateBorder']) expect(contrast(c(k), c('background')), k).toBeGreaterThanOrEqual(3)
    for (let i = 1; i <= 8; i++) expect(contrast(c(`pie${i}`), c('background')), `pie${i}`).toBeGreaterThanOrEqual(3)
  })
})
