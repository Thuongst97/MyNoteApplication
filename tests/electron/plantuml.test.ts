import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearPlantUmlCache, renderPlantUml } from '../../electron/plantuml'
import { DEFAULT_PLANTUML_SERVER, decodePlantUml, normalizePlantUmlServer, plantUmlSvgUrl, withStartEnd } from '../../src/lib/plantuml'
import { filterSlashCommands } from '../../src/components/Editor/slashCommands'
import { docToText } from '../../src/lib/docText'

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><text>Alice</text></svg>'
const reply = (body: string, type = 'image/svg+xml', status = 200) => new Response(body, { status, headers: { 'content-type': type } })

describe('PlantUML helpers', () => {
  it('accepts only http(s) server addresses and tidies them', () => {
    expect(normalizePlantUmlServer('https://www.plantuml.com/plantuml/')).toBe(DEFAULT_PLANTUML_SERVER)
    expect(normalizePlantUmlServer(' http://localhost:8080 ')).toBe('http://localhost:8080')
    expect(normalizePlantUmlServer('file:///etc/passwd')).toBeNull()
    expect(normalizePlantUmlServer('javascript:alert(1)')).toBeNull()
    expect(normalizePlantUmlServer('https://user:pw@host')).toBeNull()
    expect(normalizePlantUmlServer('')).toBeNull()
  })
  it('adds @startuml/@enduml when missing', () => {
    expect(withStartEnd('A -> B')).toBe('@startuml\nA -> B\n@enduml')
    expect(withStartEnd('@startmindmap\n* a\n@endmindmap')).toBe('@startmindmap\n* a\n@endmindmap')
  })
  it('encodes the diagram the way PlantUML servers expect (round-trip)', () => {
    const url = plantUmlSvgUrl('http://localhost:8080', 'Alice -> Bob: Xin chào')
    expect(url.startsWith('http://localhost:8080/svg/')).toBe(true)
    expect(decodePlantUml(url.split('/svg/')[1])).toBe('@startuml\nAlice -> Bob: Xin chào\n@enduml')
  })
})

describe('renderPlantUml (main process)', () => {
  beforeEach(() => clearPlantUmlCache())

  it('returns the SVG and caches it', async () => {
    const f = vi.fn(async () => reply(SVG))
    expect(await renderPlantUml('http://localhost:8080', 'A -> B', f as never)).toEqual({ svg: SVG })
    expect(await renderPlantUml('http://localhost:8080', 'A -> B', f as never)).toEqual({ svg: SVG })
    expect(f).toHaveBeenCalledTimes(1)
  })
  it("shows the server's error diagram for syntax errors (not cached)", async () => {
    const f = vi.fn(async () => reply('<svg><text>Syntax Error?</text></svg>', 'image/svg+xml', 400))
    expect(await renderPlantUml('http://localhost:8080', 'oops', f as never)).toEqual({ svg: '<svg><text>Syntax Error?</text></svg>' })
    await renderPlantUml('http://localhost:8080', 'oops', f as never)
    expect(f).toHaveBeenCalledTimes(2)
  })
  it('reports non-diagram answers, network errors and bad input', async () => {
    expect(await renderPlantUml('http://localhost:8080', 'A', (async () => reply('<html>login</html>', 'text/html')) as never)).toMatchObject({ error: expect.stringContaining('HTTP 200') })
    expect(await renderPlantUml('http://localhost:8080', 'A', (async () => { throw new TypeError('fetch failed') }) as never)).toMatchObject({ error: expect.stringContaining('localhost:8080') })
    expect(await renderPlantUml('ftp://x', 'A', vi.fn() as never)).toMatchObject({ error: expect.stringContaining('valid') })
    expect(await renderPlantUml('http://x', '  ', vi.fn() as never)).toEqual({ error: 'Empty diagram.' })
    expect(await renderPlantUml('http://x', 'a'.repeat(30_000), vi.fn() as never)).toMatchObject({ error: expect.stringContaining('too large') })
  })
})

describe('/puml', () => {
  it('finds the PlantUML block first', () => {
    expect(filterSlashCommands('puml')[0].title).toBe('PlantUML')
    expect(filterSlashCommands('plantuml')[0].title).toBe('PlantUML')
  })
  it('makes diagram text searchable', () => {
    expect(docToText({ type: 'doc', content: [{ type: 'plantuml', attrs: { source: 'Alice -> Bob' } }] } as never)).toBe('Alice -> Bob')
  })
})
