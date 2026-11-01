import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/react'
import { filterSlashCommands, SLASH_COMMANDS } from '@/components/Editor/slashCommands'
import { useAppStore } from '@/stores/useAppStore'
import { doc, makeEditor, outline, p } from './helpers'

let editor: Editor
afterEach(() => editor?.destroy())

const run = (title: string) => {
  const cmd = SLASH_COMMANDS.find((c) => c.title === title)!
  // Simulates typing "/x" on an empty line, then choosing the command.
  editor.commands.insertContent('/x')
  const to = editor.state.selection.from
  cmd.run(editor, { from: to - 2, to })
}

describe('slash menu filtering', () => {
  it('lists everything for an empty query', () => {
    expect(filterSlashCommands('')).toHaveLength(SLASH_COMMANDS.length)
  })

  it('ranks title matches above keyword matches', () => {
    expect(filterSlashCommands('chart')[0].title).toBe('Chart') // "flowchart" is only a Mermaid keyword
    expect(filterSlashCommands('heading 2')[0].title).toBe('Heading 2')
    expect(filterSlashCommands('todo')[0].title).toBe('To-do list')
    expect(filterSlashCommands('draw')[0].title).toBe('Drawing')
    expect(filterSlashCommands('mind')[0].title).toBe('Mind map')
    expect(filterSlashCommands('brainstorm')[0].title).toBe('Mind map')
    expect(filterSlashCommands('mermaid doc')[0].title).toBe('Mermaid doc')
    expect(filterSlashCommands('zzzz')).toEqual([])
  })
})

describe('slash commands', () => {
  it.each([
    ['Heading 1', 'h1:'],
    ['Heading 3', 'h3:'],
    ['Bulleted list', 'ul[]'],
    ['Numbered list', 'orderedList'],
    ['To-do list', 'taskList'],
    ['Quote', 'blockquote'],
    ['Code', 'codeBlock'],
    ['Mermaid diagram', 'mermaid'],
    ['Chart', 'chart'],
    ['Drawing', 'drawing'],
    ['Mind map', 'mindmap'],
    ['Divider', 'horizontalRule'],
  ])('%s turns the line into %s', (title, expected) => {
    editor = makeEditor(doc(p()))
    run(title)
    expect(outline(editor)[0]).toBe(expected)
    expect(editor.getText()).not.toContain('/x')
  })

  it('"Mermaid doc" inserts a mermaid code block with a starter diagram', () => {
    editor = makeEditor(doc(p()))
    run('Mermaid doc')
    const block = editor.getJSON().content![0]
    expect(block.type).toBe('codeBlock')
    expect(block.attrs!.language).toBe('mermaid')
    expect(editor.state.doc.firstChild!.textContent).toMatch(/^flowchart/)
    expect(editor.getText()).not.toContain('/x')
  })

  it('"Page" inserts a sub-page link and creates the sub-page', () => {
    const createPage = vi.fn(async () => 'x')
    useAppStore.setState({ activePageId: 'parent', createPage })
    editor = makeEditor(doc(p()))
    run('Page')
    const link = editor.getJSON().content![0]
    expect(link.type).toBe('pageLink')
    expect(createPage).toHaveBeenCalledWith('parent', { id: link.attrs!.pageId })
  })

  it('"Link to page" types [[ to open the page picker', () => {
    editor = makeEditor(doc(p()))
    run('Link to page')
    expect(editor.getText()).toBe('[[')
  })
})
