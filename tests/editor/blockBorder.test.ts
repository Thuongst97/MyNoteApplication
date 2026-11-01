import { afterEach, describe, expect, it } from 'vitest'
import type { Editor, JSONContent } from '@tiptap/react'
import { blockFrameClass } from '@/components/Editor/blockBorder'
import { doc, makeEditor } from './helpers'

let editor: Editor
afterEach(() => editor?.destroy())
const first = (e: Editor) => (e.getJSON().content as JSONContent[])[0]

describe('mind map and drawing borders', () => {
  it.each(['mindmap', 'drawing'])('%s: on by default, also for blocks saved before the option', (type) => {
    editor = makeEditor(doc({ type }))
    expect(first(editor).attrs!.border).toBe(true)
    // Older HTML without the attribute → bordered.
    const again = makeEditor(editor.getHTML().replace(/ data-border="[^"]*"/g, ''))
    expect(first(again).attrs!.border).toBe(true)
    again.destroy()
  })

  it.each(['mindmap', 'drawing'])('%s: turning it off is stored and survives a reload', (type) => {
    editor = makeEditor(doc({ type, attrs: { border: false } }))
    expect(editor.getHTML()).toContain('data-border="false"')
    const again = makeEditor(editor.getHTML())
    expect(first(again).attrs!.border).toBe(false)
    again.destroy()
  })

  it('frame classes', () => {
    expect(blockFrameClass(false, true)).toContain('border-black/15')
    expect(blockFrameClass(false, false)).toContain('border-transparent')
    expect(blockFrameClass(true, false)).toContain('border-blue-400/70')
  })
})

describe('Mermaid and PlantUML diagram borders', () => {
  it('are on by default (also for existing blocks) and "off" survives copy & paste', async () => {
    const { makeEditor } = await import('./helpers')
    const e = makeEditor({
      type: 'doc',
      content: [
        { type: 'mermaid', attrs: { code: 'graph LR; A-->B' } },
        { type: 'plantuml', attrs: { source: 'A -> B' } },
      ],
    })
    const attrs = () => e.getJSON().content!.slice(0, 2).map((n) => n.attrs?.border)
    expect(attrs()).toEqual([true, true])
    const tr = e.state.tr
    e.state.doc.forEach((n, pos) => tr.setNodeMarkup(pos, undefined, { ...n.attrs, border: false }))
    e.view.dispatch(tr)
    e.commands.setContent(e.getHTML())
    expect(attrs()).toEqual([false, false])
    e.destroy()
  })
})
