import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useAppStore } from '@/stores/useAppStore'
import { autoSaver } from '@/lib/autoSave'
import { api } from '@/lib/api'
import { PresentationPage } from '@/components/Slides/PresentationPage'
import { SLIDE_THEMES, slideTheme, themeVars } from '@/lib/slideThemes'
import { starterDeck, themedPresentation } from '@/lib/themeDecks'
import { alignRect, footerShown, normalizeFooter, normalizePresentation, type PresentationContent } from '@/lib/presentation'

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

describe('themes and starter decks', () => {
  it('12 themes (6 light), including the AI themes, each with readable tokens', () => {
    expect(SLIDE_THEMES.map((t) => t.id)).toEqual(['obsidian', 'champagne', 'platinum', 'electric', 'carbon', 'aurora', 'neural', 'ivory', 'glacier', 'studio', 'sage', 'lumen'])
    expect(SLIDE_THEMES.filter((t) => !t.dark).map((t) => t.id)).toEqual(['platinum', 'ivory', 'glacier', 'studio', 'sage', 'lumen'])
    expect(new Set(SLIDE_THEMES.map((t) => t.deck.title)).size).toBe(SLIDE_THEMES.length)
    expect(slideTheme('neural')!.tag).toBe('AI')
    expect(slideTheme('nope')).toBeNull()
    for (const t of SLIDE_THEMES) {
      expect(t.art()).not.toMatch(/<script|on\w+=|javascript:/i)
      expect(themeVars(t)['--st-accent']).toBe(t.accent)
    }
  })

  it('starter decks: title, agenda, key numbers, chart, closing — valid after normalizing', () => {
    for (const t of SLIDE_THEMES) {
      const deck = themedPresentation(t)
      expect(deck.slides).toHaveLength(5)
      const n = normalizePresentation(deck)
      expect(n.theme).toBe(t.id)
      expect(n.footer).toMatchObject({ slideNumbers: true })
      expect(n.slides.map((s) => s.layout)).toEqual(['title', 'content', 'content', 'content', 'title'])
      expect(JSON.stringify(n.slides[2].content)).toContain('"columns"')
      expect(JSON.stringify(n.slides[3].boxes)).toContain('"chart"')
      expect(JSON.stringify(n.slides[0].content)).toContain(t.deck.title)
    }
    expect(JSON.stringify(starterDeck(slideTheme('neural')!))).toContain('On-device assistant')
  })

  it('footer, hidden slides and notes survive saving; bad values are dropped', () => {
    const p = normalizePresentation({
      type: 'slides',
      theme: 'carbon',
      footer: { slideNumbers: true, text: 'ACME', date: 'Nov 2026', hideOnTitle: false },
      slides: [{ id: 'a', layout: 'content', content: { type: 'doc', content: [] }, hidden: true, notes: 'Say hi' }],
    })
    expect(p.theme).toBe('carbon')
    expect(p.footer).toEqual({ slideNumbers: true, text: 'ACME', date: 'Nov 2026', hideOnTitle: false })
    expect(p.slides[0]).toMatchObject({ hidden: true, notes: 'Say hi' })
    expect(normalizePresentation({ type: 'slides', theme: 'evil', footer: 'x', slides: [] }).theme).toBeUndefined()
    expect(normalizeFooter({ slideNumbers: false })).toBeNull()
    expect(footerShown({ slideNumbers: true }, { layout: 'title' })).toBe(false)
    expect(footerShown({ slideNumbers: true, hideOnTitle: false }, { layout: 'title' })).toBe(true)
    expect(footerShown({ slideNumbers: true }, { layout: 'content' })).toBe(true)
  })

  it('align to the slide: margins for edges, the middle for centers', () => {
    const r = { x: 300, y: 300, w: 400, h: 100 }
    expect(alignRect(r, 'left')).toEqual({ x: 88, y: 300 })
    expect(alignRect(r, 'center')).toEqual({ x: 440, y: 300 })
    expect(alignRect(r, 'right')).toEqual({ x: 792, y: 300 })
    expect(alignRect(r, 'top')).toEqual({ x: 300, y: 64 })
    expect(alignRect(r, 'middle')).toEqual({ x: 300, y: 310 })
    expect(alignRect(r, 'bottom')).toEqual({ x: 300, y: 556 })
  })
})

