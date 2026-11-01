import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PageOptions } from '@/components/TitleBar/PageOptions'
import { WidthHandles } from '@/components/Editor/WidthHandles'
import { useAppStore } from '@/stores/useAppStore'
import { autoSaver } from '@/lib/autoSave'

const initial = useAppStore.getState()
beforeEach(() => {
  localStorage.clear()
  useAppStore.setState({ ...initial, pages: [], activePageId: null }, true)
})
const page = () => useAppStore.getState().pages[0]

describe('PageOptions (page width menu)', () => {
  it('switches presets, uses the slider and auto-saves the width', async () => {
    const id = await useAppStore.getState().createPage(null, { title: 'IELTS' })
    const schedule = vi.spyOn(autoSaver, 'schedule')
    render(<PageOptions pageId={id} />)
    await userEvent.click(screen.getByRole('button', { name: 'Page options' }))
    expect(screen.getByRole('radio', { name: 'Default' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: 'Full' }))
    expect(page().width).toBe('full')
    await userEvent.click(screen.getByRole('radio', { name: 'Wide' }))
    expect(page().width).toBe(1500)
    expect(screen.getByText('Wide', { selector: 'span' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Custom page width'), { target: { value: '1010' } })
    expect(page().width).toBe(1010)
    expect(schedule).toHaveBeenLastCalledWith({ id, width: 1010 })
  })
})

describe('WidthHandles', () => {
  it('previews while dragging, saves on release and resets on double-click', () => {
    const column = document.createElement('div')
    column.getBoundingClientRect = () => ({ left: 500, width: 900, right: 1400, top: 0, bottom: 0, height: 0, x: 500, y: 0, toJSON: () => ({}) })
    // The page area (#canvas-scroll) is 1800px wide, like a large window.
    const scroller = document.createElement('div')
    scroller.id = 'canvas-scroll'
    Object.defineProperty(scroller, 'clientWidth', { value: 1800 })
    scroller.appendChild(document.createElement('div')).appendChild(column)
    document.body.appendChild(scroller)
    const ref = createRef<HTMLDivElement>() as { current: HTMLDivElement }
    ref.current = column
    const onPreview = vi.fn()
    const onCommit = vi.fn()
    render(<WidthHandles columnRef={ref} onPreview={onPreview} onCommit={onCommit} />)
    const right = screen.getByRole('separator', { name: /right edge/ })
    // center is at 950; dragging the right edge to 1700 → 2 × 750 = 1500px (Wide)
    fireEvent.pointerDown(right, { clientX: 1400 })
    fireEvent.pointerMove(right, { clientX: 1700 })
    expect(onPreview).toHaveBeenLastCalledWith(1500)
    expect(screen.getByText('Wide')).toBeInTheDocument() // live label
    fireEvent.pointerUp(right)
    expect(onCommit).toHaveBeenCalledWith(1500)
    // dragging to the window edge snaps to full width
    fireEvent.pointerDown(right, { clientX: 1400 })
    fireEvent.pointerMove(right, { clientX: 1845 })
    fireEvent.pointerUp(right)
    expect(onCommit).toHaveBeenLastCalledWith('full')
    expect(onPreview).toHaveBeenLastCalledWith(undefined)
    fireEvent.doubleClick(screen.getByRole('separator', { name: /left edge/ }))
    expect(onCommit).toHaveBeenLastCalledWith(null)
    onCommit.mockClear()
    // Regression: a plain click on an edge (or a 1–2 px wobble) must not change the width.
    fireEvent.pointerDown(right, { clientX: 1400 })
    fireEvent.pointerUp(right)
    fireEvent.pointerDown(right, { clientX: 1400 })
    fireEvent.pointerMove(right, { clientX: 1402 })
    fireEvent.pointerUp(right)
    // Right/middle mouse buttons don't start a resize.
    fireEvent.pointerDown(right, { clientX: 1400, button: 2 })
    fireEvent.pointerMove(right, { clientX: 1700 })
    fireEvent.pointerUp(right)
    expect(onCommit).not.toHaveBeenCalled()
  })
})
