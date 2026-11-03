import { describe, expect, it } from 'vitest'
import { alpha, cleanQuadrantColors, mix, quadrantPalette, QUADRANT_PRESETS } from '@/lib/quadrantColors'

describe('quadrant colors', () => {
  it('keeps only #rrggbb colors for the four quadrants', () => {
    expect(cleanQuadrantColors({ do: '#AABBCC', schedule: 'javascript:x', eliminate: '#123', x: '#000000' })).toEqual({ do: '#aabbcc' })
    expect(cleanQuadrantColors(null)).toEqual({})
    expect(cleanQuadrantColors('nope')).toEqual({})
  })

  it('mixes colors and builds rgba strings', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mix('#f87171', '#ffffff', 0)).toBe('#ffffff')
    expect(alpha('#f87171', 0.45)).toBe('rgba(248, 113, 113, 0.45)')
  })

  it('derives a whisper-light tint and a readable icon color in light mode', () => {
    const p = quadrantPalette('#8fbf9f', 'light')
    // Tint is almost white.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(p.background.slice(i, i + 2), 16))
    expect(Math.min(r, g, b)).toBeGreaterThan(235)
    expect(p.border).toBe('rgba(143, 191, 159, 0.45)')
    expect(p.accent).not.toBe('#8fbf9f') // darkened for contrast
  })

  it('uses translucent tints in dark mode', () => {
    const p = quadrantPalette('#7fa7d9', 'dark')
    expect(p.background).toBe('rgba(127, 167, 217, 0.06)')
    expect(p.border).toBe('rgba(127, 167, 217, 0.28)')
  })

  it('offers valid presets', () => {
    expect(QUADRANT_PRESETS.length).toBeGreaterThanOrEqual(8)
    expect(Object.keys(cleanQuadrantColors(Object.fromEntries(QUADRANT_PRESETS.slice(0, 4).map((c, i) => [['do', 'schedule', 'delegate', 'eliminate'][i], c]))))).toHaveLength(4)
  })
})

describe('quadrant backgrounds', () => {
  it('keeps only known choices for known quadrants', async () => {
    const { cleanQuadrantBackgrounds, STICKY } = await import('@/lib/quadrantColors')
    expect(cleanQuadrantBackgrounds({ do: 'yellow', schedule: 'white', delegate: 'url(x)', eliminate: 7, other: 'pink' })).toEqual({ do: 'yellow', schedule: 'white' })
    expect(cleanQuadrantBackgrounds(null)).toEqual({})
    expect(STICKY.yellow).toMatchObject({ body: '#FFF7D1', band: '#FFF2AB' })
    expect(STICKY.charcoal.dark).toBe(true)
  })
})
