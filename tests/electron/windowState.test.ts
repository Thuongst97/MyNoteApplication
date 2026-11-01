import { describe, expect, it } from 'vitest'
import { defaultRestoreBounds, fillsWorkArea } from '../../electron/windowState'

const area = { x: 0, y: 0, width: 1920, height: 1040 }

describe('window maximize detection', () => {
  it('treats a window covering the work area as maximized', () => {
    expect(fillsWorkArea(area, area)).toBe(true)
    // Windows: maximized frameless windows stick out by their invisible resize borders.
    expect(fillsWorkArea({ x: -8, y: -8, width: 1936, height: 1056 }, area)).toBe(true)
  })

  it('does not treat normal or half-snapped windows as maximized', () => {
    expect(fillsWorkArea({ x: 100, y: 80, width: 1280, height: 820 }, area)).toBe(false)
    expect(fillsWorkArea({ x: 0, y: 0, width: 960, height: 1040 }, area)).toBe(false)
  })

  it('works on secondary monitors', () => {
    const second = { x: 1920, y: -200, width: 2560, height: 1400 }
    expect(fillsWorkArea({ ...second }, second)).toBe(true)
    expect(fillsWorkArea({ ...area }, second)).toBe(false)
  })

  it('restores to a centered window when no previous size is known', () => {
    const b = defaultRestoreBounds(area)
    expect(b).toEqual({ x: 240, y: 130, width: 1440, height: 780 })
    expect(fillsWorkArea(b, area)).toBe(false)
    expect(defaultRestoreBounds({ x: 0, y: 0, width: 800, height: 500 })).toMatchObject({ width: 720, height: 480 })
  })
})
