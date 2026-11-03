import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useAppStore } from '@/stores/useAppStore'
import { autoSaver } from '@/lib/autoSave'
import { api } from '@/lib/api'
import { PresentationPage } from '@/components/Slides/PresentationPage'
import { masterShown, normalizeFooter, normalizeMaster, normalizePresentation, type PresentationContent } from '@/lib/presentation'

const initial = useAppStore.getState()
beforeEach(() => {
  localStorage.clear()
  useAppStore.setState({ ...initial, pages: [], activePageId: null, expanded: {}, view: 'page', isLoaded: true }, true)
})
const saved = async (id: string) => {
  await act(async () => void (await autoSaver.flush(id)))
  return (await api.readPage(id))!.content as PresentationContent
}
const thumbs = () => within(screen.getByRole('listbox', { name: 'Slides' })).getAllByRole('option')
async function setup() {
  let id = ''
  await act(async () => void (id = await useAppStore.getState().createPage(null, { kind: 'slides', title: 'Deck' })))
  act(() => useAppStore.getState().clearFocusTitle())
  render(<PresentationPage pageId={id} />)
  await screen.findByRole('listbox', { name: 'Slides' })
  return id
}

describe('slide master model', () => {
  it('normalizes the master; shows its objects on content slides (title slides opt-in, per-slide opt-out)', () => {
    const box = { id: 'logo', x: 1100, y: 40, w: 120, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ACME' }] }] } }
    expect(normalizeMaster(null)).toBeNull()
    expect(normalizeMaster({ boxes: [], background: 'nope' })).toBeNull()
    const m = normalizeMaster({ boxes: [box], background: 'navy', onTitle: 'yes' })!
    expect(m).toEqual({ boxes: [box], background: 'navy' })
    expect(masterShown(m, { layout: 'content' })).toBe(true)
    expect(masterShown(m, { layout: 'title' })).toBe(false)
    expect(masterShown({ ...m, onTitle: true }, { layout: 'title' })).toBe(true)
    expect(masterShown(m, { layout: 'content', hideMaster: true })).toBe(false)
    const p = normalizePresentation({ type: 'slides', master: { boxes: [box] }, slides: [{ id: 's', layout: 'content', content: { type: 'doc' }, hideMaster: true }] })
    expect(p.master?.boxes).toHaveLength(1)
    expect(p.slides[0].hideMaster).toBe(true)
    expect(normalizeFooter({ slideNumbers: true, caps: false })).toEqual({ slideNumbers: true, caps: false })
  })
})

describe('footer editing and slide master in the editor', () => {
  it('the footer text is edited by clicking it on the slide (all slides)', async () => {
    const id = await setup()
    fireEvent.mouseDown(thumbs()[1])
    fireEvent.click(screen.getByRole('button', { name: /^Footer$/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Slide numbers/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /ALL CAPS/ }))
    const surface = () => document.querySelector('[data-testid="slide-edit-surface"]')!.closest('.slide-surface') as HTMLElement
    await waitFor(() => expect(within(surface()).getByTestId('slide-footer')).toHaveClass('slide-footer-plain'))
    fireEvent.click(within(surface()).getByTitle(/Click to edit the footer/))
    const input = within(surface()).getByLabelText('Footer text')
    fireEvent.change(input, { target: { value: 'ACME Motors — Confidential' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    const c = await saved(id)
    expect(c.footer).toMatchObject({ slideNumbers: true, text: 'ACME Motors — Confidential', caps: false })
    // Thumbnails show it too, but can't be edited there.
    expect(within(thumbs()[1]).getByTestId('slide-footer')).toHaveTextContent('ACME Motors — Confidential')
    expect(within(thumbs()[1]).queryByTitle(/Click to edit the footer/)).toBeNull()
  })

  it('master view: objects added there appear on every content slide; a slide can hide them', async () => {
    const id = await setup()
    fireEvent.click(screen.getByRole('button', { name: /^Master$/ }))
    expect(screen.getByRole('toolbar', { name: 'Slide master' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Insert/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Text box' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Master background Sand' }))
    let c = await saved(id)
    expect(c.master?.boxes).toHaveLength(1)
    expect(c.master?.background).toBe('sand')
    // The slides themselves didn't get the box.
    expect(c.slides.every((s) => !s.boxes)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Close master/ }))
    expect(screen.queryByRole('toolbar', { name: 'Slide master' })).toBeNull()
    // Content slide 2 shows the master objects; title slide 1 doesn't.
    expect(within(thumbs()[1]).getByTestId('master-layer')).toBeInTheDocument()
    expect(within(thumbs()[0]).queryByTestId('master-layer')).toBeNull()
    // Hide them on slide 2.
    fireEvent.mouseDown(thumbs()[1])
    fireEvent.click(screen.getByRole('button', { name: /Layout/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Hide master objects here/ }))
    c = await saved(id)
    expect(c.slides[1].hideMaster).toBe(true)
    expect(within(thumbs()[1]).queryByTestId('master-layer')).toBeNull()
  })
})
