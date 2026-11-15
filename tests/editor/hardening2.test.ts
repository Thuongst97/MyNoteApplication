import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportPageToFile, importPageFile, markdownToPage } from '@/components/Editor/pageFiles'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/useAppStore'
import { findKey, currentBlockRange } from '@/components/Editor/find/findPlugin'
import { markdownToHtml } from '@/lib/markdown'
import { doc, makeEditor, p } from './helpers'

afterEach(() => vi.restoreAllMocks())

describe('Page files: import and export', () => {
  it('a Markdown file becomes a page: its first # heading is the title', () => {
    const r = markdownToPage('notes.md', '﻿\n# Sprint review #\n\nDone **well**.\n')
    expect(r.title).toBe('Sprint review')
    expect(JSON.stringify(r.content)).toContain('"text":"well"')
    expect(markdownToPage('notes', 'Just text').title).toBe('notes')
    expect(markdownToPage('  ', '# ').title).toBe('Untitled')
  })

  it('export: tells how many pages and images went into the file', async () => {
    const toast = vi.fn()
    useAppStore.setState({ showToast: toast } as never)
    vi.spyOn(api.pageFiles, 'export').mockResolvedValue({ ok: true, path: '/x.ncpage', pages: 3, images: 1 } as never)
    await exportPageToFile('p1')
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/^Exported \(3 pages, 1 image\)/))
  })

  it('export: cancelling the save dialog says nothing; errors are shown readably', async () => {
    const toast = vi.fn()
    useAppStore.setState({ showToast: toast } as never)
    vi.spyOn(api.pageFiles, 'export').mockResolvedValueOnce({ ok: false } as never)
    await exportPageToFile('p1')
    expect(toast).not.toHaveBeenCalled()
    vi.spyOn(api.pageFiles, 'export').mockRejectedValueOnce(new Error("Error invoking remote method 'pages:export': Error: Page not found"))
    await exportPageToFile('p1')
    expect(toast).toHaveBeenCalledWith('Could not export: Page not found')
  })

  it('import: a Markdown file is saved as a new page under the chosen parent and opened', async () => {
    const toast = vi.fn()
    const setActivePage = vi.fn()
    useAppStore.setState({ showToast: toast, setActivePage, loadPages: vi.fn(async () => {}), toggleExpanded: vi.fn() } as never)
    vi.spyOn(api.pageFiles, 'import').mockResolvedValue({ kind: 'markdown', name: 'doc', text: '# From file\n\nbody' } as never)
    const save = vi.spyOn(api, 'savePage').mockResolvedValue(null)
    await importPageFile('parent1')
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ parentId: 'parent1', title: 'From file' }))
    expect(setActivePage).toHaveBeenCalledWith(save.mock.calls[0][0].id)
    expect(toast).toHaveBeenCalledWith('Imported page')
  })

  it('import: a page bundle reports pages and skipped images; failures are shown', async () => {
    const toast = vi.fn()
    useAppStore.setState({ showToast: toast, setActivePage: vi.fn(), loadPages: vi.fn(async () => {}), toggleExpanded: vi.fn() } as never)
    vi.spyOn(api.pageFiles, 'import').mockResolvedValueOnce({ kind: 'pages', rootId: 'r', count: 4, skippedImages: 2 } as never)
    await importPageFile(null)
    expect(toast).toHaveBeenCalledWith('Imported 4 pages (2 images could not be imported)')
    vi.spyOn(api.pageFiles, 'import').mockResolvedValueOnce(null as never)
    await importPageFile(null)
    expect(toast).toHaveBeenCalledTimes(1) // cancelled: nothing more
    vi.spyOn(api.pageFiles, 'import').mockRejectedValueOnce(new Error('Not a PremiumNote page file'))
    await importPageFile(null)
    expect(toast).toHaveBeenLastCalledWith('Could not import: Not a PremiumNote page file')
  })
})

describe('Find: highlights inside rendered Markdown blocks', () => {
  /** jsdom has no CSS Custom Highlight API: a small stand-in. */
  const g = globalThis as unknown as { CSS: unknown; Highlight: unknown }
  const original = { CSS: g.CSS, Highlight: g.Highlight }
  afterEach(() => Object.assign(g, original))
  const installHighlights = () => {
    const reg = new Map<string, { ranges: Range[]; priority?: number }>()
    ;(globalThis as unknown as { CSS: unknown }).CSS = { highlights: reg }
    ;(globalThis as unknown as { Highlight: unknown }).Highlight = class {
      ranges: Range[]
      priority = 0
      constructor(...r: Range[]) {
        this.ranges = r
      }
    }
    return reg
  }

  it('paints every match in the rendered text, marks the current one, and clears when find closes', () => {
    const reg = installHighlights()
    const source = '## Head unit\n\nThe head unit boots.'
    const editor = makeEditor(doc(p('head of page'), { type: 'markdown', attrs: { source } }))
    // The block view in tests is plain: render its Markdown where the app's view would.
    const pos = (() => {
      let at = -1
      editor.state.doc.descendants((n, ps) => {
        if (n.type.name === 'markdown') at = ps
      })
      return at
    })()
    const dom = editor.view.nodeDOM(pos) as HTMLElement
    const body = document.createElement('div')
    body.className = 'markdown-body selectable-text'
    body.innerHTML = markdownToHtml(source)
    dom.append(body)

    editor.view.dispatch(editor.state.tr.setMeta(findKey, { opts: { query: 'head', caseSensitive: false, wholeWord: false }, current: 2 }))
    expect(findKey.getState(editor.state)!.matches).toHaveLength(3)
    const all = reg.get('find-match')!
    expect(all.ranges.map((r) => r.toString())).toEqual(['Head', 'head'])
    expect(reg.get('find-current')!.ranges.map((r) => r.toString())).toEqual(['head'])
    expect(reg.get('find-current')!.priority).toBe(1)
    expect(currentBlockRange(editor.view)?.toString()).toBe('head')

    editor.view.dispatch(editor.state.tr.setMeta(findKey, { opts: null, current: -1 }))
    expect(reg.has('find-match')).toBe(false)
    expect(reg.has('find-current')).toBe(false)
    editor.destroy()
  })
})
