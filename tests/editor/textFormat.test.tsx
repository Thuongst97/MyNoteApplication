import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { adjust, recentColors, rememberColor, STANDARD_COLORS, themeGrid, variations } from '@/lib/colors'
import { ColorPalette } from '@/components/Editor/ColorPalette'
import { currentTextAlign } from '@/components/Editor/textAlign'
import { doc, makeEditor, p } from './helpers'

describe('Office color palette', () => {
  it('has 10 theme colors with 5 variations each, and 10 standard colors', () => {
    const grid = themeGrid()
    expect(grid).toHaveLength(6)
    grid.forEach((row) => expect(row).toHaveLength(10))
    expect(STANDARD_COLORS).toHaveLength(10)
  })
  it('makes Office-like tints and shades', () => {
    expect(adjust('#000000', 0.5)).toBe('#808080')
    expect(adjust('#FFFFFF', -0.5)).toBe('#808080')
    expect(variations('#4472C4')[0]).toBe('#DAE3F3') // 80 % lighter, as in Office
    expect(variations('#4472C4')[4]).toBe('#203864') // 50 % darker
    expect(variations('#FFFFFF')).toEqual(['#F2F2F2', '#D9D9D9', '#BFBFBF', '#A6A6A6', '#808080'])
    expect(variations('#000000')[0]).toBe('#808080')
  })
  it('remembers recent colors, most recent first, without duplicates', () => {
    rememberColor('#ff0000')
    rememberColor('#00FF00')
    rememberColor('#FF0000')
    expect(recentColors().slice(0, 2)).toEqual(['#FF0000', '#00FF00'])
  })
  it('picks a swatch, the automatic color, and shows the current one', () => {
    const onPick = vi.fn()
    render(<ColorPalette value="#C00000" onPick={onPick} noneLabel="Automatic" moreLabel="More Colors…" />)
    expect(screen.getByText('Theme Colors')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Standard color #C00000' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Theme color #4472C4' }))
    expect(onPick).toHaveBeenLastCalledWith('#4472C4')
    fireEvent.click(screen.getByRole('button', { name: 'Automatic' }))
    expect(onPick).toHaveBeenLastCalledWith(null)
    expect(screen.getByText('More Colors…')).toBeTruthy()
  })
})

describe('text alignment', () => {
  it('aligns the paragraphs and headings in the selection, and left clears it', () => {
    const editor = makeEditor(doc(p('One'), { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Two' }] }, p('Three')))
    editor.chain().setTextSelection({ from: 2, to: 8 }).setTextAlign('center').run()
    const json = editor.getJSON().content!
    expect(json[0].attrs?.textAlign).toBe('center')
    expect(json[1].attrs?.textAlign).toBe('center')
    expect(json[2].attrs?.textAlign ?? null).toBeNull()
    expect(editor.getHTML()).toContain('<p style="text-align: center;">One</p>')
    expect(currentTextAlign(editor)).toBe('center')
    editor.chain().setTextAlign('left').run()
    expect(editor.getJSON().content![0].attrs?.textAlign ?? null).toBeNull()
    expect(currentTextAlign(editor)).toBe('left')
  })
  it('justifies and right-aligns, and reads alignment back from HTML', () => {
    const editor = makeEditor('<p style="text-align: justify">A</p><p style="text-align: right">B</p>')
    expect(editor.getJSON().content!.map((n) => n.attrs?.textAlign)).toEqual(['justify', 'right'])
    expect(editor.commands.setTextAlign('nonsense' as never)).toBe(false)
  })
})
