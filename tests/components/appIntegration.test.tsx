import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mermaid and Excalidraw need a real layout engine; stub them.
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    parse: vi.fn(async (code: string) => {
      if (code.includes('-->') && code.trim().endsWith('-->')) throw new Error('Parse error on line 2')
      return true
    }),
    render: vi.fn(async (_id: string, code: string) => ({ svg: `<svg data-testid="mermaid-svg"><text>${code.length}</text></svg>` })),
  },
}))
vi.mock('@/components/Editor/drawing/DrawingEditor', () => ({
  default: ({ onClose }: { onClose: (r: unknown) => void }) => (
    <div role="dialog" aria-label="Drawing editor">
      <button onClick={() => onClose({ scene: { elements: [{ type: 'text', text: 'Box' }], files: {}, background: '#fff' }, svgLight: '<svg><text>Box</text></svg>', svgDark: '<svg/>' })}>Stub save</button>
      <button onClick={() => onClose(null)}>Stub cancel</button>
    </div>
  ),
}))

const { default: App } = await import('@/App')
const { useAppStore } = await import('@/stores/useAppStore')
const { autoSaver } = await import('@/lib/autoSave')
const { api } = await import('@/lib/api')

const initial = useAppStore.getState()
beforeEach(() => {
  localStorage.clear()
  useAppStore.setState({ ...initial, pages: [], activePageId: null, expanded: {}, view: 'page', isLoaded: false, isSearchOpen: false, theme: 'light' }, true)
})
const s = () => useAppStore.getState()
const editorEl = () => document.querySelector('.ProseMirror') as HTMLElement & { editor: import('@tiptap/react').Editor }

async function renderApp() {
  render(<App />)
  await screen.findByRole('textbox', { name: '' }).catch(() => null)
  await waitFor(() => expect(editorEl()).toBeTruthy())
  await waitFor(() => expect(editorEl().textContent).toContain('Welcome'))
}

