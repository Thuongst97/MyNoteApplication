import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { HighlightedTextarea, formatHtml } from '@/components/Editor/code/HighlightedTextarea'

describe('HTML code editor', () => {
  it('colors tags, attributes, CSS and JavaScript behind the textarea', () => {
    const src = '<style>.a{color:red}</style><p class="x">Hi</p><script>let n = 1</script>'
    const { container } = render(<HighlightedTextarea aria-label="code" language="xml" value={src} onChange={() => {}} />)
    const pre = container.querySelector('pre.code-hl')!
    expect(pre.getAttribute('aria-hidden')).toBe('true')
    expect(pre.textContent).toBe(src + '\n')
    expect(pre.querySelector('.hljs-tag')).not.toBeNull()
    expect(pre.querySelector('.hljs-attr')?.textContent).toBe('class')
    expect(pre.querySelector('.hljs-selector-class')?.textContent).toBe('.a') // CSS
    expect(pre.querySelector('.hljs-keyword')?.textContent).toBe('let') // JavaScript
    expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toBe(src)
  })
  it('never turns code into markup (text only)', () => {
    const { container } = render(<HighlightedTextarea language="xml" value={'<img src=x onerror="alert(1)">'} onChange={() => {}} />)
    expect(container.querySelector('pre img')).toBeNull()
  })
  it('formats HTML with its CSS and JavaScript', async () => {
    const out = await formatHtml('<style>.card{padding:16px}</style><div class="card"><h1>Hi</h1><p>x</p></div><script>let v=0;function go(){v+=1}</script>')
    expect(out).toContain('.card {\n    padding: 16px;\n  }')
    expect(out).toContain('<div class="card">\n  <h1>Hi</h1>')
    expect(out).toContain('function go() {')
  })
})
