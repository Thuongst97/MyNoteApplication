import { afterEach, describe, expect, it } from 'vitest'
import type { Editor, JSONContent } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { DEFAULT_CHART } from '@/components/Editor/chart/chartModel'
import { doc, makeEditor, p } from './helpers'

let editor: Editor
afterEach(() => editor?.destroy())

const types = (e: Editor) => (e.getJSON().content as JSONContent[]).map((n) => n.type)
const key = (e: Editor, init: KeyboardEventInit) =>
  e.view.someProp('handleKeyDown', (f) => f(e.view, new KeyboardEvent('keydown', { bubbles: true, ...init })))

describe('selected blocks are never replaced by line-break shortcuts', () => {
  it.each([
    ['Ctrl+Enter', { key: 'Enter', ctrlKey: true }],
    ['Shift+Enter', { key: 'Enter', shiftKey: true }],
  ])('%s with a chart selected starts a new line after it', (_name, init) => {
    editor = makeEditor(doc(p('before'), { type: 'chart', attrs: { spec: DEFAULT_CHART } }, p('after')))
    const pos = editor.state.doc.child(0).nodeSize
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)))
    // Ctrl on Linux/Windows test env = Mod.
    expect(key(editor, init)).toBe(true)
    expect(types(editor)).toEqual(['paragraph', 'chart', 'paragraph', 'paragraph'])
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
  })

  it('Shift+Enter in text still inserts a line break', () => {
    editor = makeEditor(doc(p('hello')))
    editor.commands.setTextSelection(3)
    key(editor, { key: 'Enter', shiftKey: true })
    expect(JSON.stringify(editor.getJSON())).toContain('hardBreak')
  })
})

describe('clicks inside a block editing panel', () => {
  it('are left to the panel (no block selection, no focus change)', () => {
    editor = makeEditor(doc(p('x')))
    const panel = document.createElement('div')
    panel.className = 'no-drag'
    const icon = document.createElement('span')
    panel.append(icon)
    editor.view.dom.append(panel)
    const handled = editor.view.someProp('handleDOMEvents', (h) => h.mousedown?.(editor.view, new MouseEvent('mousedown', { bubbles: true })))
    expect(handled).toBeFalsy() // target not set → not a panel click
    const ev = new MouseEvent('mousedown', { bubbles: true })
    Object.defineProperty(ev, 'target', { value: icon })
    expect(editor.view.someProp('handleDOMEvents', (h) => h.mousedown?.(editor.view, ev))).toBe(true)
    panel.remove()
  })
})

describe('read-only rendered content (Markdown block)', () => {
  it('leaves mouse selection and copying to the browser', () => {
    editor = makeEditor(doc(p('x')))
    const body = document.createElement('div')
    body.className = 'markdown-body selectable-text'
    const para = document.createElement('p')
    para.textContent = 'Copy me'
    body.append(para)
    editor.view.dom.append(body)
    const down = new MouseEvent('mousedown', { bubbles: true })
    Object.defineProperty(down, 'target', { value: para })
    expect(editor.view.someProp('handleDOMEvents', (h) => h.mousedown?.(editor.view, down))).toBe(true)
    // With text selected inside it, copy is the browser's (copies that text, not the block).
    const range = document.createRange()
    range.selectNodeContents(para)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    expect(editor.view.someProp('handleDOMEvents', (h) => h.copy?.(editor.view, new ClipboardEvent('copy')))).toBe(true)
    // Outside such content, copying stays the editor's job.
    window.getSelection()!.removeAllRanges()
    expect(editor.view.someProp('handleDOMEvents', (h) => h.copy?.(editor.view, new ClipboardEvent('copy')))).toBeFalsy()
    body.remove()
  })
})
