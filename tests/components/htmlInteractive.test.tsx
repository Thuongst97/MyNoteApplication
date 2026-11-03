import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { HtmlBlockRender } from '@/components/Editor/html/HtmlView'
import { StaticBlocksContext } from '@/components/Editor/staticBlocks'
import { clampHeight, sandboxDocument } from '@/components/Editor/html/HtmlSandbox'
import { makeEditor } from '../editor/helpers'

const SRC = '<button id="b">Hi</button><script>document.getElementById("b").onclick = () => {}</script>'

describe('interactive HTML blocks', () => {
  it('plain HTML blocks never run scripts (sanitized, no frame)', () => {
    render(<HtmlBlockRender source={SRC} attrs={{ interactive: false }} />)
    expect(screen.queryByTestId('html-sandbox')).toBeNull()
    expect(document.querySelector('[data-html-block]')!.shadowRoot!.innerHTML).not.toContain('<script')
  })

  it('runs the user’s own scripts in a sandboxed frame', () => {
    render(<HtmlBlockRender source={SRC} attrs={{ interactive: true, trusted: true }} />)
    const frame = screen.getByTestId('html-sandbox') as HTMLIFrameElement
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts') // no same-origin, popups, forms, top navigation
    expect(frame.src).toMatch(/^pn-sandbox:\/\/frame\/offline\?r=/)
  })

  it('uses the online frame only when internet access is allowed', () => {
    render(<HtmlBlockRender source={SRC} attrs={{ interactive: true, trusted: true, allowNetwork: true }} />)
    expect((screen.getByTestId('html-sandbox') as HTMLIFrameElement).src).toMatch(/^pn-sandbox:\/\/frame\/online/)
  })

  it('scripts from imported/pasted pages wait for Run (which marks them trusted)', () => {
    const setAttrs = vi.fn()
    render(<HtmlBlockRender source={SRC} attrs={{ interactive: true, trusted: false }} setAttrs={setAttrs} />)
    expect(screen.queryByTestId('html-sandbox')).toBeNull()
    expect(screen.getByText(/runs JavaScript from an imported or pasted page/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Run/ }))
    expect(setAttrs).toHaveBeenCalledWith({ trusted: true })
    expect(screen.getByTestId('html-sandbox')).toBeInTheDocument()
  })

  it('slide thumbnails show a still picture instead of running the block', () => {
    render(
      <StaticBlocksContext.Provider value>
        <HtmlBlockRender source={SRC} attrs={{ interactive: true, trusted: true }} />
      </StaticBlocksContext.Provider>,
    )
    expect(screen.queryByTestId('html-sandbox')).toBeNull()
    expect(screen.getByText('Interactive')).toBeInTheDocument()
  })

  it('sends the block to its own frame only, and follows its height within limits', () => {
    render(<HtmlBlockRender source={SRC} attrs={{ interactive: true, trusted: true }} />)
    const frame = screen.getByTestId('html-sandbox') as HTMLIFrameElement
    const win = frame.contentWindow!
    const post = vi.spyOn(win, 'postMessage').mockImplementation(() => {})
    // Messages from other windows are ignored.
    act(() => void window.dispatchEvent(new MessageEvent('message', { data: { type: 'pn-ready' }, source: window })))
    expect(post).not.toHaveBeenCalled()
    act(() => void window.dispatchEvent(new MessageEvent('message', { data: { type: 'pn-ready' }, source: win })))
    expect(post).toHaveBeenCalledWith({ type: 'pn-run', html: expect.stringContaining('<button id="b">') }, '*')
    act(() => void window.dispatchEvent(new MessageEvent('message', { data: { type: 'pn-height', height: 333 }, source: win })))
    expect(frame.style.height).toBe('333px')
    act(() => void window.dispatchEvent(new MessageEvent('message', { data: { type: 'pn-height', height: 1e9 }, source: win })))
    expect(frame.style.height).toBe('4000px')
  })

  it('frame document: theme colors and a height reporter around the block', () => {
    const doc = sandboxDocument('<p>x</p>', 'dark')
    expect(doc).toContain('color-scheme: dark')
    expect(doc).toContain('<div id="pn-root" style="display:flow-root"><p>x</p></div>')
    expect(clampHeight('abc')).toBeNull()
    expect(clampHeight(-5)).toBe(24)
  })

  it('pasted HTML can’t mark a block trusted', () => {
    const editor = makeEditor('<div data-type="html-block" data-source="&lt;b&gt;x&lt;/b&gt;" data-interactive="true" data-trusted="true"></div>')
    const node = editor.state.doc.firstChild!
    expect(node.type.name).toBe('htmlBlock')
    expect(node.attrs.interactive).toBe(true)
    expect(node.attrs.trusted).toBe(false)
    editor.destroy()
  })

  it('/Interactive HTML inserts a working example the user can run', () => {
    const editor = makeEditor('<p></p>')
    editor.commands.insertHtmlBlock('<b>demo</b>', { interactive: true })
    const block = editor.getJSON().content!.find((n) => n.type === 'htmlBlock')!
    expect(block.attrs).toMatchObject({ interactive: true, trusted: true, allowNetwork: false })
    editor.destroy()
  })

  it('the frame forwards Esc so an expanded view can close', () => {
    expect(sandboxDocument('<p>x</p>', 'light')).toContain("parent.postMessage({ type: 'pn-escape' }, '*')")
  })

  it('expanded view: the frame fills the area instead of following its content height', () => {
    render(<HtmlBlockRender source={SRC} attrs={{ interactive: true, trusted: true }} fill />)
    expect((screen.getByTestId('html-sandbox') as HTMLIFrameElement).style.height).toBe('100%')
  })
})

