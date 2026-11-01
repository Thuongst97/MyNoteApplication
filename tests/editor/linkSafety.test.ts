import { afterEach, describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/react'
import { doc, makeEditor, p } from './helpers'

let editor: Editor
afterEach(() => editor?.destroy())

describe('links in notes', () => {
  it('refuses javascript: and data: links (typed or pasted)', () => {
    editor = makeEditor(doc(p('click me')))
    editor.chain().setTextSelection({ from: 1, to: 6 }).setLink({ href: 'javascript:alert(1)' }).run()
    expect(editor.getHTML()).not.toContain('javascript:')
    editor.commands.setContent('<p><a href="javascript:alert(1)">x</a> <a href="data:text/html,<script>alert(1)</script>">y</a> <a href="https://ok.example">z</a></p>')
    const html = editor.getHTML()
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('data:text/html')
    expect(html).toContain('https://ok.example')
  })
})
