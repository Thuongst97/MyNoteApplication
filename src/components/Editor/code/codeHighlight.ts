import { common, createLowlight } from 'lowlight'
import java from 'highlight.js/lib/languages/java'
import type { HLJSApi, Language } from 'highlight.js'
import { mermaidGrammar } from './mermaidGrammar'
import { MERMAID_START } from '../mermaid/renderMermaid'

/** Shared highlighter with the ~35 most common languages (kotlin, ts, python, go, sql…) plus Mermaid. */
const base = createLowlight(common)
base.register('mermaid', mermaidGrammar)

/** Android Interface Definition Language: Java syntax plus AIDL's own keywords. */
function aidl(hljs: HLJSApi): Language {
  const def = java(hljs)
  const kw = (def.keywords ?? {}) as Record<string, unknown>
  const extra = ['oneway', 'in', 'out', 'inout', 'parcelable']
  const keyword = Array.isArray(kw.keyword) ? [...kw.keyword, ...extra] : `${String(kw.keyword ?? '')} ${extra.join(' ')}`
  return { ...def, name: 'AIDL', aliases: ['aidl'], keywords: { ...kw, keyword } }
}
base.register('aidl', aidl)

type Root = ReturnType<typeof base.highlight>

/** Human-friendly names for the language picker. Anything missing falls back to the id. */
const LABELS: Record<string, string> = {
  aidl: 'AIDL',
  arduino: 'Arduino',
  bash: 'Bash',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  css: 'CSS',
  diff: 'Diff',
  go: 'Go',
  graphql: 'GraphQL',
  ini: 'INI / TOML',
  java: 'Java',
  javascript: 'JavaScript',
  json: 'JSON',
  kotlin: 'Kotlin',
  less: 'Less',
  lua: 'Lua',
  makefile: 'Makefile',
  markdown: 'Markdown',
  mermaid: 'Mermaid',
  objectivec: 'Objective-C',
  perl: 'Perl',
  php: 'PHP',
  plaintext: 'Plain text',
  python: 'Python',
  r: 'R',
  ruby: 'Ruby',
  rust: 'Rust',
  scss: 'SCSS',
  shell: 'Shell session',
  sql: 'SQL',
  swift: 'Swift',
  typescript: 'TypeScript',
  vbnet: 'VB.NET',
  wasm: 'WebAssembly',
  xml: 'HTML / XML',
  yaml: 'YAML',
}

/** Internal helper languages that aren't useful to pick directly. */
const HIDDEN = new Set(['php-template', 'python-repl'])

export const CODE_LANGUAGES: Array<{ id: string; label: string }> = base
  .listLanguages()
  .filter((id) => !HIDDEN.has(id))
  .map((id) => ({ id, label: LABELS[id] ?? id }))
  .sort((a, b) => a.label.localeCompare(b.label))

export function languageLabel(id: string | null | undefined) {
  if (!id) return 'Plain text'
  return LABELS[id] ?? id
}

/**
 * LRU cache limited by the total size of its keys (≈ the code text), not by entry count:
 * keys are whole code blocks, so a count limit could hold many large blocks (and every
 * version of a block being edited). Entries bigger than `maxEntry` aren't cached.
 */
export function sizedLru<V>(budget: number, maxEntry: number) {
  const map = new Map<string, V>()
  let used = 0
  const fn = (key: string, compute: () => V): V => {
    if (map.has(key)) {
      const hit = map.get(key)!
      map.delete(key)
      map.set(key, hit)
      return hit
    }
    const value = compute()
    if (key.length > maxEntry) return value
    map.set(key, value)
    used += key.length
    while (used > budget && map.size) {
      const oldest = map.keys().next().value!
      map.delete(oldest)
      used -= oldest.length
    }
    return value
  }
  fn.stats = () => ({ entries: map.size, chars: used })
  return fn
}
// Code blocks in the editor are cached per block by highlightPlugin; this cache serves the
// rest (Markdown/HTML code, detection runs) and stays small.
const highlightCache = sizedLru<Root>(300_000, 60_000)
const detectCache = sizedLru<string | null>(200_000, 5_000)

