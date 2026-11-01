import { common, createLowlight } from 'lowlight'
import { mermaidGrammar } from './mermaidGrammar'
import { MERMAID_START } from '../mermaid/renderMermaid'

/** Shared highlighter with the ~35 most common languages (kotlin, ts, python, go, sql…) plus Mermaid. */
const base = createLowlight(common)
base.register('mermaid', mermaidGrammar)

type Root = ReturnType<typeof base.highlight>

/** Human-friendly names for the language picker. Anything missing falls back to the id. */
const LABELS: Record<string, string> = {
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

/** Small LRU cache: highlighting re-runs for every code block whenever any code block changes. */
const CACHE_LIMIT = 300
function lru<V>() {
  const map = new Map<string, V>()
  return (key: string, compute: () => V): V => {
    if (map.has(key)) {
      const hit = map.get(key)!
      map.delete(key)
      map.set(key, hit)
      return hit
    }
    const value = compute()
    map.set(key, value)
    if (map.size > CACHE_LIMIT) map.delete(map.keys().next().value!)
    return value
  }
}
const highlightCache = lru<Root>()
const detectCache = lru<string | null>()

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
