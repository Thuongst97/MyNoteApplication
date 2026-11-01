export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * True when a window fills the screen's work area. On Windows, frameless windows that are
 * snapped or maximized by the OS (Win+↑, dragging to the top, double-clicking the title area)
 * don't always report isMaximized() or fire maximize/unmaximize events, so the bounds are
 * checked too. Maximized windows can stick out a few pixels (invisible resize borders).
 */
export function fillsWorkArea(bounds: Rect, workArea: Rect, tolerance = 16): boolean {
  return (
    Math.abs(bounds.x - workArea.x) <= tolerance &&
    Math.abs(bounds.y - workArea.y) <= tolerance &&
    Math.abs(bounds.x + bounds.width - (workArea.x + workArea.width)) <= tolerance &&
    Math.abs(bounds.y + bounds.height - (workArea.y + workArea.height)) <= tolerance
  )
}

/** A size to restore to when the OS doesn't remember one: 75% of the work area, centered. */
export function defaultRestoreBounds(workArea: Rect, min = { width: 720, height: 480 }): Rect {
  const width = Math.max(min.width, Math.round(workArea.width * 0.75))
  const height = Math.max(min.height, Math.round(workArea.height * 0.75))
  return {
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    width,
    height,
  }
}
