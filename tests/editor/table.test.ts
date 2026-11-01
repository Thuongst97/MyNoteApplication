import { afterEach, describe, expect, it } from 'vitest'
import type { Editor, JSONContent } from '@tiptap/react'
import { SLASH_COMMANDS } from '@/components/Editor/slashCommands'
import { doc, makeEditor, p } from './helpers'

let editor: Editor
afterEach(() => editor?.destroy())

const blocks = (e: Editor) => e.getJSON().content as JSONContent[]
const shape = (e: Editor) => {
  const table = blocks(e).find((n) => n.type === 'table')!
  return table.content!.map((row) => row.content!.map((c) => (c.type === 'tableHeader' ? 'H' : 'C')).join(''))
}

describe('tables', () => {
  it('/table inserts a 3×3 table with a header row and puts the cursor in it', () => {
    editor = makeEditor(doc(p()))
    editor.commands.insertContent('/x')
    const to = editor.state.selection.from
    SLASH_COMMANDS.find((c) => c.title === 'Table')!.run(editor, { from: to - 2, to })
    expect(shape(editor)).toEqual(['HHH', 'CCC', 'CCC'])
    expect(editor.isActive('table')).toBe(true)
    expect(editor.getText()).not.toContain('/x')
  })

  it('adds and removes rows and columns, toggles the header and deletes the table', () => {
    editor = makeEditor(doc(p()))
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true })
    editor.commands.insertContent('A')
    editor.commands.addRowAfter()
    editor.commands.addColumnAfter()
    expect(shape(editor)).toEqual(['HHH', 'CCC', 'CCC'])
    editor.commands.deleteColumn()
    editor.commands.deleteRow()
    expect(shape(editor)).toEqual(['CC', 'CC'])
    editor.commands.toggleHeaderRow()
    expect(shape(editor)[0]).toBe('HH')
    editor.commands.deleteTable()
    expect(blocks(editor).some((n) => n.type === 'table')).toBe(false)
  })

  it('Tab moves to the next cell', () => {
    editor = makeEditor(doc(p()))
    editor.commands.insertTable({ rows: 1, cols: 2, withHeaderRow: false })
    editor.commands.insertContent('a')
    const tab = () => editor.view.someProp('handleKeyDown', (f) => f(editor.view, new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })))
    expect(tab()).toBe(true)
    editor.commands.insertContent('b')
    // Tab in the last cell adds a new row.
    expect(tab()).toBe(true)
    expect(shape(editor)).toEqual(['CC', 'CC'])
    const cells = blocks(editor).find((n) => n.type === 'table')!.content![0].content!
    expect(cells.map((c) => c.content![0].content?.[0].text)).toEqual(['a', 'b'])
  })

  it('round-trips through HTML', () => {
    editor = makeEditor(doc(p()))
    editor.commands.insertTable({ rows: 2, cols: 3, withHeaderRow: true })
    const again = makeEditor(editor.getHTML())
    expect(shape(again)).toEqual(['HHH', 'CCC'])
    again.destroy()
  })
})
