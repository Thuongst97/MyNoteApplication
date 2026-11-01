import { afterEach, describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/react'
import { CODE_LANGUAGES, detectLanguage, languageLabel, lowlight } from '@/components/Editor/code/codeHighlight'
import { doc, makeEditor } from './helpers'

const KOTLIN = `@Singleton
class AudioSettingsRepository @Inject constructor(
    @ApplicationContext context: Context,
) : SettingsRepository {
    private val audioManager = context.getSystemService(AudioManager::class.java)
    override val settings: StateFlow<SystemSettings> = _settings.asStateFlow()
    override suspend fun setMuted(muted: Boolean) { _settings.update { it.copy(isMuted = muted) } }
}`

const PYTHON = `def fib(n: int) -> int:
    """Return the n-th Fibonacci number."""
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(10))`

let editor: Editor
afterEach(() => editor?.destroy())

const codeBlock = (text: string, language: string | null = null) => ({
  type: 'codeBlock',
  attrs: { language },
  content: [{ type: 'text', text }],
})

describe('code highlighting', () => {
  it('lists common languages with readable labels, sorted', () => {
    const ids = CODE_LANGUAGES.map((l) => l.id)
    for (const id of ['kotlin', 'java', 'typescript', 'python', 'sql', 'bash', 'json', 'go', 'rust']) expect(ids).toContain(id)
    expect(ids).not.toContain('php-template')
    const labels = CODE_LANGUAGES.map((l) => l.label)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
    expect(languageLabel('cpp')).toBe('C++')
    expect(languageLabel(null)).toBe('Plain text')
    expect(languageLabel('unknown-lang')).toBe('unknown-lang')
  })

  it('auto-detects the language', () => {
    expect(detectLanguage(PYTHON)).toBe('python')
    expect(['kotlin', 'java', 'scala']).toContain(detectLanguage(KOTLIN))
    expect(detectLanguage('   ')).toBeNull()
  })

  it('returns cached results for identical input', () => {
    expect(lowlight.highlight('kotlin', KOTLIN)).toBe(lowlight.highlight('kotlin', KOTLIN))
    expect(lowlight.highlightAuto(PYTHON)).toBe(lowlight.highlightAuto(PYTHON))
  })

  it('handles very long blocks', () => {
    const big = PYTHON.repeat(400)
    const t = performance.now()
    expect(detectLanguage(big)).toBe('python')
    expect(performance.now() - t).toBeLessThan(3000)
  })
})

describe('code block node', () => {
  it('colors code using the chosen language', () => {
    editor = makeEditor(doc(codeBlock('val x = 1 // note', 'kotlin')))
    const code = editor.view.dom.querySelector('pre code')!
    expect(code.querySelector('.hljs-keyword')?.textContent).toBe('val')
    expect(code.querySelector('.hljs-number')?.textContent).toBe('1')
    expect(code.querySelector('.hljs-comment')?.textContent).toBe('// note')
    // Highlighting is decoration-only: the stored text is unchanged.
    expect(editor.getJSON().content![0]).toMatchObject(codeBlock('val x = 1 // note', 'kotlin'))
  })

  it('colors code without a language via auto-detection', () => {
    editor = makeEditor(doc(codeBlock(PYTHON)))
    expect(editor.view.dom.querySelector('pre .hljs-keyword')).not.toBeNull()
    expect(editor.view.dom.querySelector('pre .hljs-string')).not.toBeNull()
  })

  it('re-highlights when the language changes', () => {
    editor = makeEditor(doc(codeBlock('SELECT name FROM users', 'plaintext')))
    expect(editor.view.dom.querySelector('pre .hljs-keyword')).toBeNull()
    editor.commands.updateAttributes('codeBlock', { language: 'sql' })
    editor.commands.setTextSelection(2)
    editor.commands.updateAttributes('codeBlock', { language: 'sql' })
    expect(editor.view.dom.querySelector('pre .hljs-keyword')?.textContent).toBe('SELECT')
  })

  it('disables spellcheck in code', () => {
    editor = makeEditor(doc(codeBlock('x')))
    expect(editor.view.dom.querySelector('pre')!.getAttribute('spellcheck')).toBe('false')
  })

  it('indents with Tab inside a code block', () => {
    editor = makeEditor(doc(codeBlock('x')))
    editor.commands.setTextSelection(1)
    editor.commands.keyboardShortcut('Tab')
    expect(editor.state.doc.firstChild!.textContent).toBe('    x')
  })
})

describe('mermaid doc', () => {
  const FLOW = '%% plan\nflowchart LR\n  A[Idea] --> B{Worth it?}\n  B -->|Yes| C("Build")\n  subgraph team\n  end'

  it('highlights mermaid source', () => {
    editor = makeEditor(doc(codeBlock(FLOW, 'mermaid')))
    const q = (sel: string) => [...editor.view.dom.querySelectorAll(`pre ${sel}`)].map((n) => n.textContent)
    expect(q('.hljs-comment')).toEqual(['%% plan'])
    expect(q('.hljs-keyword')).toContain('flowchart')
    expect(q('.hljs-operator')).toContain('-->')
    expect(q('.hljs-string')).toEqual(expect.arrayContaining(['Idea', 'Worth it?', '|Yes|']))
    expect(q('.hljs-built_in')).toEqual(['subgraph', 'end'])
  })

  it('is detected even after comments or front matter', () => {
    expect(detectLanguage(FLOW)).toBe('mermaid')
    expect(detectLanguage('---\ntitle: Flow\n---\nsequenceDiagram\n  A->>B: hi')).toBe('mermaid')
    expect(detectLanguage('%%{init: {"theme": "dark"}}%%\npie\n  "a": 1')).toBe('mermaid')
  })

  it('stores the diagram preview toggle', () => {
    editor = makeEditor(doc(codeBlock(FLOW, 'mermaid')))
    expect(editor.getJSON().content![0].attrs!.preview).toBe(true)
    editor.commands.setTextSelection(2)
    editor.commands.updateAttributes('codeBlock', { preview: false })
    expect(editor.getHTML()).toContain('data-preview="false"')
    const reloaded = makeEditor(editor.getHTML())
    expect(reloaded.getJSON().content![0].attrs!.preview).toBe(false)
    reloaded.destroy()
  })
})

describe('language detection heuristics', () => {
  it.each([
    ['.a { color: red; }', 'css'],
    ['body {\n  margin: 0;\n  padding: 4px;\n}', 'css'],
    ['<div class="a">hi</div>', 'xml'],
    ['{"a": [1, 2]}', 'json'],
    ['SELECT name FROM users WHERE id = 1', 'sql'],
    ['package main\n\nimport "fmt"\n\nfunc main() {\n  x := 1\n  fmt.Println(x)\n}', 'go'],
    ['fn main() {\n    let mut v = Vec::new();\n    println!("{}", v.len());\n}', 'rust'],
    ['interface User {\n  name: string\n}\nexport type Id = number', 'typescript'],
  ])('%s → %s', (code, lang) => {
    expect(detectLanguage(code)).toBe(lang)
  })
})
