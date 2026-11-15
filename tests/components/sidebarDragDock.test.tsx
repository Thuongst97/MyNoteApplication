import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { PageTreeItem, PAGE_DRAG_END, pageDrag } from '@/components/Sidebar/PageTreeItem'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { useAppStore } from '@/stores/useAppStore'
import type { PageMeta } from '@/types'

const page = (id: string, title: string, parentId: string | null, order: number): PageMeta => ({ id, kind: 'doc', title, icon: null, cover: null, parentId, order, createdAt: order, updatedAt: 0 })

/** A DataTransfer good enough for React's drag events in jsdom. */
const dt = () => {
  const data: Record<string, string> = {}
  return { data, setData: (t: string, v: string) => (data[t] = v), getData: (t: string) => data[t] ?? '', types: [] as string[], effectAllowed: 'all', dropEffect: 'none' }
}
/** Rows report a 30px-high box at y=100 (jsdom has no layout). */
const rowAt = (el: Element, top = 100, height = 30) => vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top, height, bottom: top + height, left: 0, right: 200, width: 200, x: 0, y: top, toJSON: () => ({}) } as DOMRect)
const row = (name: string) => screen.getAllByRole('treeitem').find((r) => r.textContent?.includes(name))!

let movePage: ReturnType<typeof vi.fn>
beforeEach(() => {
  movePage = vi.fn(async () => {})
  pageDrag.id = null
  useAppStore.setState({
    pages: [page('ielts', 'IELTS', null, 10), page('writing', 'WRITING', 'ielts', 1), page('speaking', 'SPEAKING', 'ielts', 2), page('notes', 'Notes', null, 20)],
    expanded: { ielts: true },
    movePage,
  } as never)
})
afterEach(() => vi.restoreAllMocks())

const renderTree = () =>
  render(
    <div>
      {useAppStore
        .getState()
        .pages.filter((p) => !p.parentId)
        .map((p) => (
          <PageTreeItem key={p.id} page={p} depth={0} />
        ))}
    </div>,
  )

describe('sidebar: drag pages', () => {
  it('rows are draggable and carry the page id', () => {
    renderTree()
    const t = dt()
    fireEvent.dragStart(row('SPEAKING'), { dataTransfer: t })
    expect(row('SPEAKING')).toHaveAttribute('draggable', 'true')
    expect(t.data['application/x-premiumnote-page']).toBe('speaking')
    expect(pageDrag.id).toBe('speaking')
  })

  it('drop on the middle of a row makes a sub-page (highlighted while hovering)', () => {
    renderTree()
    fireEvent.dragStart(row('SPEAKING'), { dataTransfer: dt() })
    const target = row('Notes')
    rowAt(target)
    fireEvent.dragOver(target, { clientY: 115, dataTransfer: dt() })
    expect(target).toHaveAttribute('data-drop', 'inside')
    fireEvent.drop(target, { clientY: 115, dataTransfer: dt() })
    expect(movePage).toHaveBeenCalledWith('speaking', 'notes', expect.any(Number))
    expect(target).not.toHaveAttribute('data-drop')
  })

  it('top / bottom edge places it before / after, with a guide line', () => {
    renderTree()
    fireEvent.dragStart(row('Notes'), { dataTransfer: dt() })
    const target = row('WRITING')
    rowAt(target)
    fireEvent.dragOver(target, { clientY: 101, dataTransfer: dt() })
    expect(target).toHaveAttribute('data-drop', 'before')
    expect(target.querySelector('[data-drop-line="before"]')).not.toBeNull()
    fireEvent.dragOver(target, { clientY: 129, dataTransfer: dt() })
    expect(target.querySelector('[data-drop-line="after"]')).not.toBeNull()
    fireEvent.drop(target, { clientY: 129, dataTransfer: dt() })
    expect(movePage).toHaveBeenCalledWith('notes', 'ielts', 1.5)
  })

  it('refuses to drop a page into its own sub-page (no highlight, no move)', () => {
    renderTree()
    fireEvent.dragStart(row('IELTS'), { dataTransfer: dt() })
    const target = row('WRITING')
    rowAt(target)
    const over = fireEvent.dragOver(target, { clientY: 115, dataTransfer: dt() })
    expect(over).toBe(true) // not cancelled: the drop is not allowed
    expect(target).not.toHaveAttribute('data-drop')
    fireEvent.drop(target, { clientY: 115, dataTransfer: dt() })
    expect(movePage).not.toHaveBeenCalled()
  })

  it('every guide clears when the drag ends anywhere (no leftover highlight)', () => {
    renderTree()
    fireEvent.dragStart(row('SPEAKING'), { dataTransfer: dt() })
    const target = row('Notes')
    rowAt(target)
    fireEvent.dragOver(target, { clientY: 115, dataTransfer: dt() })
    expect(target).toHaveAttribute('data-drop', 'inside')
    act(() => void window.dispatchEvent(new Event(PAGE_DRAG_END)))
    expect(target).not.toHaveAttribute('data-drop')
  })

  it('ignores drags that are not pages (files, text)', () => {
    renderTree()
    const target = row('Notes')
    rowAt(target)
    expect(fireEvent.dragOver(target, { clientY: 115, dataTransfer: dt() })).toBe(true)
    expect(target).not.toHaveAttribute('data-drop')
  })
})

