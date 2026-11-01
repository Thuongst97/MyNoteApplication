import { afterEach, describe, expect, it } from 'vitest'
import { NodeSelection } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/react'
import { placeCursorAfter } from '@/components/Editor/mermaid/MermaidNode'
import { MERMAID_START } from '@/components/Editor/mermaid/renderMermaid'
import { DEFAULT_CHART } from '@/components/Editor/chart/chartModel'
import { doc, makeEditor, outline, p, posOf } from './helpers'

let editor: Editor
afterEach(() => editor?.destroy())

describe('mermaid block', () => {
  it('replaces an empty line and puts the cursor after the diagram', () => {
    editor = makeEditor(doc(p('Intro'), p()))
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.commands.insertMermaid('graph LR; A-->B')
    expect(outline(editor)).toEqual(['p:Intro', 'mermaid', 'p:'])
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
    // typing continues after the diagram instead of replacing it
    editor.commands.insertContent('next')
    expect(outline(editor)).toEqual(['p:Intro', 'mermaid', 'p:next'])
  })

  it('inserts after a non-empty block', () => {
    editor = makeEditor(doc(p('Intro')))
    editor.commands.setTextSelection(3)
    editor.commands.insertMermaid('graph TD; X')
    expect(outline(editor)).toEqual(['p:Intro', 'mermaid', 'p:'])
  })

  it('round-trips code through HTML', () => {
    editor = makeEditor(doc({ type: 'mermaid', attrs: { code: 'graph LR; A-->B', align: 'right' } }))
    const html = editor.getHTML()
    editor.commands.setContent(html)
    expect(editor.getJSON().content![0].attrs).toMatchObject({ code: 'graph LR; A-->B', align: 'right' })
  })

  it('recognises pasted mermaid code', () => {
    for (const ok of ['graph LR', 'flowchart TD', 'sequenceDiagram', 'pie title X', 'gantt', 'mindmap']) expect(MERMAID_START.test(ok)).toBe(true)
    for (const no of ['hello graph', 'graphics', 'Just text']) expect(MERMAID_START.test(no)).toBe(false)
  })

  it('placeCursorAfter creates a paragraph when there is none', () => {
    editor = makeEditor(doc({ type: 'mermaid', attrs: { code: 'graph LR' } }))
    placeCursorAfter(editor, editor.state.doc.child(0).nodeSize)
    expect(outline(editor)).toEqual(['mermaid', 'p:'])
  })
})

describe('chart, drawing, page link and mention nodes', () => {
  it('insert commands create the blocks', () => {
    editor = makeEditor(doc(p()))
    editor.commands.insertChart()
    expect(editor.getJSON().content![0]).toMatchObject({ type: 'chart', attrs: { spec: DEFAULT_CHART, isNew: true } })
    editor.commands.insertDrawing()
    editor.commands.insertPageLink('page-1')
    // Each insert leaves the cursor after the new block, so inserts don't replace each other.
    expect(outline(editor)).toEqual(['chart', 'drawing', 'pageLink', 'p:'])
  })

  it('round-trip through HTML (copy/paste between pages)', () => {
    const spec = { ...DEFAULT_CHART, title: 'Sales' }
    const data = { scene: { elements: [{ type: 'text', text: 'hi' }], files: {}, background: '#fff' }, svgLight: '<svg/>', svgDark: '<svg/>' }
    editor = makeEditor(
      doc(
        { type: 'chart', attrs: { spec, align: 'left' } },
        { type: 'drawing', attrs: { data } },
        { type: 'pageLink', attrs: { pageId: 'p1' } },
        { type: 'paragraph', content: [{ type: 'mention', attrs: { pageId: 'p2', blockId: 'b9', label: 'Some text' } }] },
      ),
    )
    editor.commands.setContent(editor.getHTML())
    const [chart, drawing, link, para] = editor.getJSON().content!
    expect(chart.attrs).toMatchObject({ spec, align: 'left' })
    expect(drawing.attrs!.data).toEqual(data)
    expect(link.attrs).toMatchObject({ pageId: 'p1' })
    expect((para.content![0] as { attrs?: object }).attrs).toMatchObject({ pageId: 'p2', blockId: 'b9', label: 'Some text' })
  })

  it('mind maps insert with the cursor after them and round-trip through HTML', async () => {
    const { newMindMap } = await import('@/components/Editor/mindmap/mindmapModel')
    const map = newMindMap('Ideas', ['One', 'Two'])
    editor = makeEditor(doc(p()))
    editor.commands.insertMindMap(map)
    expect(outline(editor)).toEqual(['mindmap', 'p:'])
    editor.commands.setContent(editor.getHTML())
    expect(editor.getJSON().content![0].attrs!.map).toEqual(map)
  })

  it('image alignment is stored and rendered', () => {
    editor = makeEditor(doc({ type: 'image', attrs: { src: 'data:,', align: 'center' } }))
    expect(editor.getHTML()).toContain('data-align="center"')
  })
})

describe('typing while a block is selected', () => {
  it('starts a new line instead of replacing an image or diagram', () => {
    editor = makeEditor(doc(p('A'), { type: 'mermaid', attrs: { code: 'graph LR' } }))
    const pos = posOf(editor, (n) => n.type.name === 'mermaid')
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)))
    const handled = editor.view.someProp('handleTextInput', (f) => f(editor.view, pos, pos + 1, 'x', () => editor.state.tr))
    expect(handled).toBe(true)
    expect(outline(editor).slice(0, 3)).toEqual(['p:A', 'mermaid', 'p:x'])
    expect(posOf(editor, (n) => n.type.name === 'mermaid')).toBeGreaterThan(0) // diagram kept
  })
})

describe('text formatting', () => {
  it('applies theme-aware colors and font sizes', () => {
    editor = makeEditor(doc(p('color me')))
    editor.chain().setTextSelection({ from: 1, to: 6 }).setColor('var(--c-red)').setBackgroundColor('var(--bg-yellow)').setFontSize('24px').toggleBold().run()
    const html = editor.getHTML()
    expect(html).toContain('color: var(--c-red)')
    expect(html).toContain('background-color: var(--bg-yellow)')
    expect(html).toContain('font-size: 24px')
    expect(html).toContain('<strong>')
  })
})

describe('damaged drawing data', () => {
  it('falls back to an empty drawing instead of crashing', async () => {
    const { normalizeDrawing } = await import('@/components/Editor/drawing/drawingModel')
    expect(normalizeDrawing(null)).toEqual({ scene: { elements: [], files: {}, background: '#ffffff' }, svgLight: '', svgDark: '' })
    const d = normalizeDrawing({ scene: { elements: [{ type: 'rectangle' }, null, 5], files: [], background: 'red;evil' }, svgLight: 42 })
    expect(d.scene.elements).toEqual([{ type: 'rectangle' }])
    expect(d.scene.files).toEqual({})
    expect(d.scene.background).toBe('#ffffff')
    expect(d.svgLight).toBe('')
  })
})

describe('whiteboard / drawing canvas background', () => {
  it('stores the light background (Excalidraw inverts it in dark mode); old dark backgrounds become white', async () => {
    const { canvasBackground } = await import('@/components/Editor/drawing/drawingModel')
    expect(canvasBackground(undefined)).toBe('#ffffff')
    expect(canvasBackground('')).toBe('#ffffff')
    expect(canvasBackground('#191919')).toBe('#ffffff') // saved by older versions in dark mode → showed light gray
    expect(canvasBackground('#FFF9DB')).toBe('#FFF9DB') // a color the user picked is kept
  })
})
