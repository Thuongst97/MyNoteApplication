import { afterEach, describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/react'
import { blockSnippet, ensureBlockId } from '@/components/Editor/links/BlockIds'
import { doc, makeEditor, p, posOf } from './helpers'

let editor: Editor
afterEach(() => editor?.destroy())

describe('block ids', () => {
  it('assigns an id once and renders it as data-block-id', () => {
    editor = makeEditor(doc(p('Hello')))
    const pos = posOf(editor, (n) => n.type.name === 'paragraph')
    const id = ensureBlockId(editor, pos)!
    expect(id).toMatch(/^[0-9a-f-]{8,}$/)
    expect(ensureBlockId(editor, pos)).toBe(id)
    expect(editor.getHTML()).toContain(`data-block-id="${id}"`)
  })

  it('returns null for blocks that cannot be referenced', () => {
    editor = makeEditor(doc(p('x'), { type: 'horizontalRule' }))
    expect(ensureBlockId(editor, posOf(editor, (n) => n.type.name === 'horizontalRule'))).toBeNull()
  })

  it('is not copied when a block is split (Enter)', () => {
    editor = makeEditor(doc(p('Hello', { blockId: 'keep' })))
    editor.chain().setTextSelection(4).splitBlock().run()
    const ids = editor.getJSON().content!.map((n) => n.attrs?.blockId ?? null)
    expect(ids).toEqual(['keep', null])
  })

  it('is stripped from pasted content', () => {
    editor = makeEditor(doc(p('x', { blockId: 'orig' })))
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.view.pasteHTML('<p data-block-id="orig">pasted</p><p>more</p>')
    const ids = editor.getJSON().content!.map((n) => n.attrs?.blockId ?? null)
    expect(ids.filter((i) => i === 'orig')).toHaveLength(1)
  })

  it('makes short labels for references', () => {
    editor = makeEditor(doc(p('A fairly long sentence that should be trimmed nicely for labels'), { type: 'chart' }))
    const para = editor.state.doc.child(0)
    expect(blockSnippet(para, 20)).toBe('A fairly long sente…')
    expect(blockSnippet(editor.state.doc.child(1))).toBe('Chart')
    expect(blockSnippet(null)).toBe('')
  })
})

describe('flashBlock', () => {
  it('highlights the referenced block and fails for unknown ids', () => {
    editor = makeEditor(doc(p('One'), p('Two', { blockId: 'b2' })))
    expect(editor.commands.flashBlock('missing')).toBe(false)
    expect(editor.commands.flashBlock('b2')).toBe(true)
    expect(editor.view.dom.querySelector('.block-flash')?.textContent).toBe('Two')
  })
})
