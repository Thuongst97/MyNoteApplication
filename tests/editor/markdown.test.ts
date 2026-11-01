import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import type { Editor, JSONContent } from '@tiptap/react'
import { markdownToHtml } from '@/lib/markdown'
import { docToText } from '@/lib/docText'
import { doc, makeEditor, p } from './helpers'

let editor: Editor
afterEach(() => editor?.destroy())

const blocks = (e: Editor) => e.getJSON().content as JSONContent[]
const types = (e: Editor) => blocks(e).map((n) => n.type)

describe('Markdown → editor blocks', () => {
  it('converts the main block types', () => {
    editor = makeEditor(doc(p()))
    editor.commands.insertContent(
      markdownToHtml(
        '# H1\n\n## H2\n\n#### H4\n\nText **b**\n\n- a\n- b\n\n1. x\n\n- [ ] t1\n- [x] t2\n\n> q\n\n```kotlin\nval x = 1\n```\n\n---\n\n| A | B |\n| - | - |\n| 1 | 2 |\n',
      ),
    )
    const json = blocks(editor)
    expect(types(editor)).toEqual(
      expect.arrayContaining(['heading', 'paragraph', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock', 'horizontalRule', 'table']),
    )
    expect(json.filter((n) => n.type === 'heading').map((h) => h.attrs!.level)).toEqual([1, 2, 3])
    const tasks = json.find((n) => n.type === 'taskList')!.content!
    expect(tasks.map((t) => t.attrs!.checked)).toEqual([false, true])
    const code = json.find((n) => n.type === 'codeBlock')!
    expect(code.attrs!.language).toBe('kotlin')
    expect(code.content![0].text).toBe('val x = 1')
    const table = json.find((n) => n.type === 'table')!
    expect(table.content!.map((r) => r.content!.map((c) => c.type))).toEqual([
      ['tableHeader', 'tableHeader'],
      ['tableCell', 'tableCell'],
    ])
  })

  it('turns mermaid fences into Mermaid docs (code block + diagram)', () => {
    editor = makeEditor(doc(p()))
    editor.commands.insertContent(markdownToHtml('```mermaid\nflowchart LR\n  A --> B\n```'))
    const block = blocks(editor).find((n) => n.type === 'codeBlock')!
    expect(block.attrs!.language).toBe('mermaid')
  })

  it('converts the project README without losing content', () => {
    const readme = readFileSync('README.md', 'utf8')
    editor = makeEditor(doc(p()))
    editor.commands.insertContent(markdownToHtml(readme))
    const json = blocks(editor)
    let tables = 0
    const walk = (n: { type?: string; content?: unknown[] }) => {
      if (n.type === 'table') tables++
      ;(n.content as Array<typeof n> | undefined)?.forEach(walk)
    }
    walk(editor.getJSON())
    // Screenshots, keyboard shortcuts, tests and the mind-map keys table (nested in a list item).
    expect(tables).toBe(4)
    expect(json.filter((n) => n.type === 'heading').length).toBeGreaterThan(8)
    const text = editor.getText()
    for (const s of ['PremiumNote', 'Keyboard shortcuts', 'npm install', 'Toggle sidebar', 'How reminders work']) expect(text).toContain(s)
    // Relative screenshots can't load, so they show as placeholders with their alt text.
    expect(text).toContain('🖼 Page in dark mode')
  })
})

describe('Markdown block', () => {
  it('stores its source, is searchable and survives HTML round-trips', () => {
    editor = makeEditor(doc(p()))
    editor.commands.insertMarkdown('# Hello\n\n| a | b |\n| - | - |\n| 1 | 2 |')
    const json = editor.getJSON()
    expect(json.content![0]).toMatchObject({ type: 'markdown', attrs: { source: '# Hello\n\n| a | b |\n| - | - |\n| 1 | 2 |' } })
    expect(docToText(json)).toContain('# Hello')
    const again = makeEditor(editor.getHTML())
    expect(blocks(again)[0].attrs!.source).toBe(json.content![0].attrs!.source)
    again.destroy()
  })
})