describe('PresentationPage: gallery, theme, footer, hide, notes', () => {
  it('a new presentation opens the gallery; picking a theme makes the starter deck', async () => {
    let id = ''
    await act(async () => void (id = await useAppStore.getState().createPage(null, { kind: 'slides', title: 'Deck' })))
    render(<PresentationPage pageId={id} />)
    const dialog = await screen.findByRole('dialog', { name: 'Presentation theme' })
    expect(within(dialog).getAllByRole('button', { name: /^(?!No ).* theme$/ })).toHaveLength(12)
    // Filter: light / dark themes.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Light' }))
    expect(within(dialog).getAllByRole('button', { name: /^(?!No ).* theme$/ }).map((b) => b.getAttribute('aria-label'))).toEqual(['Platinum theme', 'Ivory Editorial theme', 'Glacier theme', 'Studio White theme', 'Sage & Stone theme', 'Lumen theme'])
    fireEvent.click(within(dialog).getByRole('button', { name: 'Dark' }))
    expect(within(dialog).getAllByRole('button', { name: /^(?!No ).* theme$/ })).toHaveLength(6)
    fireEvent.click(within(dialog).getByRole('button', { name: 'All' }))
    expect(within(dialog).getByRole('checkbox', { name: /Start with sample slides/ })).toBeChecked()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Neural theme' }))
    expect(screen.queryByRole('dialog', { name: 'Presentation theme' })).toBeNull()
    const c = await saved(id)
    expect(c.theme).toBe('neural')
    expect(c.slides).toHaveLength(5)
    expect(thumbs()).toHaveLength(5)
    // The slides are themed and numbered (not on the title slide).
    expect(document.querySelector('[data-testid="slide-edit-surface"]')!.closest('.slide-themed')).toHaveClass('theme-neural')
    fireEvent.mouseDown(thumbs()[1])
    await waitFor(() => expect(document.querySelector('.slide-themed [data-testid="slide-footer"]')?.textContent).toContain('02 / 05'))
  })

  it('Theme button switches the look of an existing deck without touching its slides', async () => {
    let id = ''
    await act(async () => void (id = await useAppStore.getState().createPage(null, { kind: 'slides', title: 'Mine' })))
    act(() => useAppStore.getState().clearFocusTitle())
    render(<PresentationPage pageId={id} />)
    await screen.findByRole('listbox', { name: 'Slides' })
    const before = (await saved(id)).slides
    fireEvent.click(screen.getByRole('button', { name: /^Theme$/ }))
    const dialog = screen.getByRole('dialog', { name: 'Presentation theme' })
    expect(within(dialog).getByRole('checkbox', { name: /Replace my slides/ })).not.toBeChecked()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Platinum theme' }))
    const c = await saved(id)
    expect(c.theme).toBe('platinum')
    expect(c.slides).toEqual(before)
    fireEvent.click(screen.getByRole('button', { name: /^Theme$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'No theme' }))
    expect((await saved(id)).theme).toBeUndefined()
  })

  it('footer menu, hide slide (skipped when presenting) and speaker notes', async () => {
    let id = ''
    await act(async () => void (id = await useAppStore.getState().createPage(null, { kind: 'slides', title: 'Deck' })))
    act(() => useAppStore.getState().clearFocusTitle())
    render(<PresentationPage pageId={id} />)
    await screen.findByRole('listbox', { name: 'Slides' })
    fireEvent.click(screen.getByRole('button', { name: /^Footer$/ }))
    const menu = screen.getByRole('dialog', { name: 'Slide numbers and footer' })
    fireEvent.click(within(menu).getByRole('checkbox', { name: /Slide numbers/ }))
    fireEvent.click(within(menu).getByRole('checkbox', { name: /Footer text/ }))
    fireEvent.change(within(menu).getByLabelText('Text in footer'), { target: { value: 'ACME Motors' } })
    let c = await saved(id)
    expect(c.footer).toMatchObject({ slideNumbers: true, text: 'ACME Motors' })
    fireEvent.mouseDown(thumbs()[1])
    await waitFor(() => expect(screen.getAllByTestId('slide-footer')[0].textContent).toMatch(/ACME Motors.*02 \/ 02/))
    // Hide slide 1; presenting starts at slide 2.
    fireEvent.click(within(thumbs()[0]).getByRole('button', { name: 'Hide slide' }))
    expect(thumbs()[0]).toHaveAccessibleName(/\(hidden\)/)
    c = await saved(id)
    expect(c.slides[0].hidden).toBe(true)
    fireEvent.keyDown(window, { key: 'F5' })
    expect(screen.getByTestId('present-counter')).toHaveTextContent('1 / 1')
    fireEvent.keyDown(window, { key: 'Escape' })
    // Notes
    fireEvent.click(screen.getByRole('button', { name: /Speaker notes/ }))
    fireEvent.change(screen.getByLabelText('Speaker notes'), { target: { value: 'Mention the 800 V pack' } })
    c = await saved(id)
    expect(c.slides[1].notes).toBe('Mention the 800 V pack')
  })
})
