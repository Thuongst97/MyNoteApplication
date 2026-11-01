// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fontStyle, normalizeFont, PAGE_FONTS, pageFont } from '../../src/lib/pageFont'
import { cleanPageMeta } from '../../src/lib/pageMeta'
import { PageStorage } from '../../electron/storage'

describe('page fonts', () => {
  it('knows Notion-like Default / Serif / Mono and more', () => {
    expect(PAGE_FONTS.map((f) => f.label).slice(0, 3)).toEqual(['Default', 'Serif', 'Mono'])
    expect(pageFont('mono').stack).toMatch(/^'iA Writer Mono'/)
  })
  it('accepts only known ids', () => {
    expect(normalizeFont('serif')).toBe('serif')
    expect(normalizeFont('Comic Sans')).toBeNull()
    expect(normalizeFont(7)).toBeNull()
    expect(normalizeFont(null)).toBeNull()
  })
  it('builds the page style (default inherits the app font)', () => {
    expect(fontStyle(null)).toEqual({})
    expect(fontStyle('bogus')).toEqual({})
    expect(fontStyle('mono').fontFamily).toContain('iA Writer Mono')
    expect(fontStyle('hand')).toMatchObject({ fontSize: '1.25em' })
  })
  it('is kept in page metadata only when valid', () => {
    expect(cleanPageMeta({ id: 'a', font: 'mono' } as never).font).toBe('mono')
    expect('font' in cleanPageMeta({ id: 'a', font: '<evil>' } as never)).toBe(false)
  })
})

describe('page font storage', () => {
  let root: string
  beforeEach(async () => (root = await fs.mkdtemp(path.join(os.tmpdir(), 'nc-font-'))))
  afterEach(async () => fs.rm(root, { recursive: true, force: true }))

  it('saves, keeps across other updates, and resets the font', async () => {
    const s = new PageStorage(root)
    await s.save({ id: 'a', title: 'A', font: 'mono' })
    await s.save({ id: 'a', content: { type: 'doc', content: [] } as never })
    expect((await s.read('a'))!.font).toBe('mono')
    expect((await new PageStorage(root).getTree())[0].font).toBe('mono')
    await s.save({ id: 'a', font: 'nope' })
    expect((await s.read('a'))!.font).toBeNull()
  })
})
