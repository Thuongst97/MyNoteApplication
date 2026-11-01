import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { CodeBlock } from '@tiptap/extension-code-block'
import { codeHighlightPlugin, IDLE_MS, SYNC_LIMIT, type Highlighter } from '@/components/Editor/code/highlightPlugin'
import { sizedLru } from '@/components/Editor/code/codeHighlight'

/** Fake highlighter: every word becomes a "kw" token; counts calls per code text. */
function fake() {
  const calls: string[] = []
  const tree = (code: string) => ({
    children: code.split(/(\s+)/).map((w) => (w.trim() ? { type: 'element', properties: { className: ['kw'] }, children: [{ type: 'text', value: w }] } : { type: 'text', value: w })),
  })
  const h: Highlighter = {
    highlight: (_l, code) => (calls.push(code), tree(code)),
    highlightAuto: (code) => (calls.push(code), tree(code)),
    registered: () => true,
  }
  return { h, calls }
}

let editor: Editor
afterEach(() => {
  editor?.destroy()
  vi.useRealTimers()
})

function make(h: Highlighter, blocks: string[]) {
  const Code = CodeBlock.extend({ addProseMirrorPlugins: () => [codeHighlightPlugin({ name: 'codeBlock', highlighter: h })] })
  const el = document.createElement('div')
  document.body.appendChild(el)
  editor = new Editor({
    element: el,
    extensions: [StarterKit.configure({ codeBlock: false }), Code],
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Intro' }] }, ...blocks.map((t) => ({ type: 'codeBlock', attrs: { language: 'js' }, content: [{ type: 'text', text: t }] }))] },
  })
  return editor
}
const tokens = () => editor.view.dom.querySelectorAll('pre .kw').length
const posInBlock = (i: number) => {
  let n = -1
  let at = 0
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'codeBlock' && ++n === i) at = pos + 1
    return node.type.name !== 'codeBlock'
  })
  return at
}

describe('code highlighting plugin', () => {
  it('highlights each block once; edits elsewhere never re-highlight unchanged blocks', () => {
    const { h, calls } = fake()
    make(h, ['const a = 1', 'let b = 2'])
    expect(calls).toHaveLength(2)
    expect(tokens()).toBe(8)
    editor.commands.insertContentAt(3, 'xyz') // typing in the paragraph
    editor.commands.insertContentAt(posInBlock(1), 'x ') // typing in block 2 only
    expect(calls).toEqual(['const a = 1', 'let b = 2', 'x let b = 2']) // block 1 not redone
    expect(tokens()).toBe(9)
  })

  it('small blocks update right away; large blocks keep their colors while typing and refresh after a pause', () => {
    vi.useFakeTimers()
    const { h, calls } = fake()
    const big = Array.from({ length: Math.ceil(SYNC_LIMIT / 4) }, (_, i) => `word${i}`).join(' ')
    expect(big.length).toBeGreaterThan(SYNC_LIMIT)
    make(h, [big])
    const before = tokens()
    calls.length = 0
    for (let i = 0; i < 5; i++) editor.commands.insertContentAt(posInBlock(0), 'z')
    expect(calls).toHaveLength(0) // not re-highlighted on every keystroke…
    expect(tokens()).toBe(before) // …but still colored
    vi.advanceTimersByTime(IDLE_MS + 10)
    expect(calls).toHaveLength(1) // once after the pause
    expect(editor.view.dom.querySelector('pre .kw')!.textContent).toBe('zzzzzword0')
  })

  it('re-highlights when blocks are added or the language changes', () => {
    const { h, calls } = fake()
    make(h, ['a b'])
    editor.commands.insertContentAt(editor.state.doc.content.size, { type: 'codeBlock', content: [{ type: 'text', text: 'c d e' }] })
    expect(calls).toContain('c d e')
    expect(tokens()).toBe(5)
    calls.length = 0
    editor.commands.command(({ tr }) => (tr.setNodeMarkup(posInBlock(0) - 1, undefined, { language: 'python' }), true))
    expect(calls).toEqual(['a b'])
  })
})

describe('code highlighting: moving and undo', () => {
  it('keeps colors when a block is moved or a deletion is undone', () => {
    const { h, calls } = fake()
    const ed = make(h, ['one two', 'three four five'])
    expect(tokens()).toBe(5)
    // Move the second block above the first (same node object reinserted).
    const second = posInBlock(1) - 1
    const node = ed.state.doc.nodeAt(second)!
    ed.view.dispatch(ed.state.tr.delete(second, second + node.nodeSize).insert(posInBlock(0) - 1, node))
    expect(tokens()).toBe(5)
    expect(ed.view.dom.querySelector('pre .kw')!.textContent).toBe('three')
    // Delete a block and undo.
    const first = posInBlock(0) - 1
    ed.commands.deleteRange({ from: first, to: first + ed.state.doc.nodeAt(first)!.nodeSize })
    expect(tokens()).toBe(2)
    ed.commands.undo()
    expect(tokens()).toBe(5)
    expect(calls).toHaveLength(2) // never highlighted again: cached per block
  })
})

describe('size-limited cache', () => {
  it('keeps total key size under the budget, evicting the oldest, and skips huge entries', () => {
    const cache = sizedLru<number>(100, 60)
    let computed = 0
    const get = (k: string) => cache(k, () => ++computed)
    get('a'.repeat(40))
    get('b'.repeat(40))
    get('a'.repeat(40)) // hit, now most recent
    expect(computed).toBe(2)
    get('c'.repeat(40)) // over budget: evicts "b…"
    expect(cache.stats()).toEqual({ entries: 2, chars: 80 })
    get('b'.repeat(40))
    expect(computed).toBe(4)
    get('d'.repeat(80)) // bigger than maxEntry: computed, not stored
    expect(cache.stats().chars).toBeLessThanOrEqual(100)
  })
})
