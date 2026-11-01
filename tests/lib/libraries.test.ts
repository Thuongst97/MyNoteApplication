import { describe, expect, it } from 'vitest'
import {
  addLibraryUrlFrom,
  emptyLibraries,
  filterLibraries,
  installLibrary,
  isAllowedLibraryUrl,
  itemText,
  libraryNameFrom,
  normalizeLibraries,
  parseLibraryFile,
  PERSONAL_ID,
} from '@/lib/libraries'

const rect = (id: string) => ({ id, type: 'rectangle', x: 0, y: 0, width: 10, height: 10 })
const label = (id: string, text: string) => ({ id, type: 'text', x: 0, y: 0, text })

describe('library files', () => {
  it('parses version 2 libraries (items with names)', () => {
    const items = parseLibraryFile(JSON.stringify({ type: 'excalidrawlib', version: 2, libraryItems: [{ id: 'a', name: 'Server', created: 5, elements: [rect('r')] }] }))
    expect(items).toEqual([{ id: 'a', name: 'Server', created: 5, elements: [rect('r')] }])
  })

  it('parses version 1 libraries (arrays of elements) and drops deleted elements', () => {
    const items = parseLibraryFile(JSON.stringify({ type: 'excalidrawlib', version: 1, library: [[rect('a'), { ...rect('gone'), isDeleted: true }], [rect('b')]] }))
    expect(items).toHaveLength(2)
    expect(items[0].elements).toEqual([rect('a')])
    expect(items[0].id).not.toBe(items[1].id)
  })

  it('skips broken items, fixes duplicate ids and rejects non-libraries', () => {
    const items = parseLibraryFile(JSON.stringify({ type: 'excalidrawlib', libraryItems: [{ id: 'x', elements: [rect('1')] }, { id: 'x', elements: [rect('2')] }, { id: 'bad', elements: [{ nope: 1 }] }, { elements: [] }] }))
    expect(items).toHaveLength(2)
    expect(new Set(items.map((i) => i.id)).size).toBe(2)
    expect(() => parseLibraryFile('not json')).toThrow(/not a valid library/)
    expect(() => parseLibraryFile('{"type":"excalidraw"}')).toThrow(/not an Excalidraw library/)
    expect(() => parseLibraryFile('{"type":"excalidrawlib","libraryItems":[]}')).toThrow(/no usable items/)
  })
})

describe('names and links', () => {
  it('derives readable names', () => {
    expect(libraryNameFrom('https://libraries.excalidraw.com/libraries/someone/software-architecture.excalidrawlib')).toBe('Software architecture')
    expect(libraryNameFrom('C:\\\\libs\\\\my_icons.excalidrawlib')).toBe('My icons')
    expect(libraryNameFrom('')).toBe('Library')
  })

  it('only allows https downloads (http://localhost only when explicitly allowed, i.e. development)', () => {
    expect(isAllowedLibraryUrl('https://x.com/a.excalidrawlib')).toBe(true)
    expect(isAllowedLibraryUrl('http://127.0.0.1:8765/a')).toBe(false) // release builds
    expect(isAllowedLibraryUrl('http://127.0.0.1:8765/a', { allowLocalHttp: true })).toBe(true)
    expect(isAllowedLibraryUrl('http://evil.com/a', { allowLocalHttp: true })).toBe(false)
    expect(isAllowedLibraryUrl('https://user:pass@x.com/a')).toBe(false)
    expect(isAllowedLibraryUrl('http://evil.com/a')).toBe(false)
    expect(isAllowedLibraryUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedLibraryUrl('not a url')).toBe(false)
  })

  it('reads the library URL from an "Add to Excalidraw" link', () => {
    const lib = 'https://libraries.excalidraw.com/libraries/a/b.excalidrawlib'
    expect(addLibraryUrlFrom(`https://excalidraw.com/#addLibrary=${encodeURIComponent(lib)}&token=t`)).toBe(lib)
    expect(addLibraryUrlFrom(`https://excalidraw.com/?addLibrary=${encodeURIComponent(lib)}`)).toBe(lib)
    expect(addLibraryUrlFrom(`https://excalidraw.com/#addLibrary=${encodeURIComponent('javascript:alert(1)')}`)).toBeNull()
    expect(addLibraryUrlFrom('https://excalidraw.com/')).toBeNull()
    expect(addLibraryUrlFrom(`https://excalidraw.com/#addLibrary=${encodeURIComponent('http://localhost:8080/x')}`)).toBeNull()
  })
})

describe('installing and storing', () => {
  const items = [{ id: 'i1', created: 1, elements: [rect('r')] }]

  it('installs a library as its own category, and re-installing updates it', () => {
    const url = 'https://x.com/flow-chart.excalidrawlib'
    const r1 = installLibrary(emptyLibraries(), url, items)
    expect(r1.data.categories.map((c) => c.name)).toEqual(['Personal library', 'Flow chart'])
    const r2 = installLibrary(r1.data, url, [...items, { id: 'i2', created: 2, elements: [rect('s')] }])
    expect(r2.categoryId).toBe(r1.categoryId)
    expect(r2.data.categories).toHaveLength(2)
    expect(r2.data.categories[1].items).toHaveLength(2)
    // files are always added as new categories
    expect(installLibrary(r2.data, 'file', items, 'Mine').data.categories).toHaveLength(3)
  })

  it('normalises stored data (personal first, unique ids, valid items)', () => {
    const d = normalizeLibraries({
      categories: [
        { id: 'a', name: 'A', source: 'file', items: [{ id: 'x', elements: [rect('r')] }, { id: 'bad', elements: 'nope' }], collapsed: true },
        { id: 'a', name: 'Dup id', items: [] },
        { id: PERSONAL_ID, name: 'Mine', source: 'whatever', items: [] },
        null,
      ],
    })
    expect(d.categories[0]).toMatchObject({ id: PERSONAL_ID, source: 'personal' })
    expect(d.categories[1]).toMatchObject({ id: 'a', collapsed: true })
    expect(d.categories[1].items).toHaveLength(1)
    expect(d.categories[2].id).not.toBe('a')
    expect(normalizeLibraries(null).categories.map((c) => c.id)).toEqual([PERSONAL_ID])
  })

  it('searches library names, item names and text inside items', () => {
    const d = installLibrary(emptyLibraries(), 'https://x.com/network.excalidrawlib', [
      { id: 'a', created: 1, elements: [rect('r'), label('t', 'Firewall')] },
      { id: 'b', name: 'Router', created: 1, elements: [rect('s')] },
    ]).data
    expect(itemText(d.categories[1].items[0])).toBe(' Firewall')
    expect(filterLibraries(d, 'fire').map((c) => c.items.map((i) => i.id))).toEqual([['a']])
    expect(filterLibraries(d, 'router')[0].items.map((i) => i.id)).toEqual(['b'])
    expect(filterLibraries(d, 'network')[0].items).toHaveLength(2) // whole library matches by name
    expect(filterLibraries(d, '')).toBe(d.categories)
  })
})
