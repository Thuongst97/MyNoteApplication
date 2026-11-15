import { describe, expect, it } from 'vitest'
import { countInJson } from '@/lib/find'
import { countInMarkdown, markdownSegments, rangesIn } from '@/lib/findBlocks'
import { findMatchesInDoc } from '@/components/Editor/find/findPlugin'
import { markdownToHtml } from '@/lib/markdown'
import { doc, makeEditor, p } from './helpers'

const opts = (query: string, caseSensitive = false, wholeWord = false) => ({ query, caseSensitive, wholeWord })
const SRC = '## Head office\n\nThe **head** office opens at 9.\n\n- Head-up display\n- Lobby\n\n| Part | Note |\n| --- | --- |\n| HQ | head |\n\n```mermaid\ngraph TD; head-->x\n```\n'

describe('find in Markdown blocks', () => {
  it('reads the rendered text (no Markdown syntax), one segment per block', () => {
    const segs = markdownSegments(SRC)
    expect(segs).toContain('Head office')
    expect(segs).toContain('The head office opens at 9.')
    expect(segs.join('|')).not.toContain('**')
    expect(segs.join('|')).not.toContain('graph TD') // diagrams are skipped
  })
  it('counts matches with the find options', () => {
    expect(countInMarkdown(SRC, opts('head'))).toBe(4)
    expect(countInMarkdown(SRC, opts('Head', true))).toBe(2)
    expect(countInMarkdown(SRC, opts('head', false, true))).toBe(4)
    expect(countInMarkdown(SRC, opts('office opens'))).toBe(1) // across bold/plain text
    expect(countInMarkdown(SRC, opts('**head**'))).toBe(0)
  })
  it('is part of the document matches in the editor and in stored documents', () => {
    const content = doc(p('head of page'), { type: 'markdown', attrs: { source: SRC } }, p('Head again'))
    const editor = makeEditor(content)
    const m = findMatchesInDoc(editor.state.doc, opts('head'))
    expect(m).toHaveLength(6)
    expect(m.filter((x) => x.inner !== undefined).map((x) => x.inner)).toEqual([0, 1, 2, 3])
    expect(countInJson(content, opts('head'))).toBe(6)
  })
  it('finds the same matches as DOM ranges in the rendered block', () => {
    const root = document.createElement('div')
    root.innerHTML = markdownToHtml(SRC)
    const ranges = rangesIn(root, opts('head'))
    expect(ranges.map((r) => r.toString())).toEqual(['Head', 'head', 'Head', 'head'])
    expect(rangesIn(root, opts('office opens'))[0].toString()).toBe('office opens')
  })
})
