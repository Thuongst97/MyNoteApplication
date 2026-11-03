import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { PlaceholderLite } from '@/components/Editor/placeholder'

const make = (everywhere: boolean) => {
  const element = document.createElement('div')
  document.body.appendChild(element)
  return new Editor({
    element,
    extensions: [StarterKit, PlaceholderLite.configure({ everywhere, placeholder: () => 'Write something' })],
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }, { type: 'paragraph' }, { type: 'paragraph' }, { type: 'paragraph' }] },
  })
}
const prompts = (e: Editor) => e.view.dom.querySelectorAll('.is-empty[data-placeholder="Write something"]').length

describe('placeholder prompts', () => {
  it('pages: only the empty line with the cursor gets the prompt, however you move or press Enter', () => {
    const e = make(false)
    e.commands.setTextSelection(5) // 2nd paragraph (empty)
    expect(prompts(e)).toBe(1)
    e.commands.enter()
    e.commands.enter()
    expect(prompts(e)).toBe(1)
    e.commands.setTextSelection(7)
    expect(prompts(e)).toBe(1)
    e.commands.setTextSelection(2) // in "Hi": no prompt at all
    expect(prompts(e)).toBe(0)
    e.destroy()
  })

  it('slides: every empty line gets its prompt', () => {
    const e = make(true)
    expect(prompts(e)).toBe(3)
    e.destroy()
  })
})
