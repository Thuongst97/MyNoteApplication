import { describe, expect, it } from 'vitest'
import { looksLikeMarkdown, markdownToHtml } from '@/lib/markdown'

const html = (md: string) => {
  const div = document.createElement('div')
  div.innerHTML = markdownToHtml(md)
  return div
}

describe('markdownToHtml', () => {
  it('renders GitHub-flavored Markdown', () => {
    const d = html('# Title\n\nSome **bold** and `code` and ~~gone~~.\n\n> quote\n\n---\n\n1. one\n2. two\n')
    expect(d.querySelector('h1')!.textContent).toBe('Title')
    expect(d.querySelector('strong')!.textContent).toBe('bold')
    expect(d.querySelector('code')!.textContent).toBe('code')
    expect(d.querySelector('del')!.textContent).toBe('gone')
    expect(d.querySelector('blockquote')).not.toBeNull()
    expect(d.querySelector('hr')).not.toBeNull()
    expect(d.querySelectorAll('ol > li')).toHaveLength(2)
  })

  it('renders tables', () => {
    const d = html('| Key | Action |\n| --- | :-: |\n| **Tab** | Add |\n| `Ctrl+Z` | Undo |\n')
    expect([...d.querySelectorAll('th')].map((t) => t.textContent)).toEqual(['Key', 'Action'])
    expect(d.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(d.querySelector('td strong')!.textContent).toBe('Tab')
  })

  it('turns task lists into the editor task-list markup', () => {
    const d = html('- [ ] todo\n- [x] done\n')
    const ul = d.querySelector('ul')!
    expect(ul.getAttribute('data-type')).toBe('taskList')
    expect([...ul.querySelectorAll('li')].map((li) => [li.getAttribute('data-type'), li.getAttribute('data-checked'), li.textContent])).toEqual([
      ['taskItem', 'false', 'todo'],
      ['taskItem', 'true', 'done'],
    ])
    expect(d.querySelector('input')).toBeNull()
  })

  it('keeps mixed lists as bullets with box characters', () => {
    const d = html('- [x] done\n- plain\n')
    expect(d.querySelector('ul')!.hasAttribute('data-type')).toBe(false)
    expect(d.querySelector('li')!.textContent).toBe('☑ done')
  })

  it('keeps the language of code fences', () => {
    const d = html('```kotlin\nval x = 1\n```\n\n```mermaid\nflowchart LR\n A-->B\n```\n')
    expect([...d.querySelectorAll('pre code')].map((c) => c.className)).toEqual(['language-kotlin', 'language-mermaid'])
  })

  it('maps H4–H6 to H3', () => {
    const d = html('#### Deep\n\n###### Deeper')
    expect([...d.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Deep', 'Deeper'])
    expect(d.querySelector('h4, h5, h6')).toBeNull()
  })

  it('replaces images that cannot load with a placeholder', () => {
    const d = html('![Page in dark mode](docs/screenshots/01.png) ![ok](https://example.com/a.png)')
    const ph = d.querySelector('em')!
    expect(ph.textContent).toBe('🖼 Page in dark mode')
    expect(ph.getAttribute('title')).toBe('docs/screenshots/01.png')
    expect([...d.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toEqual(['https://example.com/a.png'])
  })

  it('removes scripts, handlers, styles and unsafe links', () => {
    const d = html(
      '<script>alert(1)</script>\n\n<img src="https://x/y.png" onerror="alert(1)">\n\n<p style="color:red" class="fixed inset-0" onclick="x()">hi</p>\n\n[bad](javascript:alert(1)) [file](file:///etc/passwd) [ok](https://a.b)\n\n<iframe src="https://evil"></iframe>',
    )
    const out = d.innerHTML
    expect(out).not.toMatch(/script|onerror|onclick|style=|iframe|javascript:|file:|fixed inset-0/)
    expect([...d.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['https://a.b'])
    expect(d.querySelector('a')!.getAttribute('rel')).toContain('noopener')
    expect(d.textContent).toContain('bad')
  })
})

describe('looksLikeMarkdown', () => {
  it.each([
    ['# Title\n\nText', true],
    ['| a | b |\n| --- | --- |\n| 1 | 2 |', true],
    ['```js\nx()\n```\nafter', true],
    ['- [ ] a\n- [x] b', true],
    ['- one\n- two\n- three', true],
    ['Some **bold** words\nand a [link](https://x.y)\n- item', true],
  ])('detects %j', (text, expected) => {
    expect(looksLikeMarkdown(text)).toBe(expected)
  })

  it.each([
    ['just one line with **bold**'],
    ['Plain text\nover two lines'],
    ['Dear team,\nthe meeting is at 10.\nThanks'],
    ['val x = 1\n// # not a heading\nfun main() {}'],
    ['- one\n- two'],
  ])('ignores %j', (text) => {
    expect(looksLikeMarkdown(text)).toBe(false)
  })
})
