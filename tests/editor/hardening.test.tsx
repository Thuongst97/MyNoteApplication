import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { applyTableWidths, enableTableResize } from '@/components/Editor/markdown/markdownTables'
import { markdownToHtml } from '@/lib/markdown'
import { useOfficeShapes, SHAPE_FILL } from '@/components/Whiteboard/officeShapes'
import { copyPage, pageHtml, pageText } from '@/components/Editor/pageCopy'
import { api } from '@/lib/api'
import { doc, makeEditor, p } from './helpers'

afterEach(() => vi.restoreAllMocks())

const rect = (left: number, width: number) => ({ left, width, right: left + width, top: 0, bottom: 30, height: 30, x: left, y: 0, toJSON: () => ({}) }) as DOMRect

describe('Markdown table column resize (drag and double-click)', () => {
  const setup = () => {
    const root = document.createElement('div')
    root.innerHTML = markdownToHtml('| A | B | C |\n| - | - | - |\n| 1 | 2 | 3 |')
    document.body.append(root)
    applyTableWidths(root, null)
    const cells = [...root.querySelectorAll('table tr')[0].children] as HTMLElement[]
    cells.forEach((c, i) => {
      vi.spyOn(c, 'getBoundingClientRect').mockReturnValue(rect(i * 100, 100))
      Object.defineProperty(c, 'offsetWidth', { value: 100, configurable: true })
    })
    const table = root.querySelector('table')!
    vi.spyOn(table, 'getBoundingClientRect').mockReturnValue(rect(0, 300))
    Object.defineProperty(table, 'offsetWidth', { value: 300, configurable: true })
    let widths: Record<string, number[]> | null = null
    const save = vi.fn((next: Record<string, number[]> | null) => (widths = next))
    const off = enableTableResize(root, () => widths, save)
    return { root, cells, table, save, off }
  }

  it('shows the resize cursor only near a column border', () => {
    const { root, cells } = setup()
    cells[0].dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 50 }))
    expect(root.classList.contains('md-col-edge')).toBe(false)
    cells[0].dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 97 }))
    expect(root.classList.contains('md-col-edge')).toBe(true)
  })

  it('dragging a border widens that column and saves the widths', () => {
    const { cells, table, save } = setup()
    cells[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 98 }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 158 }))
    expect(table.style.tableLayout).toBe('fixed')
    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(save).toHaveBeenCalledWith({ 0: [160, 100, 100] })
  })

  it('a column never gets narrower than the minimum', () => {
    const { cells, save } = setup()
    cells[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 198 }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 0 }))
    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(save.mock.calls[0][0][0][1]).toBe(40)
  })

  it('a click without moving saves nothing; double-click on the border resets the table', () => {
    const { cells, save } = setup()
    cells[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 98 }))
    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(save).not.toHaveBeenCalled()
    cells[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 98 }))
    expect(save).toHaveBeenCalledWith(null)
  })

  it('stops listening when turned off', () => {
    const { root, cells, off, save } = setup()
    off()
    cells[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 98 }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 160 }))
    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(save).not.toHaveBeenCalled()
    expect(root.classList.contains('md-resizing')).toBe(false)
  })
})

