/** Zoom levels used by Ctrl + mouse wheel (same steps as Chrome). */
export const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3]
export const MIN_ZOOM = ZOOM_STEPS[0]
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1]

/** The next zoom step in a direction (+1 in, -1 out), starting from any factor. */
export function stepZoom(current: number, direction: 1 | -1): number {
  const c = Number.isFinite(current) ? current : 1
  if (direction > 0) return ZOOM_STEPS.find((z) => z > c + 0.001) ?? MAX_ZOOM
  return [...ZOOM_STEPS].reverse().find((z) => z < c - 0.001) ?? MIN_ZOOM
}

export function clampZoom(z: unknown): number {
  const n = typeof z === 'number' ? z : Number(z)
  if (!Number.isFinite(n) || n <= 0) return 1
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, n))
}

/**
 * Turns wheel deltas into zoom steps. Mouse wheels send one big delta per notch;
 * trackpads (pinch) send many small ones, so small deltas are accumulated.
 */
export function createWheelAccumulator(threshold = 50) {
  let acc = 0
  let last = 0
  return (deltaY: number, deltaMode: number, now = Date.now()): 1 | -1 | 0 => {
    if (now - last > 400) acc = 0
    last = now
    // deltaMode 1 = lines, 2 = pages.
    const px = deltaMode === 1 ? deltaY * 40 : deltaMode === 2 ? deltaY * 400 : deltaY
    acc += px
    if (Math.abs(acc) < threshold) return 0
    const dir = acc < 0 ? 1 : -1
    acc = 0
    return dir
  }
}
