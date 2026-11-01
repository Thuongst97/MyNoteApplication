import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Excalidraw needs a real canvas; stub the few helpers the panel uses.
vi.mock('@excalidraw/excalidraw', () => ({
  CaptureUpdateAction: { IMMEDIATELY: 'IMMEDIATELY' },
  MIME_TYPES: { excalidrawlib: 'application/vnd.excalidrawlib+json' },
  restoreElements: (els: unknown[]) => els,
  serializeLibraryAsJSON: (items: unknown[]) => JSON.stringify({ type: 'excalidrawlib', libraryItems: items }),
  exportToSvg: async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('data-testid', 'thumb')
    return svg
  },
}))

const { LibraryPanel, useLibraryIntegration } = await import('@/components/Library/LibraryPanel')
const { useLibraryStore } = await import('@/stores/useLibraryStore')
const { api } = await import('@/lib/api')
const { installLibrary, emptyLibraries } = await import('@/lib/libraries')

const rect = (id: string, x = 0) => ({ id, type: 'rectangle', x, y: 0, width: 40, height: 20 })
const seed = () => {
  let d = emptyLibraries()
  d = installLibrary(d, 'https://x.com/software-architecture.excalidrawlib', [
    { id: 'srv', name: 'Server', created: 1, elements: [rect('a')] },
    { id: 'db', name: 'Database', created: 1, elements: [rect('b')] },
  ]).data
  d = installLibrary(d, 'https://x.com/network.excalidrawlib', [{ id: 'fw', created: 1, elements: [rect('c'), { id: 't', type: 'text', x: 0, y: 0, text: 'Firewall' }] }]).data
  return d
}

function fakeApi() {
  let scene: Array<Record<string, unknown>> = [{ id: 'sel', type: 'ellipse', x: 0, y: 0, width: 10, height: 10 }]
  return {
    getAppState: () => ({ zoom: { value: 1 }, scrollX: 0, scrollY: 0, width: 800, height: 600, selectedElementIds: { sel: true } }),
    getSceneElements: () => scene,
    getSceneElementsIncludingDeleted: () => scene,
    updateScene: vi.fn(({ elements }: { elements: typeof scene }) => (scene = elements)),
    scene: () => scene,
  }
}

beforeEach(async () => {
  localStorage.clear()
  await api.libraries.save(seed())
  useLibraryStore.setState({ data: null, busy: null })
})
const sections = () => screen.getAllByRole('region').map((s) => s.getAttribute('aria-label'))

describe('LibraryPanel', () => {
  it('shows libraries as collapsible categories with item counts', async () => {
    render(<LibraryPanel api={null} theme="light" onClose={() => {}} />)
    expect(await screen.findByRole('region', { name: 'Software architecture' })).toBeInTheDocument()
    expect(sections()).toEqual(['Personal library', 'Software architecture', 'Network'])
    expect(await screen.findAllByTestId('thumb')).toHaveLength(3)

    await userEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    expect(screen.queryAllByTestId('thumb')).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Expand Network' }))
    expect(await screen.findAllByTestId('thumb')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(await screen.findAllByTestId('thumb')).toHaveLength(3)
    // collapsed state is saved permanently
    await userEvent.click(screen.getByRole('button', { name: 'Collapse Network' }))
    await waitFor(async () => expect((await api.libraries.get()).categories[2].collapsed).toBe(true))
  })

  it('searches by item text, renames, deletes items and libraries', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<LibraryPanel api={null} theme="light" onClose={() => {}} />)
    await screen.findByRole('region', { name: 'Network' })
    await userEvent.type(screen.getByPlaceholderText('Search libraries'), 'fire')
    expect(sections()).toEqual(['Network'])
    await userEvent.clear(screen.getByPlaceholderText('Search libraries'))

    const arch = screen.getByRole('region', { name: 'Software architecture' })
    await userEvent.click(within(arch).getByRole('button', { name: 'Software architecture options' }))
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const input = screen.getByLabelText('Library name')
    await userEvent.clear(input)
    await userEvent.type(input, 'Architecture{Enter}')
    expect(sections()).toContain('Architecture')

    await userEvent.click(screen.getByRole('button', { name: 'Delete Database' }))
    await userEvent.click(within(screen.getByRole('region', { name: 'Network' })).getByRole('button', { name: 'Network options' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete library' }))
    await waitFor(async () => {
      const saved = await api.libraries.get()
      expect(saved.categories.map((c) => `${c.name}:${c.items.length}`)).toEqual(['Personal library:0', 'Architecture:1'])
    })
  })

  it('places items on the canvas (click) and makes them draggable', async () => {
    const fake = fakeApi()
    render(<LibraryPanel api={fake as never} theme="light" onClose={() => {}} />)
    const server = await screen.findByRole('button', { name: 'Server' })
    await userEvent.click(server)
    expect(fake.updateScene).toHaveBeenCalled()
    const added = fake.scene().slice(1)
    expect(added).toHaveLength(1)
    expect(added[0].id).not.toBe('a') // a copy with a fresh id
    expect(added[0].x).toBe(380) // centered: 400 - 40/2

    const setData = vi.fn()
    fireEvent.dragStart(server, { dataTransfer: { setData, effectAllowed: '' } })
    expect(setData).toHaveBeenCalledWith('application/vnd.excalidrawlib+json', expect.stringContaining('"Server"'))
  })

  it('adds the selected shapes to the personal library', async () => {
    const fake = fakeApi()
    render(<LibraryPanel api={fake as never} theme="light" onClose={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Add selected shapes' }))
    await waitFor(async () => expect((await api.libraries.get()).categories[0].items).toHaveLength(1))
  })

  it('installs from a link', async () => {
    const spy = vi.spyOn(api.libraries, 'installUrl').mockImplementation(async (url) => {
      const r = installLibrary(await api.libraries.get(), url, [{ id: 'n', name: 'New', created: 1, elements: [rect('z')] }])
      return { data: await api.libraries.save(r.data), categoryId: r.categoryId }
    })
    render(<LibraryPanel api={null} theme="light" onClose={() => {}} />)
    await screen.findByRole('region', { name: 'Network' })
    await userEvent.click(screen.getByRole('button', { name: 'Add library' }))
    await userEvent.click(screen.getByRole('button', { name: /Install from link/ }))
    await userEvent.type(screen.getByLabelText('Library link'), 'https://x.com/icons.excalidrawlib')
    await userEvent.click(screen.getByRole('button', { name: 'Install' }))
    expect(spy).toHaveBeenCalledWith('https://x.com/icons.excalidrawlib')
    expect(await screen.findByRole('region', { name: 'Icons' })).toBeInTheDocument()
  })
})

describe('useLibraryIntegration', () => {
  it('keeps items added from the canvas context menu in the personal library', async () => {
    let hook!: ReturnType<typeof useLibraryIntegration>
    function Probe() {
      hook = useLibraryIntegration('light')
      return null
    }
    render(<Probe />)
    await waitFor(() => expect(useLibraryStore.getState().data).not.toBeNull())
    await act(async () => {
      await hook.excalidrawProps.onLibraryChange([{ id: 'new1', status: 'unpublished', created: 1, elements: [rect('q')] }] as never)
    })
    // calling again with the same items doesn't duplicate
    await act(async () => {
      await hook.excalidrawProps.onLibraryChange([{ id: 'new1', status: 'unpublished', created: 1, elements: [rect('q')] }] as never)
    })
    await waitFor(async () => expect((await api.libraries.get()).categories[0].items.map((i) => i.id)).toEqual(['new1']))
  })
})
