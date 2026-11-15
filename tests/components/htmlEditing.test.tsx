import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { HtmlNode } from '@/components/Editor/html/HtmlNode'
import { MarkdownNode } from '@/components/Editor/markdown/MarkdownNode'
import { HtmlPage } from '@/components/HtmlPage/HtmlPage'
import { api } from '@/lib/api'
import { autoSaver } from '@/lib/autoSave'
import { useAppStore } from '@/stores/useAppStore'
import type { PageMeta } from '@/types'

afterEach(() => vi.restoreAllMocks())

/** A real editor with the HTML and Markdown blocks (React node views). */
let editor: Editor | null = null
function Harness({ content }: { content: object }) {
  const e = useEditor({ extensions: [StarterKit, HtmlNode, MarkdownNode], content, immediatelyRender: true })
  editor = e
  return <EditorContent editor={e} />
}
const htmlDoc = (source: string, attrs: object = {}) => ({ type: 'doc', content: [{ type: 'htmlBlock', attrs: { source, ...attrs } }, { type: 'paragraph' }] })
const blockAttrs = (type = 'htmlBlock') => {
  let a: Record<string, unknown> | null = null
  editor!.state.doc.descendants((n) => {
    if (n.type.name === type) a = n.attrs
  })
  return a as Record<string, unknown> | null
}

