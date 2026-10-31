import { describe, expect, it } from 'vitest'
import { extractLinks, pageUrl, parsePageUrl } from '@/lib/links'

describe('page URLs', () => {
  it('builds and parses page and block links', () => {
    expect(pageUrl('abc')).toBe('notionclone://page/abc')
    expect(pageUrl('abc', 'blk')).toBe('notionclone://page/abc#blk')
    expect(parsePageUrl('notionclone://page/abc#blk')).toEqual({ pageId: 'abc', blockId: 'blk' })
    expect(parsePageUrl('  notionclone://page/abc  ')).toEqual({ pageId: 'abc', blockId: null })
  })

  it('rejects anything else', () => {
    for (const bad of ['https://x.com', 'notionclone://page/../etc', 'notionclone://page/', '', null, undefined, 'javascript:alert(1)'])
      expect(parsePageUrl(bad as never)).toBeNull()
  })
})

describe('extractLinks', () => {
  it('finds mentions, page blocks, link marks and links inside drawings', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'pageLink', attrs: { pageId: 'child' } },
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { pageId: 'p1', blockId: 'b1' } },
            { type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'notionclone://page/p2' } }] },
            { type: 'text', text: 'web', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
          ],
        },
        { type: 'drawing', attrs: { data: { scene: { elements: [{ link: 'notionclone://page/p3' }, { link: 'notionclone://page/gone', isDeleted: true }] } } } },
        { type: 'paragraph', content: [{ type: 'mention', attrs: { pageId: 'p1' } }] },
      ],
    }
    expect(extractLinks(doc).sort()).toEqual(['child', 'p1', 'p2', 'p3'])
  })

  it('reads links on whiteboard elements', () => {
    expect(extractLinks({ type: 'whiteboard', scene: { elements: [{ link: 'notionclone://page/w1' }, { link: null }] } })).toEqual(['w1'])
  })

  it('handles empty content', () => {
    expect(extractLinks(null)).toEqual([])
    expect(extractLinks({ type: 'doc' })).toEqual([])
  })
})
