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
    expect(sections()).toEqual(['Personal library', 'Automotive', 'Software architecture', 'Network'])
    // The built-in library is open at first; close it to count the installed items.
    await userEvent.click(screen.getByRole('button', { name: 'Collapse Automotive' }))
    expect(await screen.findAllByTestId('thumb')).toHaveLength(3)

    await userEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    expect(screen.queryAllByTestId('thumb')).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Expand Network' }))
    expect(await screen.findAllByTestId('thumb')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    expect((await screen.findAllByTestId('thumb')).length).toBeGreaterThan(3)
    await userEvent.click(screen.getByRole('button', { name: 'Collapse Automotive' }))
    // collapsed state is saved permanently
    await userEvent.click(screen.getByRole('button', { name: 'Collapse Network' }))
    await waitFor(async () => expect((await api.libraries.get()).categories.find((c) => c.name === 'Network')?.collapsed).toBe(true))
  })

  it('searches by item text, renames, deletes items and libraries', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<LibraryPanel api={null} theme="light" onClose={() => {}} />)
    await screen.findByRole('region', { name: 'Network' })
    await userEvent.type(screen.getByPlaceholderText('Search libraries'), 'fire')
    // "Firewall" in the network library, and the built-in gateway ("routing · firewall").
    expect(sections()).toEqual(['Automotive', 'Network'])
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
      expect(saved.categories.map((c) => `${c.name}:${c.items.length}`)).toEqual(['Personal library:0', 'Automotive:0', 'Architecture:1'])
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

describe('built-in Automotive library', () => {
  it('ships with the app: read-only, searchable, items never saved to the library file', async () => {
    render(<LibraryPanel api={null} theme="light" onClose={() => {}} />)
    const auto = await screen.findByRole('region', { name: 'Automotive' })
    expect(within(auto).getByText('Built-in')).toBeInTheDocument()
    expect(within(auto).queryByRole('button', { name: 'Automotive options' })).toBeNull() // no rename/delete
    expect(within(auto).queryAllByRole('button', { name: /^Delete / })).toHaveLength(0)
    const names = useLibraryStore.getState().data!.categories.find((c) => c.name === 'Automotive')!.items.map((i) => i.name)
    expect(names).toEqual(expect.arrayContaining(['Head Unit ECU', 'IVI screen (modern)', 'Vehicle battery (12 V)', 'Luxury vehicle (sedan)', 'ECU (generic)', 'CAN bus network (CAN_H / CAN_L)', 'Automotive Ethernet switch', 'Android Automotive OS stack', 'Digital instrument cluster', 'AVN unit (audio · video · navigation)']))

    await userEvent.type(screen.getByPlaceholderText('Search libraries'), 'CAN bus')
    expect(sections()).toEqual(['Automotive'])
    await userEvent.clear(screen.getByPlaceholderText('Search libraries'))

    await userEvent.click(within(screen.getByRole('region', { name: 'Automotive' })).getByRole('button', { name: 'Collapse Automotive' }))
    await waitFor(async () => {
      const saved = (await api.libraries.get()).categories.find((c) => c.id === 'builtin-automotive')
      expect(saved).toMatchObject({ collapsed: true, items: [] }) // only its state is stored
    })
    // After a restart it's back, still collapsed, with all its items.
    useLibraryStore.setState({ data: null })
    await useLibraryStore.getState().load()
    const again = useLibraryStore.getState().data!.categories
    expect(again.map((c) => c.name).slice(0, 2)).toEqual(['Personal library', 'Automotive'])
    expect(again[1]).toMatchObject({ collapsed: true })
    expect(again[1].items.length).toBeGreaterThan(25)
  })

  it('every built-in item is a valid, grouped Excalidraw drawing', async () => {
    const { automotiveLibrary } = await import('@/lib/automotiveLibrary')
    const lib = automotiveLibrary()
    const ids = new Set<string>()
    for (const item of lib.items) {
      expect(item.name).toBeTruthy()
      expect(item.elements.length).toBeGreaterThan(1)
      for (const e of item.elements as Array<Record<string, unknown>>) {
        expect(typeof e.type).toBe('string')
        expect(Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.width) && Number.isFinite(e.height)).toBe(true)
        expect(ids.has(e.id as string)).toBe(false)
        ids.add(e.id as string)
        expect((e.groupIds as string[])[0]).toBe(`${item.id}-g`) // moves as one piece
      }
    }
  })
})