describe('App (integration)', () => {
  it('starts with the Getting Started page and the editor', async () => {
    await renderApp()
    expect(screen.getByDisplayValue('Getting Started')).toBeInTheDocument()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('creates a page, edits title and body, and auto-saves', async () => {
    await renderApp()
    await act(async () => void (await s().createPage(null)))
    const title = await screen.findByPlaceholderText('Untitled')
    await userEvent.type(title, 'Meeting notes')
    await userEvent.keyboard('{Enter}') // moves into the body
    const ed = editorEl().editor
    act(() => void ed.commands.insertContent('Agenda item'))
    await act(async () => void (await autoSaver.flushAll()))
    const page = await api.readPage(s().activePageId!)
    expect(page!.title).toBe('Meeting notes')
    expect(JSON.stringify(page!.content)).toContain('Agenda item')
  })

  it('keyboard shortcuts open search, tasks, graph and toggle sidebar/theme', async () => {
    await renderApp()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(await screen.findByPlaceholderText('Search pages…')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.keyDown(window, { key: '\\', ctrlKey: true })
    expect(s().isSidebarOpen).toBe(false)
    fireEvent.keyDown(window, { key: 'L', ctrlKey: true, shiftKey: true })
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true))
    fireEvent.keyDown(window, { key: 'T', ctrlKey: true, shiftKey: true })
    expect(await screen.findByText(/Eisenhower matrix/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'G', ctrlKey: true, shiftKey: true })
    expect(await screen.findByRole('heading', { name: /Graph view/ })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true })
    await waitFor(() => expect(s().pages).toHaveLength(2))
  })

  it('page header adds an icon and a cover', async () => {
    await renderApp()
    await act(async () => void (await s().createPage(null, { title: 'Styled' })))
    await userEvent.click(await screen.findByRole('button', { name: /Add icon/ }))
    await userEvent.click(screen.getByRole('button', { name: /Add cover/ }))
    const meta = s().pages.find((p) => p.title === 'Styled')!
    expect(meta.icon).toBeTruthy()
    expect(meta.cover).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Change icon' }))
    await userEvent.click(screen.getByRole('button', { name: '🚀' }))
    expect(s().pages.find((p) => p.title === 'Styled')!.icon).toBe('🚀')
  })

  it('mermaid block: write code, preview, save, then show errors for bad code', async () => {
    await renderApp()
    await act(async () => void (await s().createPage(null, { title: 'Diagrams' })))
    await waitFor(() => expect(editorEl().textContent).toBe(''))
    act(() => void editorEl().editor.commands.insertMermaid())
    const box = await screen.findByPlaceholderText(/flowchart LR/)
    await userEvent.type(box, 'graph LR')
    expect(await screen.findByTestId('mermaid-svg', {}, { timeout: 2000 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByPlaceholderText(/flowchart LR/)).not.toBeInTheDocument())
    expect(editorEl().editor.getJSON().content![0].attrs!.code).toBe('graph LR')
    await act(() => new Promise((r) => setTimeout(r, 50))) // "save" moves the cursor on the next frame

    act(() => void editorEl().editor.commands.insertMermaid('graph LR\n A -->'))
    // diagrams render through a queue (after the live previews), so allow a little longer
    expect(await screen.findByText(/Can’t render this diagram/, {}, { timeout: 3000 })).toBeInTheDocument()
  })

  it('chart block: edit data, paste from a spreadsheet, switch type, show table', async () => {
    await renderApp()
    await act(async () => void (await s().createPage(null, { title: 'Charts' })))
    await waitFor(() => expect(editorEl().textContent).toBe(''))
    act(() => void editorEl().editor.commands.insertChart())
    const titleInput = await screen.findByPlaceholderText('Chart title')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Sales')
    await userEvent.click(screen.getByRole('button', { name: 'Paste from spreadsheet' }))
    fireEvent.change(screen.getByPlaceholderText(/Copy cells from Excel/), { target: { value: 'Month\tA\tB\nJan\t1\t2\nFeb\t3\t4' } })
    await userEvent.click(screen.getByRole('button', { name: 'Use this data' }))
    expect(screen.getByDisplayValue('Jan')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add series' }))
    await userEvent.click(screen.getByRole('button', { name: /^Row$/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Line' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const spec = editorEl().editor.getJSON().content![0].attrs!.spec
    expect(spec).toMatchObject({ type: 'line', title: 'Sales', labels: ['Jan', 'Feb', ''] })
    expect(spec.series.map((x: { name: string }) => x.name)).toEqual(['A', 'B', 'Series 3'])
    await userEvent.click(screen.getByRole('button', { name: 'Show data table' }))
    expect(within(document.querySelector('.chart-block table') as HTMLElement).getByText('Feb')).toBeInTheDocument()
  })

  it('drawing block: opens the editor, saves a preview, cancel on a new empty drawing removes it', async () => {
    await renderApp()
    await act(async () => void (await s().createPage(null, { title: 'Sketches' })))
    await waitFor(() => expect(editorEl().textContent).toBe(''))
    act(() => void editorEl().editor.commands.insertDrawing())
    await userEvent.click(await screen.findByRole('button', { name: 'Stub save' }))
    await waitFor(() => expect(document.querySelector('.drawing-svg')?.textContent).toBe('Box'))
    await act(() => new Promise((r) => setTimeout(r, 50))) // let "save" move the cursor (next frame), like a user would
    act(() => void editorEl().editor.commands.insertDrawing())
    await userEvent.click(await screen.findByRole('button', { name: 'Stub cancel' }))
    await waitFor(() => expect(editorEl().editor.getJSON().content!.filter((n) => n.type === 'drawing')).toHaveLength(1))
  })

  it('page links and block references navigate', async () => {
    await renderApp()
    let target = ''
    await act(async () => void (target = await s().createPage(null, { title: 'Target' })))
    await api.savePage({ id: target, content: { type: 'doc', content: [{ type: 'paragraph', attrs: { blockId: 'blk1' }, content: [{ type: 'text', text: 'Referenced line' }] }] } })
    await act(async () => void (await s().createPage(null, { title: 'Source' })))
    await waitFor(() => expect(editorEl().textContent).toBe(''))
    act(() =>
      void editorEl().editor.commands.insertContent([
        { type: 'pageLink', attrs: { pageId: target } },
        { type: 'paragraph', content: [{ type: 'mention', attrs: { pageId: target, blockId: 'blk1', label: 'Referenced line' } }] },
      ]),
    )
    const ref = await screen.findByText('› Referenced line')
    await userEvent.click(ref)
    await waitFor(() => expect(screen.getByDisplayValue('Target')).toBeInTheDocument())
    await waitFor(() => expect(document.querySelector('.block-flash')?.textContent).toBe('Referenced line'))
    await act(async () => s().setActivePage(s().pages.find((p) => p.title === 'Source')!.id))
    // Exact name: the block reference ("Target › Referenced line") is a link too.
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Target/ })).toHaveLength(2))
    await userEvent.click(await screen.findByRole('link', { name: /^\s*Target\s*$/ }))
    await waitFor(() => expect(screen.getByDisplayValue('Target')).toBeInTheDocument())
  })
})
