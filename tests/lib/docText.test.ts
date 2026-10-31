import { describe, expect, it } from 'vitest'
import { docToText, makeSnippet } from '@/lib/docText'

describe('docToText', () => {
  it('flattens blocks with newlines and keeps inline text together', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world', marks: [{ type: 'bold' }] }] },
      ],
    }
    expect(docToText(doc)).toBe('Title\nHello world')
  })

  it('includes text from diagrams, charts, drawings, whiteboards and mentions', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'mermaid', attrs: { code: 'graph LR; Alpha-->Beta' } },
        { type: 'chart', attrs: { spec: { title: 'Revenue', labels: ['Q1'], series: [{ name: 'Sales' }] } } },
        { type: 'drawing', attrs: { data: { scene: { elements: [{ type: 'text', text: 'Sketch' }, { type: 'rectangle' }] } } } },
        { type: 'paragraph', content: [{ type: 'mention', attrs: { label: 'Some block' } }] },
      ],
    }
    const text = docToText(doc)
    for (const word of ['Alpha', 'Revenue', 'Q1', 'Sales', 'Sketch', 'Some block']) expect(text).toContain(word)
    expect(docToText({ type: 'whiteboard', scene: { elements: [{ type: 'text', text: 'Board text' }] } } as never)).toBe('Board text')
  })

  it('returns empty string for empty input', () => {
    expect(docToText(null)).toBe('')
  })
})

describe('makeSnippet', () => {
  it('returns an excerpt around the match (case-insensitive)', () => {
    const long = 'x'.repeat(100) + ' The NEEDLE is here ' + 'y'.repeat(100)
    const snip = makeSnippet(long, 'needle')!
    expect(snip.startsWith('…')).toBe(true)
    expect(snip).toContain('NEEDLE')
    expect(snip.length).toBeLessThan(120)
  })

  it('returns null when not found', () => {
    expect(makeSnippet('abc', 'z')).toBeNull()
  })
})
