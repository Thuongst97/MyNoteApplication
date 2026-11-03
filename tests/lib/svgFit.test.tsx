import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { fitSvg } from '@/lib/svgFit'
import { HtmlViewer, stepZoom } from '@/components/Editor/html/HtmlViewer'
import { SANDBOX_ESCAPE } from '@/components/Editor/html/HtmlSandbox'

const attrs = (svg: string) => {
  const el = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement
  return (n: string) => el.getAttribute(n)
}

describe('fitSvg (PlantUML diagrams scale instead of being squashed)', () => {
  it('turns PlantUML fixed sizes into proportional scaling', () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg" height="420px" preserveAspectRatio="none" style="width:1800px;height:420px;background:#FFFFFF;" viewBox="0 0 1800 420" width="1800px"><rect width="10" height="10"/></svg>'
    const a = attrs(fitSvg(raw))
    expect(a('preserveAspectRatio')).toBe('xMidYMid meet')
    expect(a('viewBox')).toBe('0 0 1800 420')
    expect(a('width')).toBe('1800')
    expect(a('height')).toBe('420')
    expect(a('style')).toBe('background:#FFFFFF;max-width:1800px;width:100%;height:auto')
    expect(fitSvg(raw)).toContain('<rect')
  })

  it('adds a viewBox from the size when missing', () => {
    const a = attrs(fitSvg('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"></svg>'))
    expect(a('viewBox')).toBe('0 0 300 100')
  })

  it('leaves things it can’t size alone', () => {
    for (const s of ['', 'not svg', '<svg xmlns="http://www.w3.org/2000/svg" width="100%"></svg>', '<div></div>']) expect(fitSvg(s)).toBe(s)
  })
})

describe('HtmlViewer (expanded HTML block)', () => {
  it('zoom steps', () => {
    expect(stepZoom(1, 1)).toBe(1.1)
    expect(stepZoom(1, -1)).toBe(0.9)
    expect(stepZoom(2, 1)).toBe(2)
    expect(stepZoom(0.5, -1)).toBe(0.5)
  })

  it('page widths, zoom and closing (Esc, or Esc inside an interactive block)', () => {
    const onClose = vi.fn()
    render(<HtmlViewer onClose={onClose}>{() => <p>Big page</p>}</HtmlViewer>)
    expect(screen.getByText('Big page')).toBeInTheDocument()
    expect(document.body.classList.contains('drawing-open')).toBe(true)
    const page = screen.getByTestId('html-viewer-page')
    expect(page.dataset.width).toBe('fit')
    fireEvent.click(screen.getByRole('radio', { name: 'Tablet (768)' }))
    expect(page.dataset.width).toBe('768')
    expect(page.parentElement!.style.width).toBe('768px')
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(screen.getByRole('button', { name: 'Reset zoom' })).toHaveTextContent('110%')
    expect(page.parentElement!.style.width).toBe(`${768 * 1.1}px`)
    fireEvent.keyDown(window, { key: '0', ctrlKey: true })
    expect(screen.getByRole('button', { name: 'Reset zoom' })).toHaveTextContent('100%')
    act(() => void window.dispatchEvent(new CustomEvent(SANDBOX_ESCAPE)))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
