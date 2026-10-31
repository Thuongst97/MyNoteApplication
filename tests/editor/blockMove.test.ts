import { afterEach, describe, expect, it } from 'vitest'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/react'
import { blockAt, blockAtSelection, deleteBlock, duplicateBlock, moveBlock, performBlockDrop } from '@/components/Editor/blockMove'
import { doc, makeEditor, outline, p, posOf, ul } from './helpers'

let editor: Editor
afterEach(() => editor?.destroy())

const textPos = (e: Editor, text: string) => posOf(e, (n) => n.isText && n.text === text)

describe('blockAt', () => {
  it('finds top-level blocks, list items and atoms', () => {
    editor = makeEditor(doc(p('One'), ul('a', 'b'), { type: 'horizontalRule' }))
    expect(blockAt(editor.state, textPos(editor, 'One'))!.node.type.name).toBe('paragraph')
    expect(blockAt(editor.state, textPos(editor, 'b'))!.node.type.name).toBe('listItem')
    const hr = posOf(editor, (n) => n.type.name === 'horizontalRule')
    expect(blockAt(editor.state, hr)!.node.type.name).toBe('horizontalRule')
    expect(blockAt(editor.state, -1)).toBeNull()
  })

  it('uses the selected node for node selections', () => {
    editor = makeEditor(doc(p('x'), { type: 'image', attrs: { src: 'data:,' } }))
    const pos = posOf(editor, (n) => n.type.name === 'image')
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)))
    expect(blockAtSelection(editor.state)).toMatchObject({ pos })
  })
})

describe('moveBlock', () => {
  it('moves the current block up and down and keeps the cursor in it', () => {
    editor = makeEditor(doc(p('A'), p('B'), p('C')))
    editor.commands.setTextSelection(textPos(editor, 'B') + 1)
    expect(moveBlock(editor, 'up')).toBe(true)
    expect(outline(editor)).toEqual(['p:B', 'p:A', 'p:C'])
    expect(editor.state.selection.$from.parent.textContent).toBe('B')
    moveBlock(editor, 'down')
    moveBlock(editor, 'down')
    expect(outline(editor)).toEqual(['p:A', 'p:C', 'p:B'])
    expect(moveBlock(editor, 'down')).toBe(false) // already last
  })

  it('moves a single list item within its list', () => {
    editor = makeEditor(doc(ul('apple', 'banana', 'cherry')))
    editor.commands.setTextSelection(textPos(editor, 'cherry'))
    moveBlock(editor, 'up')
    // (StarterKit always keeps an empty line after a trailing list)
    expect(outline(editor)).toEqual(['ul[apple|cherry|banana]', 'p:'])
  })

  it('moves a selected image and keeps it selected', () => {
    editor = makeEditor(doc(p('A'), { type: 'image', attrs: { src: 'data:,' } }))
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, posOf(editor, (n) => n.type.name === 'image'))))
    moveBlock(editor, 'up')
    expect(outline(editor)).toEqual(['image', 'p:A', 'p:'])
    expect(editor.state.selection).toBeInstanceOf(NodeSelection)
  })

  it('works via the Ctrl/Cmd+Shift+Arrow shortcut', () => {
    editor = makeEditor(doc(p('A'), p('B')))
    editor.commands.setTextSelection(textPos(editor, 'B'))
    editor.commands.keyboardShortcut('Mod-Shift-ArrowUp')
    expect(outline(editor)).toEqual(['p:B', 'p:A'])
  })
})

describe('duplicate / delete', () => {
  it('duplicates a block without copying its block id', () => {
    editor = makeEditor(doc(p('A', { blockId: 'id1' }), p('B')))
    const t = blockAt(editor.state, textPos(editor, 'A'))!
    duplicateBlock(editor, t)
    const ids = (editor.getJSON().content ?? []).map((n) => n.attrs?.blockId ?? null)
    expect(outline(editor)).toEqual(['p:A', 'p:A', 'p:B'])
    expect(ids).toEqual(['id1', null, null])
  })

  it('deletes a block', () => {
    editor = makeEditor(doc(p('A'), p('B')))
    deleteBlock(editor, blockAt(editor.state, textPos(editor, 'A'))!)
    expect(outline(editor)).toEqual(['p:B'])
  })
})

describe('performBlockDrop', () => {
  const line = { top: 0, left: 0, width: 0 }

  it('moves a block to another position', () => {
    editor = makeEditor(doc(p('A'), p('B'), p('C')))
    const a = blockAt(editor.state, textPos(editor, 'A'))!
    expect(performBlockDrop(editor.view, a, { insertPos: editor.state.doc.content.size, wrapInList: false, line })).toBe(true)
    expect(outline(editor)).toEqual(['p:B', 'p:C', 'p:A'])
    expect(editor.state.selection).toBeInstanceOf(TextSelection)
  })

  it('does nothing when dropped onto itself', () => {
    editor = makeEditor(doc(p('A'), p('B')))
    const a = blockAt(editor.state, textPos(editor, 'A'))!
    expect(performBlockDrop(editor.view, a, { insertPos: a.pos, wrapInList: false, line })).toBe(false)
  })

  it('wraps a list item dropped outside its list, removing the emptied list', () => {
    editor = makeEditor(doc(p('Top'), ul('only')))
    const item = blockAt(editor.state, textPos(editor, 'only'))!
    performBlockDrop(editor.view, item, { insertPos: 0, wrapInList: true, line })
    expect(outline(editor)).toEqual(['ul[only]', 'p:Top'])
  })
})