describe('sidebar: dock left or right', () => {
  beforeEach(() => useAppStore.setState({ sidebarSide: 'left', isSidebarOpen: true, sidebarWidth: 260 } as never))

  it('the Move button switches sides', () => {
    render(<Sidebar />)
    fireEvent.click(screen.getByRole('button', { name: 'Move sidebar to the right' }))
    expect(useAppStore.getState().sidebarSide).toBe('right')
    fireEvent.click(screen.getByRole('button', { name: 'Move sidebar to the left' }))
    expect(useAppStore.getState().sidebarSide).toBe('left')
  })

  it('dragging the title to the other half docks it there, with a preview while dragging', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    render(<Sidebar />)
    const title = screen.getByTitle('Drag to move the sidebar to the other side')
    fireEvent.pointerDown(title, { button: 0, clientX: 40, clientY: 20 })
    act(() => void window.dispatchEvent(new MouseEvent('pointermove', { clientX: 900, clientY: 20 })))
    expect(document.querySelector('[data-dock-preview="right"]')).not.toBeNull()
    act(() => void window.dispatchEvent(new MouseEvent('pointerup', { clientX: 900, clientY: 20 })))
    expect(document.querySelector('[data-dock-preview]')).toBeNull()
    expect(useAppStore.getState().sidebarSide).toBe('right')
  })

  it('a click on the title (no movement) does not move the sidebar', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    render(<Sidebar />)
    const title = screen.getByTitle('Drag to move the sidebar to the other side')
    fireEvent.pointerDown(title, { button: 0, clientX: 40, clientY: 20 })
    act(() => void window.dispatchEvent(new MouseEvent('pointermove', { clientX: 44, clientY: 20 })))
    act(() => void window.dispatchEvent(new MouseEvent('pointerup', { clientX: 900, clientY: 20 })))
    expect(useAppStore.getState().sidebarSide).toBe('left')
  })

  it('on the right, resizing from its left edge widens it when dragged left', () => {
    useAppStore.setState({ sidebarSide: 'right' } as never)
    const { container } = render(<Sidebar />)
    const handle = container.querySelector('.cursor-col-resize') as HTMLElement
    expect(handle.className).toContain('left-0')
    fireEvent.mouseDown(handle, { clientX: 900 })
    act(() => void window.dispatchEvent(new MouseEvent('mousemove', { clientX: 820 })))
    act(() => void window.dispatchEvent(new MouseEvent('mouseup')))
    expect(useAppStore.getState().sidebarWidth).toBe(340)
  })
})
