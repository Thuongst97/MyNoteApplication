import { describe, expect, it } from 'vitest'
import { clampZoom, createWheelAccumulator, stepZoom } from '@/lib/zoom'

describe('app zoom', () => {
  it('steps through browser-like zoom levels', () => {
    expect(stepZoom(1, 1)).toBe(1.1)
    expect(stepZoom(1.1, 1)).toBe(1.25)
    expect(stepZoom(1, -1)).toBe(0.9)
    expect(stepZoom(1.05, -1)).toBe(1)
    expect(stepZoom(3, 1)).toBe(3)
    expect(stepZoom(0.5, -1)).toBe(0.5)
    expect(stepZoom(NaN, 1)).toBe(1.1)
  })

  it('clamps stored values', () => {
    expect(clampZoom('1.25')).toBe(1.25)
    expect(clampZoom(10)).toBe(3)
    expect(clampZoom(0.1)).toBe(0.5)
    expect(clampZoom('abc')).toBe(1)
    expect(clampZoom(-2)).toBe(1)
  })

  it('turns wheel notches into one step each and pinch gestures into gradual steps', () => {
    const acc = createWheelAccumulator()
    // Mouse wheel: one notch up = zoom in, one down = zoom out.
    expect(acc(-100, 0, 0)).toBe(1)
    expect(acc(100, 0, 1000)).toBe(-1)
    // Line-based wheels (Firefox/Linux style).
    expect(acc(-3, 1, 2000)).toBe(1)
    // Trackpad pinch: many tiny deltas add up.
    const pinch = createWheelAccumulator()
    const steps = Array.from({ length: 20 }, (_, i) => pinch(-5, 0, 5000 + i * 16)).filter(Boolean)
    expect(steps).toEqual([1, 1])
    // A pause resets the partial amount.
    expect(pinch(-30, 0, 9000)).toBe(0)
    expect(pinch(-30, 0, 9500)).toBe(0)
  })
})
