import { describe, expect, it } from 'vitest'
import { resolveMindColor, textOn, MIND_TOKENS } from '@/components/Editor/mindmap/MindMapSvg'
import { SERIES_COLORS } from '@/components/Editor/chart/chartModel'

describe('mind map colors', () => {
  it('resolves palette colors per theme, custom colors as-is, and the default central color', () => {
    expect(resolveMindColor(0, 'light')).toBe(SERIES_COLORS.light[0])
    expect(resolveMindColor(0, 'dark')).toBe(SERIES_COLORS.dark[0])
    expect(resolveMindColor(9, 'light')).toBe(SERIES_COLORS.light[1])
    expect(resolveMindColor('#ff8800', 'dark')).toBe('#ff8800')
    expect(resolveMindColor(-1, 'dark')).toBe(MIND_TOKENS.dark.rootFill)
  })

  it('picks readable text on custom fills', () => {
    expect(textOn('#ffffff')).toBe('#191919')
    expect(textOn('#ffe066')).toBe('#191919')
    expect(textOn('#1c3d6e')).toBe('#ffffff')
    expect(textOn('not-a-color')).toBe('#ffffff')
  })
})
