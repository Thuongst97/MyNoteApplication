// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { contextMenuTemplate, type ContextMenuActions } from '../../electron/contextMenu'

const flags = { canUndo: true, canRedo: true, canCut: true, canCopy: true, canPaste: true, canDelete: true, canSelectAll: true, canEditRichly: true }
const base = { isEditable: false, selectionText: '', editFlags: flags, linkURL: '', mediaType: 'none', hasImageContents: false, misspelledWord: '', dictionarySuggestions: [] as string[] } as const
const actions = (): ContextMenuActions => ({ replaceMisspelling: vi.fn(), addToDictionary: vi.fn(), pasteAsPlainText: vi.fn(), copyImage: vi.fn(), copyText: vi.fn(), openExternal: vi.fn() })
const names = (t: ReturnType<typeof contextMenuTemplate>) => t.map((i) => i.role ?? i.label ?? i.type)

describe('right-click menu', () => {
  it('shows nothing on plain, unselected content', () => {
    expect(contextMenuTemplate({ ...base }, actions())).toEqual([])
  })

  it('offers Copy on selected read-only text (e.g. a rendered Markdown block)', () => {
    const t = contextMenuTemplate({ ...base, selectionText: 'or keep it: D-pad, keyboard' }, actions())
    expect(names(t)).toEqual(['copy', 'selectAll'])
    expect(t[0].enabled).toBe(true)
  })

  it('offers Cut/Copy/Paste in page text, disabling Cut/Copy without a selection', () => {
    const t = contextMenuTemplate({ ...base, isEditable: true }, actions())
    expect(names(t)).toEqual(['cut', 'copy', 'paste', 'Paste as plain text', 'separator', 'selectAll'])
    expect(t.find((i) => i.role === 'copy')!.enabled).toBe(false)
    const sel = contextMenuTemplate({ ...base, isEditable: true, selectionText: 'hi' }, actions())
    expect(sel.find((i) => i.role === 'copy')!.enabled).toBe(true)
    expect(sel.find((i) => i.role === 'cut')!.enabled).toBe(true)
  })

  it('suggests spelling fixes for a misspelled word', () => {
    const a = actions()
    const t = contextMenuTemplate({ ...base, isEditable: true, misspelledWord: 'teh', dictionarySuggestions: ['the', 'ten'] }, a)
    expect(names(t).slice(0, 4)).toEqual(['the', 'ten', 'Add to dictionary', 'separator'])
    ;(t[0].click as () => void)()
    expect(a.replaceMisspelling).toHaveBeenCalledWith('the')
    ;(t[2].click as () => void)()
    expect(a.addToDictionary).toHaveBeenCalledWith('teh')
  })

  it('offers to turn spell check off from a misspelled word (when the app supports it)', () => {
    const a = { ...actions(), disableSpellcheck: vi.fn() }
    const t = contextMenuTemplate({ ...base, isEditable: true, misspelledWord: 'teh', dictionarySuggestions: ['the'] }, a)
    expect(names(t).slice(0, 4)).toEqual(['the', 'Add to dictionary', 'Turn off spell check', 'separator'])
    ;(t[2].click as () => void)()
    expect(a.disableSpellcheck).toHaveBeenCalled()
  })

  it('adds link actions for web links only', () => {
    const a = actions()
    const t = contextMenuTemplate({ ...base, linkURL: 'https://example.com/x', selectionText: 'example' }, a)
    expect(names(t)).toEqual(['Open link in browser', 'Copy link address', 'separator', 'copy', 'selectAll'])
    ;(t[0].click as () => void)()
    ;(t[1].click as () => void)()
    expect(a.openExternal).toHaveBeenCalledWith('https://example.com/x')
    expect(a.copyText).toHaveBeenCalledWith('https://example.com/x')
    // In-app page links have their own handling.
    expect(contextMenuTemplate({ ...base, linkURL: 'notionclone://page/abc' }, a)).toEqual([])
  })

  it('offers Copy image on images', () => {
    const a = actions()
    const t = contextMenuTemplate({ ...base, mediaType: 'image', hasImageContents: true }, a)
    expect(names(t)).toEqual(['Copy image'])
    ;(t[0].click as () => void)()
    expect(a.copyImage).toHaveBeenCalled()
  })
})
