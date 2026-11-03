import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useAppStore } from '@/stores/useAppStore'
import { autoSaver } from '@/lib/autoSave'
import { api } from '@/lib/api'
import { PresentationPage } from '@/components/Slides/PresentationPage'
import type { PresentationContent } from '@/lib/presentation'

const initial = useAppStore.getState()
beforeEach(() => {
  localStorage.clear()
  useAppStore.setState({ ...initial, pages: [], activePageId: null, expanded: {}, view: 'page', isLoaded: true }, true)
})

async function setup(title = 'Deck') {
  let id = ''
  await act(async () => void (id = await useAppStore.getState().createPage(null, { kind: 'slides', title })))
  render(<PresentationPage pageId={id} />)
  await screen.findByRole('listbox', { name: 'Slides' })
  return id
}
const thumbs = () => within(screen.getByRole('listbox', { name: 'Slides' })).getAllByRole('option')
async function saved(id: string) {
  await act(async () => void (await autoSaver.flush(id)))
  return (await api.readPage(id))!.content as PresentationContent
}

describe('PresentationPage', () => {
  it('shows the slides with the first one selected and editable', async () => {
    await setup('Roadmap')
    expect(thumbs()).toHaveLength(2)
    expect(thumbs()[0]).toHaveAttribute('aria-selected', 'true')
    expect(thumbs()[0]).toHaveAccessibleName('Slide 1: Roadmap')
    // One editable editor (the current slide); thumbnails are read-only.
    const editable = document.querySelectorAll('.ProseMirror[contenteditable="true"]')
    expect(editable).toHaveLength(1)
    expect(editable[0].textContent).toContain('Roadmap')
  })

  it('adds, duplicates, deletes and saves slides', async () => {
    const id = await setup()
    fireEvent.click(screen.getAllByRole('button', { name: /^New slide$/ })[0])
    expect(thumbs()).toHaveLength(3)
    expect(thumbs()[1]).toHaveAttribute('aria-selected', 'true') // inserted after the current one
    fireEvent.click(within(thumbs()[1]).getByRole('button', { name: 'Duplicate slide' }))
    expect(thumbs()).toHaveLength(4)
    expect(thumbs()[2]).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(within(thumbs()[0]).getByRole('button', { name: 'Delete slide' }))
    expect(thumbs()).toHaveLength(3)
    expect((await saved(id)).slides).toHaveLength(3)
  })

  it('new slide with a chosen layout, and changing the layout', async () => {
    const id = await setup()
    fireEvent.click(screen.getByRole('button', { name: 'New slide with layout' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Blank/ }))
    expect(thumbs()).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: /Layout/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Title slide/ }))
    const c = await saved(id)
    expect(c.slides[1].layout).toBe('title')
    expect(c.slides[1].content.content!.map((b) => b.type)).toEqual(['paragraph'])
  })

  it('sets a slide background, and can apply it to all slides', async () => {
    const id = await setup()
    fireEvent.click(screen.getByRole('button', { name: /Background/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Navy' }))
    expect(document.querySelectorAll('.slide-dark').length).toBeGreaterThanOrEqual(2) // editor + its thumbnail
    expect((await saved(id)).slides.map((s) => s.background)).toEqual(['navy', 'default'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply to all slides' }))
    expect((await saved(id)).slides.map((s) => s.background)).toEqual(['navy', 'navy'])
  })

  it('keyboard in the slide list: arrows select, Ctrl+D duplicates, Delete removes', async () => {
    await setup()
    const list = screen.getByRole('listbox', { name: 'Slides' })
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    expect(thumbs()[1]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(list, { key: 'd', ctrlKey: true })
    expect(thumbs()).toHaveLength(3)
    fireEvent.keyDown(list, { key: 'Delete' })
    expect(thumbs()).toHaveLength(2)
    fireEvent.keyDown(list, { key: 'Home' })
    expect(thumbs()[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps at least one slide', async () => {
    await setup()
    fireEvent.click(within(thumbs()[1]).getByRole('button', { name: 'Delete slide' }))
    expect(thumbs()).toHaveLength(1)
    expect(within(thumbs()[0]).queryByRole('button', { name: 'Delete slide' })).toBeNull()
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Slides' }), { key: 'Delete' })
    expect(thumbs()).toHaveLength(1)
  })

  it('reorders slides by dragging', async () => {
    const id = await setup('First')
    const before = (await saved(id)).slides.map((s) => s.id)
    const [a, b] = thumbs()
    b.getBoundingClientRect = () => ({ top: 100, height: 100, bottom: 200, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) })
    const dt = { setData: () => {}, effectAllowed: '' }
    fireEvent.dragStart(a, { dataTransfer: dt })
    fireEvent.dragOver(b, { clientY: 180, dataTransfer: dt })
    fireEvent.drop(b, { clientY: 180, dataTransfer: dt })
    expect((await saved(id)).slides.map((s) => s.id)).toEqual([before[1], before[0]])
  })

  it('edits on the slide are saved into that slide', async () => {
    const id = await setup()
    const el = document.querySelector('.ProseMirror[contenteditable="true"]') as HTMLElement & { editor: import('@tiptap/react').Editor }
    act(() => void el.editor.commands.insertContentAt(el.editor.state.doc.content.size, { type: 'paragraph', content: [{ type: 'text', text: 'Speaker hello' }] }))
    const c = await saved(id)
    expect(JSON.stringify(c.slides[0].content)).toContain('Speaker hello')
    expect(JSON.stringify(c.slides[1].content)).not.toContain('Speaker hello')
  })

  it('presents from the start or the current slide, navigates with keys and closes with Esc', async () => {
    await setup()
    fireEvent.click(thumbs()[1])
    fireEvent.mouseDown(thumbs()[1])
    fireEvent.click(screen.getByRole('button', { name: /^Present$/ }))
    const show = await screen.findByTestId('present-mode')
    expect(screen.getByTestId('present-counter')).toHaveTextContent('1 / 2')
    expect(document.body.classList.contains('drawing-open')).toBe(true)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByTestId('present-counter')).toHaveTextContent('2 / 2')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByTestId('present-counter')).toHaveTextContent('2 / 2')
    fireEvent.keyDown(window, { key: 'b' })
    expect(screen.getByTestId('present-black')).toBeInTheDocument()
    fireEvent.click(show) // click = next (and un-blacks)
    expect(screen.queryByTestId('present-black')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('present-mode')).toBeNull()
    expect(document.body.classList.contains('drawing-open')).toBe(false)

    // Shift+F5: from the current slide (2); F5: from the beginning.
    fireEvent.keyDown(window, { key: 'F5', shiftKey: true })
    expect(screen.getByTestId('present-counter')).toHaveTextContent('2 / 2')
    fireEvent.click(screen.getByRole('button', { name: 'End presentation' }))
    fireEvent.keyDown(window, { key: 'F5' })
    expect(screen.getByTestId('present-counter')).toHaveTextContent('1 / 2')
    fireEvent.keyDown(window, { key: 'Escape' })
  })
})
