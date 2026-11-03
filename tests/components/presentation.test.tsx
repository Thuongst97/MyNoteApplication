import { beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  // An existing presentation (a brand-new one opens the theme gallery first — tested separately).
  act(() => useAppStore.getState().clearFocusTitle())
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

  it('draws on the slide with the pen and erases with the eraser', async () => {
    const id = await setup()
    fireEvent.click(screen.getByRole('button', { name: /^Draw$/ }))
    expect(screen.getByRole('toolbar', { name: 'Drawing tools' })).toBeInTheDocument()
    const layer = document.querySelectorAll('[data-testid="ink-layer"]')[0] as SVGSVGElement
    layer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720, x: 0, y: 0, toJSON: () => ({}) })
    const stroke = (pts: Array<[number, number]>) => {
      fireEvent.pointerDown(layer, { button: 0, clientX: pts[0][0], clientY: pts[0][1], pointerId: 1 })
      for (const [x, y] of pts.slice(1)) fireEvent.pointerMove(window, { clientX: x, clientY: y })
      fireEvent.pointerUp(window)
    }
    layer.setPointerCapture = () => {}
    stroke([[100, 100], [150, 120], [200, 140]])
    let c = await saved(id)
    expect(c.slides[0].ink).toHaveLength(1)
    expect(c.slides[0].ink![0]).toMatchObject({ tool: 'pen', points: [100, 100, 150, 120, 200, 140] })
    fireEvent.click(screen.getByRole('button', { name: 'Highlighter' }))
    stroke([[100, 400], [300, 400]])
    c = await saved(id)
    expect(c.slides[0].ink![1]).toMatchObject({ tool: 'highlighter', color: '#fde047' })
    fireEvent.click(screen.getByRole('button', { name: 'Eraser' }))
    stroke([[150, 122]])
    c = await saved(id)
    expect(c.slides[0].ink!.map((s) => s.tool)).toEqual(['highlighter'])
    fireEvent.click(screen.getByRole('button', { name: /Clear slide ink/ }))
    expect((await saved(id)).slides[0].ink).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('toolbar', { name: 'Drawing tools' })).toBeNull()
  })

  it('animations panel: transition, and click animations for the block at the cursor', async () => {
    const id = await setup()
    fireEvent.mouseDown(thumbs()[1]) // title & bullets slide
    fireEvent.click(screen.getByRole('button', { name: /^Animations$/ }))
    const panel = screen.getByRole('region', { name: 'Animations' })
    fireEvent.click(within(panel).getByRole('radio', { name: 'Fade' }))
    expect((await saved(id)).slides[1].transition).toBe('fade')
    const el = document.querySelector('.ProseMirror[contenteditable="true"]') as HTMLElement & { editor: import('@tiptap/react').Editor }
    await waitFor(() => expect(within(panel).getByRole('button', { name: /Animate block at cursor/ })).toBeEnabled())
    // Cursor in the list (2nd block).
    act(() => void el.editor.commands.setTextSelection(el.editor.state.doc.firstChild!.nodeSize + 3))
    fireEvent.click(within(panel).getByRole('button', { name: /Animate block at cursor/ }))
    act(() => void el.editor.commands.setTextSelection(1))
    fireEvent.click(within(panel).getByRole('button', { name: /Animate block at cursor/ }))
    const items = within(panel).getAllByTestId('animation-item')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('List')
    expect(within(items[0]).getByRole('checkbox', { name: /By item/ })).toBeChecked()
    fireEvent.change(within(items[1]).getByLabelText('Effect'), { target: { value: 'zoom' } })
    fireEvent.click(within(items[1]).getByRole('button', { name: 'Move up' }))
    const c = await saved(id)
    const anims = c.slides[1].animations!
    expect(anims.map((a) => a.effect)).toEqual(['zoom', 'fade'])
    const blocks = c.slides[1].content.content!
    expect(anims[0].blockId).toBe(blocks[0].attrs!.blockId) // the heading, now first
    expect(anims[1]).toMatchObject({ blockId: blocks[1].attrs!.blockId, byItem: true })
    fireEvent.click(within(within(panel).getAllByTestId('animation-item')[0]).getByRole('button', { name: 'Remove animation' }))
    expect((await saved(id)).slides[1].animations).toHaveLength(1)
  })

  it('present mode steps through click animations before the next slide', async () => {
    const id = await setup()
    const c = await saved(id)
    const s1 = c.slides[1]
    s1.content.content![0].attrs = { ...s1.content.content![0].attrs, blockId: 'title1' }
    await api.savePage({ id, content: { type: 'slides', slides: [c.slides[0], { ...s1, animations: [{ blockId: 'title1', effect: 'fade' }] }] } as never })
    cleanupAndRender(id)
    await screen.findByRole('listbox', { name: 'Slides' })
    fireEvent.keyDown(window, { key: 'F5' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByTestId('present-counter')).toHaveTextContent('2 / 2')
    expect(document.querySelector('[data-testid="present-slide"] style')!.textContent).toContain('visibility: hidden')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(document.querySelector('[data-testid="present-slide"] style')!.textContent).toContain('pn-build-fade')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(document.querySelector('[data-testid="present-slide"] style')!.textContent).toContain('visibility: hidden')
    fireEvent.keyDown(window, { key: 'Escape' })
  })

  it('pen in present mode: Esc puts it away, ending asks to keep the ink', async () => {
    const id = await setup()
    fireEvent.keyDown(window, { key: 'F5' })
    fireEvent.keyDown(window, { key: 'p', ctrlKey: true })
    expect(screen.getByRole('button', { name: /^Pen/ })).toHaveAttribute('aria-pressed', 'true')
    const layers = document.querySelectorAll('[data-testid="present-slide"] [data-testid="ink-layer"]')
    const layer = layers[layers.length - 1] as SVGSVGElement
    layer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720, x: 0, y: 0, toJSON: () => ({}) })
    layer.setPointerCapture = () => {}
    fireEvent.pointerDown(layer, { button: 0, clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 60, clientY: 60 })
    fireEvent.pointerUp(window)
    // Drawing doesn't change slides.
    expect(screen.getByTestId('present-counter')).toHaveTextContent('1 / 2')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('button', { name: /^Arrow/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('present-mode')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(await screen.findByRole('button', { name: 'Keep' }))
    expect(screen.queryByTestId('present-mode')).toBeNull()
    const c = await saved(id)
    expect(c.slides[0].ink).toHaveLength(1)
    expect(c.slides[0].ink![0].points).toEqual([10, 10, 60, 60])
  })

  it('laser pointer and erase-all keys', async () => {
    await setup()
    fireEvent.keyDown(window, { key: 'F5' })
    fireEvent.keyDown(window, { key: 'l', ctrlKey: true })
    fireEvent.pointerMove(window, { clientX: 300, clientY: 200 })
    await waitFor(() => expect(screen.getByTestId('laser')).toBeInTheDocument())
    fireEvent.keyDown(window, { key: 'l', ctrlKey: true })
    expect(screen.queryByTestId('laser')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('present-mode')).toBeNull() // no ink: no question
  })

  it('diagrams and charts on a slide are edited in a full-size dialog; thumbnails never open editors', async () => {
    await setup()
    const el = document.querySelector('.ProseMirror[contenteditable="true"]') as HTMLElement & { editor: import('@tiptap/react').Editor }
    act(() => void el.editor.chain().focus('end').insertMermaid('').run())
    const dialog = await screen.findByRole('dialog', { name: 'Edit Mermaid diagram' })
    expect(dialog.closest('[data-testid="block-edit-dialog"]')!.parentElement).toBe(document.body)
    expect(screen.getByText(/Editing Mermaid diagram/)).toBeInTheDocument()
    // Only one editor is open: the thumbnail of the same slide shows the block, not an editor.
    await waitFor(() => expect(document.querySelectorAll('[role="dialog"][aria-label="Edit Mermaid diagram"]')).toHaveLength(1))
    fireEvent.click(within(dialog).getByRole('button', { name: /Cancel/ }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit Mermaid diagram' })).toBeNull())
  })


  it('boxes: insert a text box, select it, nudge with arrows, delete with Delete', async () => {
    const id = await setup()
    fireEvent.click(screen.getByRole('button', { name: /^Insert/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Text box' }))
    let c = await saved(id)
    expect(c.slides[0].boxes).toHaveLength(1)
    const box = c.slides[0].boxes![0]
    expect(document.querySelector(`[data-object-id="${box.id}"]`)).not.toBeNull()
    // Selected: arrange buttons are shown; arrows move it (Shift: 10 px).
    expect(screen.getByRole('button', { name: 'Bring forward' })).toBeInTheDocument()
    ;(document.activeElement as HTMLElement | null)?.blur()
    fireEvent.keyDown(document.body, { key: 'ArrowRight', shiftKey: true })
    fireEvent.keyDown(document.body, { key: 'ArrowDown' })
    c = await saved(id)
    expect([c.slides[0].boxes![0].x, c.slides[0].boxes![0].y]).toEqual([box.x + 10, box.y + 1])
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate box' }))
    expect((await saved(id)).slides[0].boxes).toHaveLength(2)
    fireEvent.keyDown(document.body, { key: 'Delete' })
    c = await saved(id)
    expect(c.slides[0].boxes).toHaveLength(1)
    // Click a box to select it again.
    fireEvent.mouseDown(document.querySelector(`[data-object-id="${c.slides[0].boxes![0].id}"]`)!)
    fireEvent.click(screen.getByRole('button', { name: 'Delete box' }))
    expect((await saved(id)).slides[0].boxes).toBeUndefined()
  })

  it('detach: the block with the cursor moves into its own box', async () => {
    const id = await setup()
    fireEvent.mouseDown(thumbs()[1])
    const el = document.querySelector('[data-testid="slide-edit-surface"] .slide-main .ProseMirror') as HTMLElement & { editor: import('@tiptap/react').Editor }
    await waitFor(() => expect(screen.getByRole('button', { name: /Detach block/ })).toBeEnabled())
    act(() => void el.editor.commands.setTextSelection(el.editor.state.doc.firstChild!.nodeSize + 3)) // in the list
    fireEvent.click(screen.getByRole('button', { name: /Detach block/ }))
    const c = await saved(id)
    expect(c.slides[1].content.content!.map((b) => b.type)).not.toContain('bulletList')
    expect(c.slides[1].boxes).toHaveLength(1)
    expect(c.slides[1].boxes![0].content.content![0].type).toBe('bulletList')
  })

})

function cleanupAndRender(id: string) {
  cleanup()
  render(<PresentationPage pageId={id} />)
}
