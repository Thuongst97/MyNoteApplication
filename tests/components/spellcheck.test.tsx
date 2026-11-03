import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PageOptions } from '@/components/TitleBar/PageOptions'
import { Editor } from '@/components/Editor/Editor'
import { useAppStore } from '@/stores/useAppStore'

const initial = useAppStore.getState()
beforeEach(() => {
  localStorage.clear()
  useAppStore.setState({ ...initial, pages: [], activePageId: null, spellcheck: true }, true)
})

describe('spell check switch', () => {
  it('is on by default and can be turned off for all pages (remembered)', async () => {
    const id = await useAppStore.getState().createPage(null, { title: 'Notes' })
    render(
      <>
        <PageOptions pageId={id} />
        <Editor pageId={id} initialContent={{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'teh' }] }] }} onChange={vi.fn()} />
      </>,
    )
    const editorEl = () => document.querySelector('.ProseMirror') as HTMLElement
    expect(editorEl().getAttribute('spellcheck')).toBe('true')
    await userEvent.click(screen.getByRole('button', { name: 'Page options' }))
    const sw = screen.getByRole('switch', { name: 'Spell check' })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(sw)
    expect(useAppStore.getState().spellcheck).toBe(false)
    expect(sw).toHaveAttribute('aria-checked', 'false')
    expect(editorEl().getAttribute('spellcheck')).toBe('false')
    expect(JSON.parse(localStorage.getItem('notion-clone:prefs') ?? '{}').spellcheck).toBe(false)
    act(() => useAppStore.getState().setSpellcheck(true))
    expect(editorEl().getAttribute('spellcheck')).toBe('true')
  })
})