/** Very long blocks are auto-detected from their beginning only (detection is the slow part). */
const AUTO_SAMPLE = 4000

/**
 * Strong, cheap hints for popular languages. highlight.js relevance alone is
 * easily fooled (e.g. annotated Kotlin scores higher as Less), so each matching
 * signature adds a bonus on top of the relevance score.
 */
const SIGNATURES: Array<[string, RegExp[]]> = [
  ['kotlin', [/\b(?:fun|val|var)\s+[`\w]+/, /\boverride\s+(?:val|var|fun)\b/, /\bsuspend\s+fun\b/, /\bdata\s+class\b/, /::class\b/, /\?:/, /\bcompanion\s+object\b/]],
  ['java', [/\bpublic\s+(?:static\s+)?(?:final\s+)?(?:class|void|interface)\b/, /System\.out\.print/, /^\s*import\s+java\./m, /\bnew\s+\w+<.*>\(\)/]],
  ['typescript', [/\binterface\s+\w+\s*\{/, /:\s*(?:string|number|boolean|void|unknown)\b/, /\bexport\s+(?:type|interface)\b/, /\bas\s+const\b/]],
  ['javascript', [/\brequire\(['"]/, /\bconsole\.log\(/, /\bmodule\.exports\b/, /\b(?:const|let)\s+\w+\s*=\s*(?:async\s*)?\(.*\)\s*=>/]],
  ['python', [/^\s*def\s+\w+\(.*\)\s*(?:->\s*[^:]+)?:\s*$/m, /^\s*from\s+[\w.]+\s+import\b/m, /\bself\./, /^\s*(?:elif|except)\b/m, /\bprint\(/]],
  ['go', [/^package\s+\w+/m, /\bfunc\s+(?:\(\w+\s+\*?\w+\)\s*)?\w+\(/, /:=/, /\bfmt\.\w+/]],
  ['rust', [/\bfn\s+\w+/, /\blet\s+mut\b/, /\bimpl\b/, /\w+!\(/, /->\s*Result</]],
  ['swift', [/\bfunc\s+\w+\(/, /\bguard\s+let\b/, /^\s*import\s+(?:UIKit|SwiftUI|Foundation)\b/m, /\bif\s+let\b/]],
  ['csharp', [/^\s*using\s+System/m, /\bnamespace\s+[\w.]+/, /Console\.Write/, /\bpublic\s+async\s+Task\b/]],
  ['sql', [/\bSELECT\b[\s\S]+\bFROM\b/i, /\b(?:INSERT\s+INTO|CREATE\s+TABLE|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i]],
  ['bash', [/^#!.*\b(?:ba|z)?sh\b/m, /^\s*(?:sudo|npm|npx|git|cd|echo|export|apt|brew)\s/m]],
  ['xml', [/^\s*<(?:!DOCTYPE|\?xml|[a-zA-Z][\w-]*)[\s>]/, /<\/[a-zA-Z][\w-]*>/]],
  ['cpp', [/^\s*#include\s*</m, /\bstd::/, /\btemplate\s*</]],
]
const SIGNATURE_BONUS = 10

/** CSS, Less and SCSS are only candidates when the text actually contains rule blocks. */
const CSS_FAMILY = new Set(['css', 'less', 'scss'])
const CSS_RULE = /(?:^|[}\n])\s*[.#:@a-z*[][^{};()=]*\{\s*(?:[-\w]+\s*:\s*[^;{}()]+;\s*)+\}?/i

function scoreLanguages(code: string): string | null {
  const bonus = new Map<string, number>()
  for (const [lang, patterns] of SIGNATURES) {
    const hits = patterns.filter((re) => re.test(code)).length
    if (hits) bonus.set(lang, hits * SIGNATURE_BONUS)
  }
  const cssLike = CSS_RULE.test(code)
  if (cssLike) bonus.set('css', (bonus.get('css') ?? 0) + 5)
  let best: string | null = null
  let bestScore = 0
  for (const lang of base.listLanguages()) {
    if (HIDDEN.has(lang) || lang === 'plaintext' || lang === 'mermaid') continue
    if (CSS_FAMILY.has(lang) && !cssLike) continue
    const total = (base.highlight(lang, code).data?.relevance ?? 0) + (bonus.get(lang) ?? 0)
    if (total > bestScore) {
      best = lang
      bestScore = total
    }
  }
  return bestScore >= 3 ? best : null
}

/** Language guessed for a block with no language set (null when nothing fits well). */
export function detectLanguage(code: string): string | null {
  const trimmed = code.trim()
  if (!trimmed) return null
  const sample = code.length > AUTO_SAMPLE ? code.slice(0, AUTO_SAMPLE) : code
  return detectCache(sample, () => {
    // Mermaid: the diagram type comes first, after optional %% comments / %%{init}%% / front matter.
    const header = trimmed.replace(/^(?:---[\s\S]*?---\s*)?(?:%%.*(?:\n|$)\s*)*/, '')
    if (MERMAID_START.test(header)) return 'mermaid'
    if (/^[[{]/.test(trimmed) && code.length <= AUTO_SAMPLE) {
      try {
        JSON.parse(trimmed)
        return 'json'
      } catch {
        /* not JSON */
      }
    }
    return scoreLanguages(sample)
  })
}

/** Lowlight-compatible object for CodeBlockLowlight, with caching and better auto-detection. */
export const lowlight = {
  ...base,
  highlight: (language: string, value: string) => highlightCache(`${language}\u0000${value}`, () => base.highlight(language, value)),
  highlightAuto: (value: string) => lowlight.highlight(detectLanguage(value) ?? 'plaintext', value),
}

/** File extension → language, so a code block titled "Foo.kt" is highlighted as Kotlin. */
const EXTENSIONS: Record<string, string> = {
  aidl: 'aidl', c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', cs: 'csharp', css: 'css', diff: 'diff', patch: 'diff',
  go: 'go', graphql: 'graphql', gql: 'graphql', ini: 'ini', toml: 'ini', properties: 'ini', java: 'java', js: 'javascript', mjs: 'javascript',
  cjs: 'javascript', jsx: 'javascript', json: 'json', kt: 'kotlin', kts: 'kotlin', gradle: 'kotlin', less: 'less', lua: 'lua',
  mk: 'makefile', md: 'markdown', mmd: 'mermaid', m: 'objectivec', mm: 'objectivec', pl: 'perl', php: 'php', txt: 'plaintext',
  py: 'python', r: 'r', rb: 'ruby', rs: 'rust', scss: 'scss', sh: 'bash', bash: 'bash', zsh: 'bash', sql: 'sql', swift: 'swift',
  ts: 'typescript', tsx: 'typescript', vb: 'vbnet', wat: 'wasm', html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml', yml: 'yaml', yaml: 'yaml',
}

/** Language for a file name or path (by extension, or Makefile/Dockerfile-like names), or null. */
export function languageFromFileName(name: string | null | undefined): string | null {
  const base = String(name ?? '').trim().split(/[\\/]/).pop() ?? ''
  if (!base) return null
  if (/^makefile$/i.test(base)) return 'makefile'
  const ext = /\.([a-z0-9]+)$/i.exec(base)?.[1]?.toLowerCase()
  const lang = ext ? EXTENSIONS[ext] : undefined
  return lang && base_has(lang) ? lang : null
}

function base_has(lang: string) {
  return base.registered(lang)
}

/**
 * Uncached highlighter for the editor's code blocks: highlightPlugin already remembers results
 * per block, so going through the text-keyed cache would only keep a second copy.
 */
export const editorHighlighter = {
  highlight: (language: string, value: string) => base.highlight(language, value),
  highlightAuto: (value: string) => base.highlight(detectLanguage(value) ?? 'plaintext', value),
  registered: (language: string) => base.registered(language),
}
