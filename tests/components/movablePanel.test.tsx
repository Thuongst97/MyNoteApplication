import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import { useRef } from 'react'
import { clampOffset, resetMovablePanel, useMovableShapePanel } from '@/components/Whiteboard/movablePanel'

const bounds = { left: 0, top: 0, right: 1000, bottom: 800 }
const base = { left: 16, top: 60, right: 216, bottom: 760 } // 200 x 700 panel at the left

describe('clampOffset', () => {
  it('passes offsets that keep the panel inside the canvas', () => {
    expect(clampOffset({ x: 500, y: 0 }, base, bounds)).toEqual({ x: 500, y: 0 })
  })
  it('keeps the whole panel inside horizontally', () => {
    expect(clampOffset({ x: 5000, y: 0 }, base, bounds)).toEqual({ x: 1000 - 8 - 200 - 16, y: 0 })
    expect(clampOffset({ x: -500, y: 0 }, base, bounds)).toEqual({ x: 8 - 16, y: 0 })
  })
  it('keeps the top in view and part of a tall panel on screen vertically', () => {
    expect(clampOffset({ x: 0, y: -500 }, base, bounds).y).toBe(8 - 60)
    expect(clampOffset({ x: 0, y: 5000 }, base, bounds).y).toBe(800 - 8 - 120 - 60)
  })
})

function Host({ children }: { children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useMovableShapePanel(ref)
  return (
    <div ref={ref} className="excalidraw">
      {children}
    </div>
  )
}

describe('useMovableShapePanel', () => {
  beforeEach(() => {
    localStorage.clear()
    resetMovablePanel()
  })
  afterEach(() => localStorage.clear())

  it('adds a grip to the panel whenever Excalidraw shows it, and restores the saved position', async () => {
    localStorage.setItem('premiumnote:shape-panel-offset', JSON.stringify({ x: 0, y: 0 }))
    const { container, rerender } = render(<Host />)
    rerender(
      <Host>
        <section className="selected-shape-actions">
          <div className="Island">panel</div>
        </section>
      </Host>,
    )
    await act(async () => {})
    const panel = container.querySelector<HTMLElement>('section.selected-shape-actions')!
    expect(panel.firstElementChild?.className).toBe('pn-panel-grip')
    expect(panel.querySelectorAll('.pn-panel-grip')).toHaveLength(1)
    // Selection changes re-create the panel: it gets a grip again.
    rerender(<Host />)
    rerender(
      <Host>
        <section className="selected-shape-actions">
          <div className="Island">panel 2</div>
        </section>
      </Host>,
    )
    await act(async () => {})
    expect(container.querySelectorAll('.pn-panel-grip')).toHaveLength(1)
  })

  it('double-clicking the grip resets the position', async () => {
    localStorage.setItem('premiumnote:shape-panel-offset', JSON.stringify({ x: 0, y: 0 }))
    const { container } = render(
      <Host>
        <section className="selected-shape-actions" />
      </Host>,
    )
    await act(async () => {})
    const panel = container.querySelector<HTMLElement>('section')!
    panel.style.translate = '40px 10px'
    panel.querySelector('.pn-panel-grip')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(panel.style.translate).toBe('')
    expect(JSON.parse(localStorage.getItem('premiumnote:shape-panel-offset')!)).toEqual({ x: 0, y: 0 })
  })
})
