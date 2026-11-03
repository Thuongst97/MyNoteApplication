import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { countInJson, findInText, type FindOptions } from '@/lib/find'
import { findMatchesInDoc } from '@/components/Editor/find/findPlugin'
import { editorFindProvider } from '@/components/Editor/find/editorFind'
import { presentationHits } from '@/components/Slides/slidesFind'
import { FindBar } from '@/components/Find/FindBar'
import { useFindStore } from '@/stores/useFindStore'
import { makeEditor } from '../editor/helpers'

const o = (query: string, caseSensitive = false, wholeWord = false): FindOptions => ({ query, caseSensitive, wholeWord })

describe('find matching', () => {
  it('case and whole-word options', () => {
    const t = 'The CAN bus carries the can signal; Scan it. can_send'
    expect(findInText(t, o('can'))).toHaveLength(4)
    expect(findInText(t, o('can', true))).toEqual([[24, 27], [37, 40], [45, 48]]) // the, scan, can_send
    expect(findInText(t, o('can', false, true))).toEqual([[4, 7], [24, 27]])
    expect(findInText(t, o('CAN', true, true))).toEqual([[4, 7]])
    expect(findInText(t, o(''))).toEqual([])
    expect(findInText('aaaa', o('aa'))).toEqual([[0, 2], [2, 4]]) // no overlaps
  })

  it('matches never span blocks or inline objects; editor and stored counts agree', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'battery pack' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'bat' }, { type: 'hardBreak' }, { type: 'text', text: 'tery Battery' }] },
        { type: 'codeBlock', content: [{ type: 'text', text: 'battery()' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Battery' }] }] }] },
      ],
    }
    const editor = makeEditor(doc)
    const m = findMatchesInDoc(editor.state.doc, o('battery'))
    expect(m.map((x) => editor.state.doc.textBetween(x.from, x.to))).toEqual(['battery', 'Battery', 'battery', 'Battery'])
    expect(countInJson(doc, o('battery'))).toBe(4)
    expect(countInJson(doc, o('battery', true))).toBe(findMatchesInDoc(editor.state.doc, o('battery', true)).length)
    editor.destroy()
  })

  it('page provider: highlights, current match, start after the cursor, selected text, clear', () => {
    const editor = makeEditor({ type: 'doc', content: ['one can', 'two can', 'three can'].map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })) })
    const p = editorFindProvider(() => editor)
    editor.commands.setTextSelection(10) // in "two can"
    expect(p.search(o('can'))).toBe(3)
    expect(editor.view.dom.querySelectorAll('.find-match')).toHaveLength(3)
    expect(p.startIndex!()).toBe(1)
    p.reveal(2)
    expect(editor.view.dom.querySelector('.find-current')!.textContent).toBe('can')
    editor.commands.setTextSelection({ from: 1, to: 4 })
    expect(p.selectedText!()).toBe('one')
    // Typing keeps highlights up to date.
    editor.commands.insertContentAt(1, 'can ')
    expect(editor.view.dom.querySelectorAll('.find-match')).toHaveLength(4)
    p.clear()
    expect(editor.view.dom.querySelectorAll('.find-match')).toHaveLength(0)
    editor.destroy()
  })

  it('presentation hits go slide by slide (main area, then boxes)', () => {
    const para = (t: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] })
    const slides = [
      { id: 's1', layout: 'content' as const, background: 'default' as const, content: para('Battery and battery'), boxes: [{ id: 'b1', x: 0, y: 0, w: 100, content: para('battery box') }] },
      { id: 's2', layout: 'content' as const, background: 'default' as const, content: para('nothing') },
      { id: 's3', layout: 'content' as const, background: 'default' as const, content: para('battery') },
    ]
    expect(presentationHits(slides, o('battery'))).toEqual([
      { slideId: 's1', key: 'main', local: 0 },
      { slideId: 's1', key: 'main', local: 1 },
      { slideId: 's1', key: 'b1', local: 0 },
      { slideId: 's3', key: 'main', local: 0 },
    ])
    expect(presentationHits(slides, o('Battery', true))).toHaveLength(1)
  })
})

describe('FindBar', () => {
  it('searches as you type, counts, steps (wrapping), toggles Aa / whole word, Esc closes', () => {
    const search = vi.fn((opts: FindOptions) => (opts.query === 'can' ? (opts.caseSensitive ? 2 : 5) : 0))
    const reveal = vi.fn()
    const clear = vi.fn()
    useFindStore.setState({ provider: { search, reveal, clear, startIndex: () => 3 }, open: true, query: '', caseSensitive: false, wholeWord: false, index: 0, total: 0 })
    render(<FindBar />)
    const input = screen.getByLabelText('Find')
    expect(screen.getByTestId('find-count')).toHaveTextContent('No results')
    fireEvent.change(input, { target: { value: 'can' } })
    expect(screen.getByTestId('find-count')).toHaveTextContent('4 of 5') // starts after the cursor
    expect(reveal).toHaveBeenLastCalledWith(3)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('find-count')).toHaveTextContent('5 of 5')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('find-count')).toHaveTextContent('1 of 5') // wraps
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(screen.getByTestId('find-count')).toHaveTextContent('5 of 5')
    fireEvent.click(screen.getByRole('button', { name: 'Match case' }))
    expect(search).toHaveBeenLastCalledWith({ query: 'can', caseSensitive: true, wholeWord: false })
    expect(screen.getByRole('button', { name: 'Match case' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(input, { key: 'w', code: 'KeyW', altKey: true })
    expect(search).toHaveBeenLastCalledWith({ query: 'can', caseSensitive: true, wholeWord: true })
    act(() => void fireEvent.keyDown(window, { key: 'F3', shiftKey: true }))
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.getByTestId('find-count')).toHaveTextContent('No results')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(useFindStore.getState().open).toBe(false)
    expect(clear).toHaveBeenCalled()
    useFindStore.setState({ provider: null, query: '' })
  })
})
