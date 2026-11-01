import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DiagramViewer, fitView, svgSize, zoomAt } from '@/components/ui/DiagramViewer'

describe('diagram viewer math', () => {
  it('fits a big diagram into the window, centered', () => {
    const v = fitView(4000, 1000, 1096, 696) // 48px padding each side → 1000 × 600 available
    expect(v.k).toBeCloseTo(0.25)
    expect(v.x).toBeCloseTo((1096 - 1000) / 2)
    expect(v.y).toBeCloseTo((696 - 250) / 2)
  })
  it('zooms around the cursor (the point under it stays put)', () => {
    const v = { x: 100, y: 50, k: 1 }
    const z = zoomAt(v, 2, 300, 250)
    // Diagram point under the cursor before: ((300-100)/1, (250-50)/1) = (200, 200)
    expect((300 - z.x) / z.k).toBeCloseTo(200)
    expect((250 - z.y) / z.k).toBeCloseTo(200)
    expect(zoomAt(v, 100, 0, 0).k).toBe(8) // clamped
  })
  it("reads an SVG's natural size from its viewBox", () => {
    const host = document.createElement('div')
    host.innerHTML = '<svg viewBox="0 0 1200 900" width="100%" style="max-width: 300px"></svg>'
    expect(svgSize(host.querySelector('svg')!)).toEqual({ w: 1200, h: 900 })
  })
})

describe('DiagramViewer', () => {
  it('shows the diagram full-window with zoom controls and closes on Esc / ×', () => {
    const onClose = vi.fn()
    render(<DiagramViewer svg={'<svg viewBox="0 0 1000 500"><text>Alice</text></svg>'} title="Mermaid diagram" onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'Mermaid diagram' })
    expect(dialog.querySelector('.diagram-viewer-content svg')!.getAttribute('width')).toBe('1000') // natural size, not 100%
    expect(document.body.classList.contains('drawing-open')).toBe(true) // app shortcuts paused
    const pct = () => screen.getByRole('button', { name: 'Actual size' }).textContent
    const before = pct()
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(pct()).not.toBe(before)
    fireEvent.click(screen.getByRole('button', { name: 'Actual size' }))
    expect(pct()).toBe('100%')
    fireEvent.keyDown(window, { key: '+' })
    expect(pct()).toBe('125%')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
