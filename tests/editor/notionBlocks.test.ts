import { afterEach, describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/react'
import { doc, makeEditor, p } from './helpers'
import { docToText } from '@/lib/docText'
import { SLASH_COMMANDS } from '@/components/Editor/slashCommands'

let editor: Editor
afterEach(() => editor?.destroy())

const types = (e: Editor) => e.getJSON().content!.map((n) => n.type)

describe('callout', () => {
  it('turns the current line into a callout with an icon and color, cursor inside', () => {
    editor = makeEditor(doc(p('Tip text')))
    editor.commands.setTextSelection(3)
    editor.commands.setCallout()
    const callout = editor.getJSON().content![0]
    expect(callout).toMatchObject({ type: 'callout', attrs: { icon: '💡', color: 'default' }, content: [{ type: 'paragraph' }] })
    expect(editor.state.selection.$from.node(1).type.name).toBe('callout')
  })
  it('keeps icon/color (and "no icon") through copy & paste HTML', () => {
    editor = makeEditor(doc(p('x')))
    editor.commands.setTextSelection(2)
    editor.commands.setCallout({ icon: null, color: 'beige' })
    const html = editor.getHTML()
    editor.commands.setContent(html)
    expect(editor.getJSON().content![0].attrs).toMatchObject({ icon: '', color: 'beige' })
  })
})

describe('columns', () => {
  it.each([2, 3, 4, 5])('inserts %i columns with the cursor in the first one', (n) => {
    editor = makeEditor(doc(p('Intro'), p()))
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.commands.insertColumns(n)
    const cols = editor.getJSON().content!.find((b) => b.type === 'columns')!
    expect(cols.content).toHaveLength(n)
    expect(types(editor).slice(0, 2)).toEqual(['paragraph', 'columns'])
    expect(editor.state.selection.$from.node(2).type.name).toBe('column')
    expect(editor.state.selection.$from.index(1)).toBe(0)
  })
  it('round-trips through HTML', () => {
    editor = makeEditor(doc(p()))
    editor.commands.setTextSelection(1)
    editor.commands.insertColumns(3)
    editor.commands.insertContent('left')
    editor.commands.setContent(editor.getHTML())
    const cols = editor.getJSON().content![0]
    expect(cols.type).toBe('columns')
    expect(cols.content).toHaveLength(3)
    expect(docToText(editor.getJSON())).toContain('left')
  })
})

describe('toggles', () => {
  it('inserts an open toggle list with the cursor in its title', () => {
    editor = makeEditor(doc(p()))
    editor.commands.setTextSelection(1)
    editor.commands.insertToggle(0)
    editor.commands.insertContent('Click me')
    const t = editor.getJSON().content![0]
    expect(t).toMatchObject({ type: 'details', attrs: { open: true, level: 0 } })
    expect(t.content!.map((c) => c.type)).toEqual(['detailsSummary', 'detailsContent'])
    expect(t.content![0].content![0].text).toBe('Click me')
  })
  it.each([1, 2, 3, 4])('toggle heading %i keeps its level and open state through HTML', (level) => {
    editor = makeEditor(doc(p()))
    editor.commands.setTextSelection(1)
    editor.commands.insertToggle(level)
    editor.commands.insertContent('Section')
    editor.commands.setContent(editor.getHTML())
    expect(editor.getJSON().content![0]).toMatchObject({ type: 'details', attrs: { level, open: true } })
  })
})

describe('block equation', () => {
  it('inserts an equation block and is searchable by its LaTeX', () => {
    editor = makeEditor(doc(p()))
    editor.commands.setTextSelection(1)
    editor.commands.insertEquation('E = mc^2')
    expect(editor.getJSON().content![0]).toMatchObject({ type: 'equation', attrs: { source: 'E = mc^2' } })
    expect(docToText(editor.getJSON())).toContain('E = mc^2')
  })
})

describe('slash menu', () => {
  it("offers Notion's block types", () => {
    const titles = SLASH_COMMANDS.map((i) => i.title)
    for (const t of ['Callout', 'Toggle list', 'Toggle heading 1', 'Toggle heading 4', 'Block equation', '2 columns', '5 columns', 'Heading 4', 'HTML']) {
      expect(titles).toContain(t)
    }
  })
})

describe('blocks inserted inside containers', () => {
  it('a diagram/equation typed inside a toggle, callout or column stays inside it', () => {
    editor = makeEditor(doc(p()))
    editor.commands.setTextSelection(1)
    editor.commands.insertToggle(2)
    editor.commands.insertContent('Formulas')
    // Into the toggle's content line (the app's Enter key does this; checked in the app).
    let inContent = 0
    editor.state.doc.descendants((n, pos) => {
      if (n.type.name === 'detailsContent') inContent = pos + 2
    })
    editor.commands.setTextSelection(inContent)
    editor.commands.insertEquation('x^2')
    let t = editor.getJSON().content![0]
    expect(t.type).toBe('details')
    expect(t.content![1].content!.map((c) => c.type)).toEqual(['equation', 'paragraph'])

    editor.commands.setContent(doc(p('x')))
    editor.commands.setTextSelection(2)
    editor.commands.setCallout()
    editor.commands.insertMermaid('graph LR; A-->B')
    t = editor.getJSON().content![0]
    expect(t.type).toBe('callout')
    expect(t.content!.map((c) => c.type)).toEqual(['paragraph', 'mermaid', 'paragraph'])

    editor.commands.setContent(doc(p()))
    editor.commands.setTextSelection(1)
    editor.commands.insertColumns(2)
    editor.commands.insertEquation('y')
    const col = editor.getJSON().content![0].content![0]
    expect(col.content!.map((c) => c.type)).toEqual(['equation', 'paragraph'])
  })

  it('from a toggle title, the block goes into the page after the toggle', () => {
    editor = makeEditor(doc(p()))
    editor.commands.setTextSelection(1)
    editor.commands.insertToggle(0)
    editor.commands.insertContent('Title')
    editor.commands.insertEquation('z')
    expect(types(editor).slice(0, 2)).toEqual(['details', 'equation'])
  })
})