describe('HTML / Markdown block editor', () => {
  it('Edit opens the colored code editor; Ctrl+Enter saves the new code', async () => {
    render(<Harness content={htmlDoc('<p>Old</p>')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit HTML' }))
    const code = await screen.findByLabelText('HTML source')
    expect(code.closest('.code-hl-wrap')?.querySelector('pre.code-hl .hljs-tag')).not.toBeNull()
    fireEvent.change(code, { target: { value: '<p>New</p>' } })
    fireEvent.keyDown(code, { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(blockAttrs()?.source).toBe('<p>New</p>'))
    expect(screen.queryByLabelText('HTML source')).toBeNull()
  })

  it('Esc cancels and keeps the old code', async () => {
    render(<Harness content={htmlDoc('<p>Keep</p>')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit HTML' }))
    const code = await screen.findByLabelText('HTML source')
    fireEvent.change(code, { target: { value: '<p>Discard</p>' } })
    fireEvent.keyDown(code, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByLabelText('HTML source')).toBeNull())
    expect(blockAttrs()?.source).toBe('<p>Keep</p>')
  })

  it('Tab indents inside the editor', async () => {
    render(<Harness content={htmlDoc('<p>x</p>')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit HTML' }))
    const code = (await screen.findByLabelText('HTML source')) as HTMLTextAreaElement
    code.setSelectionRange(0, 0)
    fireEvent.keyDown(code, { key: 'Tab' })
    expect(code.value).toBe('  <p>x</p>')
  })

  it('Format tidies the code; saving an empty block removes it', async () => {
    render(<Harness content={htmlDoc('<div><p>a</p><p>b</p></div>')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit HTML' }))
    const code = (await screen.findByLabelText('HTML source')) as HTMLTextAreaElement
    fireEvent.click(screen.getByRole('button', { name: /Format/ }))
    await waitFor(() => expect(code.value).toBe('<div>\n  <p>a</p>\n  <p>b</p>\n</div>\n'), { timeout: 8000 })
    fireEvent.change(code, { target: { value: '   ' } })
    fireEvent.keyDown(code, { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(blockAttrs()).toBeNull())
  })

  it('turning on JavaScript in the editor and saving marks the code as yours (trusted)', async () => {
    render(<Harness content={htmlDoc('<p id="x">hi</p>')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit HTML' }))
    await screen.findByLabelText('HTML source')
    fireEvent.click(screen.getByRole('checkbox', { name: /Run JavaScript/ }))
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    await waitFor(() => expect(blockAttrs()).toMatchObject({ interactive: true, trusted: true }))
  })

  it('a Markdown block opens with Markdown colors and no Format button', async () => {
    render(<Harness content={{ type: 'doc', content: [{ type: 'markdown', attrs: { source: '# Title' } }, { type: 'paragraph' }] }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Markdown' }))
    const code = await screen.findByLabelText('Markdown source')
    expect(code.closest('.code-hl-wrap')?.querySelector('pre.code-hl .hljs-section')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /Format/ })).toBeNull()
  })
})

const meta = (id: string): PageMeta => ({ id, kind: 'html', title: 'Dash', icon: null, cover: null, parentId: null, order: 0, createdAt: 0, updatedAt: 0 })

/** Text of the web page view (plain HTML is drawn inside a shadow root). */
const viewText = () => {
  const view = screen.getByTestId('html-page-view')
  const host = [...view.querySelectorAll('*')].find((el) => el.shadowRoot)
  return (host?.shadowRoot?.textContent ?? '') + view.textContent
}

describe('Web page (HTML page type)', () => {
  beforeEach(() => useAppStore.setState({ pages: [meta('w1')], focusTitleFor: null } as never))

  it('shows the page; Edit code opens the code beside the preview and autosaves edits', async () => {
    await api.savePage({ id: 'w1', title: 'Dash', kind: 'html', parentId: null, content: { type: 'htmlPage', source: '<h1>Hi</h1>', interactive: false, allowNetwork: false, trusted: true } as never })
    const schedule = vi.spyOn(autoSaver, 'schedule')
    render(<HtmlPage pageId="w1" />)
    await waitFor(() => expect(viewText()).toContain('Hi'))
    expect(screen.queryByLabelText('HTML code')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Edit code/ }))
    const code = screen.getByLabelText('HTML code')
    fireEvent.change(code, { target: { value: '<h1>Changed</h1>' } })
    await waitFor(() => expect(schedule).toHaveBeenCalledWith({ id: 'w1', content: expect.objectContaining({ source: '<h1>Changed</h1>', trusted: true }) }), { timeout: 3000 })
    await waitFor(() => expect(viewText()).toContain('Changed'))
    fireEvent.click(screen.getByRole('button', { name: /Close code/ }))
    expect(screen.queryByLabelText('HTML code')).toBeNull()
  })

  it("an imported page's scripts wait for Run", async () => {
    await api.savePage({ id: 'w-imp', title: 'Dash', kind: 'html', parentId: null, content: { type: 'htmlPage', source: '<script>1</script><p>x</p>', interactive: true, allowNetwork: false, trusted: false } as never })
    const schedule = vi.spyOn(autoSaver, 'schedule')
    useAppStore.setState({ pages: [meta('w-imp')] } as never)
    render(<HtmlPage pageId="w-imp" />)
    const run = await screen.findByRole('button', { name: /Run/ })
    expect(document.querySelector('iframe')).toBeNull()
    fireEvent.click(run)
    expect(schedule).toHaveBeenCalledWith({ id: 'w-imp', content: expect.objectContaining({ trusted: true }) })
    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())
  })

  it('a brand-new page opens with the code editor', async () => {
    useAppStore.setState({ focusTitleFor: 'w2', pages: [meta('w2')] } as never)
    await api.savePage({ id: 'w2', title: 'New', kind: 'html', parentId: null, content: { type: 'htmlPage', source: '<p>t</p>', interactive: true, allowNetwork: false, trusted: true } as never })
    render(<HtmlPage pageId="w2" />)
    expect(await screen.findByLabelText('HTML code')).toBeInTheDocument()
    expect(useAppStore.getState().focusTitleFor).toBeNull()
  })

  it('Full screen asks for the whole screen and Esc leaves it', async () => {
    await api.savePage({ id: 'w-full', title: 'Dash', kind: 'html', parentId: null, content: { type: 'htmlPage', source: '<p>x</p>', interactive: false, allowNetwork: false, trusted: true } as never })
    let fullEl: Element | null = null
    Object.defineProperty(document, 'fullscreenElement', { get: () => fullEl, configurable: true })
    const request = vi.fn(async function (this: Element) {
      fullEl = this
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    Element.prototype.requestFullscreen = request as never
    document.exitFullscreen = vi.fn(async () => {
      fullEl = null
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    useAppStore.setState({ pages: [meta('w-full')] } as never)
    render(<HtmlPage pageId="w-full" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Full screen' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exit full screen' })).toBeInTheDocument())
    expect(fullEl).toBe(screen.getByTestId('html-page'))
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Full screen' })).toBeInTheDocument())
    expect(document.exitFullscreen).toHaveBeenCalled()
  })
})
