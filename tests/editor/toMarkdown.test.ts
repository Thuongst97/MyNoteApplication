import { describe, expect, it } from 'vitest'
import { docToMarkdown } from '@/lib/toMarkdown'

const t = (text: string, marks?: string[]) => ({ type: 'text', text, ...(marks && { marks: marks.map((type) => ({ type })) }) })
const p = (...content: object[]) => ({ type: 'paragraph', content })

describe('page as Markdown', () => {
  it('converts the common blocks and marks', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [t('Setup')] },
        p(t('Use '), t('aapt2', ['code']), t(' and '), t('bold', ['bold']), t(' or '), { type: 'text', text: 'docs', marks: [{ type: 'link', attrs: { href: 'https://x.dev' } }] }),
        { type: 'bulletList', content: [{ type: 'listItem', content: [p(t('one'))] }, { type: 'listItem', content: [p(t('two')), { type: 'bulletList', content: [{ type: 'listItem', content: [p(t('nested'))] }] }] }] },
        { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p(t('third'))] }] },
        { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p(t('done'))] }] },
        { type: 'codeBlock', attrs: { language: 'kotlin' }, content: [t('val x = 1')] },
        { type: 'mermaid', attrs: { code: 'graph TD; A-->B' } },
        { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [p(t('Path'))] }, { type: 'tableHeader', content: [p(t('Note'))] }] }, { type: 'tableRow', content: [{ type: 'tableCell', content: [p(t('a|b'))] }, { type: 'tableCell', content: [p(t('c'))] }] }] },
        { type: 'image', attrs: { src: 'notion-asset://local/x.png' } },
        { type: 'horizontalRule' },
        { type: 'blockquote', content: [p(t('quoted'))] },
      ],
    }
    expect(docToMarkdown(doc, 'Title')).toBe(
      [
        '# Title',
        '## Setup',
        'Use `aapt2` and **bold** or [docs](https://x.dev)',
        '- one\n- two\n  - nested',
        '3. third',
        '- [x] done',
        '```kotlin\nval x = 1\n```',
        '```mermaid\ngraph TD; A-->B\n```',
        '| Path | Note |\n| --- | --- |\n| a\\|b | c |',
        '*[Image]*',
        '---',
        '> quoted',
      ].join('\n\n') + '\n',
    )
  })
  it('escapes Markdown characters in plain text', () => {
    expect(docToMarkdown({ type: 'doc', content: [p(t('a*b_c [x]'))] })).toBe('a\\*b\\_c \\[x\\]\n')
  })
})