describe('Drawings: type into the selected shape (PowerPoint-like)', () => {
  /** A fake Excalidraw: one rectangle selected; Enter opens its text box. */
  const fakeApi = (selected: string[] = ['r1'], type = 'rectangle') => {
    const state = { selectedElementIds: Object.fromEntries(selected.map((id) => [id, true])), editingTextElement: null, newElement: null, openDialog: null }
    return { getAppState: () => state, getSceneElements: () => [{ id: 'r1', type }], updateScene: vi.fn() }
  }
  function Host({ api: a }: { api: ReturnType<typeof fakeApi> }) {
    const ref = useRef<HTMLDivElement>(null)
    const office = useOfficeShapes(a as never, ref)
    ;(window as unknown as { __office: typeof office }).__office = office
    return (
      <div ref={ref} data-testid="host">
        <div tabIndex={0} data-testid="canvas" />
      </div>
    )
  }
  const openTextBoxOnEnter = (host: HTMLElement, delayFrames = 2) =>
    host.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return
      // Excalidraw opens the text box a frame or two later.
      let n = delayFrames
      const tick = () => {
        if (n-- > 0) return void requestAnimationFrame(tick)
        const ta = document.createElement('textarea')
        ta.className = 'excalidraw-wysiwyg'
        host.append(ta)
        ta.focus()
      }
      requestAnimationFrame(tick)
    })

  it('typing with a shape selected opens its text box and keeps every character in order', async () => {
    const a = fakeApi()
    const { getByTestId } = render(<Host api={a} />)
    const host = getByTestId('host')
    openTextBoxOnEnter(host, 3)
    const canvas = getByTestId('canvas')
    for (const ch of 'Head') canvas.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, cancelable: true }))
    await waitFor(() => expect((host.querySelector('textarea') as HTMLTextAreaElement)?.value).toBe('Head'))
  })

  it('shortcuts with Ctrl/⌘ and typing with no or several shapes selected are left alone', () => {
    for (const [a, key, mods] of [
      [fakeApi(), 'c', { ctrlKey: true }],
      [fakeApi([]), 'r', {}],
      [fakeApi(['r1', 'r2']), 'r', {}],
      [fakeApi(['r1'], 'arrow'), 'r', {}],
    ] as const) {
      const { getByTestId, unmount } = render(<Host api={a} />)
      const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods })
      getByTestId('canvas').dispatchEvent(ev)
      expect(ev.defaultPrevented).toBe(false)
      unmount()
    }
  })

  it('the pen draws without fill and shapes get their fill back', async () => {
    const a = fakeApi()
    render(<Host api={a} />)
    const office = (window as unknown as { __office: { onAppStateChange: (s: unknown) => void } }).__office
    act(() => office.onAppStateChange({ activeTool: { type: 'freedraw' }, currentItemBackgroundColor: SHAPE_FILL }))
    await waitFor(() => expect(a.updateScene).toHaveBeenLastCalledWith({ appState: { currentItemBackgroundColor: 'transparent' } }))
    act(() => office.onAppStateChange({ activeTool: { type: 'rectangle' }, currentItemBackgroundColor: 'transparent' }))
    await waitFor(() => expect(a.updateScene).toHaveBeenLastCalledWith({ appState: { currentItemBackgroundColor: SHAPE_FILL } }))
  })
})

describe('Copy page', () => {
  const content = doc(
    p('Intro with <b>tags</b> as text'),
    { type: 'markdown', attrs: { source: '## From Markdown\n\n- one' } },
    { type: 'mermaid', attrs: { code: 'graph TD; A-->B' } },
    p('End'),
  )

  it('as plain text: the title, then the text of every block', () => {
    const editor = makeEditor(content)
    expect(pageText(editor, '  My page ')).toBe('My page\n\nIntro with <b>tags</b> as text\n\nEnd\n')
  })

  it('as rich text: escaped title, Markdown rendered, undrawn diagrams left out', async () => {
    const editor = makeEditor(content)
    const html = await pageHtml(editor, 'A <script>x</script> title')
    expect(html.startsWith('<h1>A &lt;script&gt;x&lt;/script&gt; title</h1>')).toBe(true)
    expect(html).toContain('<h2>From Markdown</h2>')
    expect(html).toContain('<li>one</li>')
    expect(html).not.toContain('data-type="markdown"')
    expect(html).not.toContain('data-type="mermaid"')
    expect(html).toContain('Intro with &lt;b&gt;tags&lt;/b&gt; as text')
  })

  it('sends each format to the clipboard', async () => {
    const write = vi.spyOn(api.clipboard, 'writeRich').mockResolvedValue()
    const editor = makeEditor(content)
    await copyPage(editor, 'T', 'markdown')
    expect(write).toHaveBeenLastCalledWith('', expect.stringContaining('# T\n\nIntro'))
    expect(write.mock.lastCall![1]).toContain('```mermaid\ngraph TD; A-->B\n```')
    await copyPage(editor, 'T', 'text')
    expect(write).toHaveBeenLastCalledWith('', 'T\n\nIntro with <b>tags</b> as text\n\nEnd\n')
    await copyPage(editor, 'T', 'rich')
    expect(write.mock.lastCall![0]).toContain('<h1>T</h1>')
    expect(write.mock.lastCall![1]).toBe('T\n\nIntro with <b>tags</b> as text\n\nEnd\n')
  })
})
