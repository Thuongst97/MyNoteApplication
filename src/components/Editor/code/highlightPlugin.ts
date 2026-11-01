import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * Syntax highlighting for code blocks (replaces CodeBlockLowlight's plugin, which re-highlights
 * every code block on the page on each keystroke typed in any of them).
 *
 * - Results are remembered per code block *node* (WeakMap): unchanged blocks are never
 *   highlighted again, and memory is freed together with old versions of a block.
 * - Small blocks are re-highlighted right away as you type. Large blocks keep their current
 *   colors (moved along with the edit) and are re-highlighted once typing pauses.
 */

type HastNode = { type: string; value?: string; properties?: { className?: string[] }; children?: HastNode[] }
type Token = [from: number, to: number, cls: string]

export interface Highlighter {
  highlight: (language: string, code: string) => { children: unknown[] }
  highlightAuto: (code: string) => { children: unknown[] }
  registered: (language: string) => boolean
}

/** Blocks up to this many characters are re-highlighted on every keystroke. */
export const SYNC_LIMIT = 3000
/** Pause after typing before a large block is re-highlighted. */
export const IDLE_MS = 150

const key = new PluginKey<HighlightState>('codeHighlight')

interface HighlightState {
  decorations: DecorationSet
  /** Large blocks waiting to be re-highlighted (their colors are the old ones, moved). */
  stale: boolean
}

function tokensOf(tree: { children: unknown[] }): Token[] {
  const out: Token[] = []
  let pos = 0
  const walk = (nodes: HastNode[], classes: string[]) => {
    for (const n of nodes) {
      if (n.type === 'text') {
        const len = n.value?.length ?? 0
        if (classes.length && len) out.push([pos, pos + len, classes.join(' ')])
        pos += len
      } else if (n.children) walk(n.children, n.properties?.className ? [...classes, ...n.properties.className] : classes)
    }
  }
  walk(tree.children as HastNode[], [])
  return out
}

export function codeHighlightPlugin(opts: { name: string; highlighter: Highlighter }) {
  const cache = new WeakMap<PMNode, Token[]>()

  const tokensFor = (node: PMNode): Token[] => {
    let t = cache.get(node)
    if (!t) {
      const code = node.textContent
      const language: string | null = node.attrs.language || null
      const tree = language && opts.highlighter.registered(language) ? opts.highlighter.highlight(language, code) : opts.highlighter.highlightAuto(code)
      t = tokensOf(tree)
      cache.set(node, t)
    }
    return t
  }

  /** Decorations for every code block, highlighting any that aren't cached yet. */
  const build = (doc: PMNode, _previous: null): HighlightState => {
    const decos: Decoration[] = []
    doc.descendants((node, pos) => {
      if (node.type.name !== opts.name) return true
      const start = pos + 1
      for (const [from, to, cls] of tokensFor(node)) decos.push(Decoration.inline(start + from, start + to, { class: cls }))
      return false
    })
    return { decorations: DecorationSet.create(doc, decos), stale: false }
  }

  /**
   * After an edit: the old colors moved along with the text, then only code blocks that
   * changed (new node objects) get new colors — small ones right away, large ones after a
   * pause (until then they keep their moved colors). Untouched blocks cost nothing.
   */
  const update = (doc: PMNode, mapped: DecorationSet): HighlightState => {
    let set = mapped
    let stale = false
    doc.descendants((node, pos) => {
      if (node.type.name !== opts.name) return true
      const start = pos + 1
      const end = start + node.content.size
      const known = cache.has(node)
      const current = set.find(start, end)
      if (known && (current.length || !node.textContent.trim())) return false // unchanged, colors in place
      if (!known && node.textContent.length > SYNC_LIMIT && current.length) {
        stale = true // large block being edited: keep the moved colors for now
        return false
      }
      const fresh = tokensFor(node).map(([from, to, cls]) => Decoration.inline(start + from, start + to, { class: cls }))
      set = set.remove(current).add(doc, fresh)
      return false
    })
    return { decorations: set, stale }
  }

  let timer: ReturnType<typeof setTimeout> | null = null

  return new Plugin<HighlightState>({
    key,
    state: {
      init: (_, { doc }) => build(doc, null),
      apply(tr, value) {
        if (tr.getMeta(key) === 'refresh') return build(tr.doc, null)
        if (!tr.docChanged) return value
        const next = update(tr.doc, value.decorations.map(tr.mapping, tr.doc))
        // A block that was waiting stays waiting until the refresh.
        return { ...next, stale: next.stale || value.stale }
      },
    },
    props: {
      decorations: (state) => key.getState(state)?.decorations,
    },
    view: () => ({
      update(view) {
        if (!key.getState(view.state)?.stale) return
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          timer = null
          if (!view.isDestroyed && key.getState(view.state)?.stale) view.dispatch(view.state.tr.setMeta(key, 'refresh').setMeta('addToHistory', false))
        }, IDLE_MS)
      },
      destroy() {
        if (timer) clearTimeout(timer)
        timer = null
      },
    }),
  })
}
