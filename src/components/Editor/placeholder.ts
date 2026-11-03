import { Extension, type Editor } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

export interface PlaceholderOptions {
  /** Text for an empty text block ('' = none). */
  placeholder: (props: { editor: Editor; node: PMNode; pos: number; hasAnchor: boolean }) => string
  /** Every empty text block gets its prompt (slides); otherwise only the one with the cursor. */
  everywhere: boolean
}

const isEmpty = (n: PMNode) => n.isTextblock && n.content.size === 0

/**
 * Prompts in empty blocks ("Write something, or press '/'…"). Recomputed from the current
 * state on every update — the stock extension updates them incrementally and could leave
 * stale prompts on lines the cursor had left.
 */
export const PlaceholderLite = Extension.create<PlaceholderOptions>({
  name: 'placeholder',
  addOptions() {
    return { placeholder: () => '', everywhere: false }
  },
  addProseMirrorPlugins() {
    const editor = this.editor
    const options = this.options
    const deco = (node: PMNode, pos: number, hasAnchor: boolean, docEmpty: boolean) => {
      const text = options.placeholder({ editor, node, pos, hasAnchor })
      return Decoration.node(pos, pos + node.nodeSize, {
        class: docEmpty ? 'is-empty is-editor-empty' : 'is-empty',
        'data-placeholder': text,
      })
    }
    return [
      new Plugin({
        key: new PluginKey('placeholderLite'),
        props: {
          decorations: (state) => {
            if (!editor.isEditable) return null
            const doc = state.doc
            const docEmpty = doc.childCount === 1 && !!doc.firstChild && isEmpty(doc.firstChild)
            const { $anchor } = state.selection
            const out: Decoration[] = []
            if (options.everywhere) {
              doc.descendants((node, pos) => {
                if (!node.isTextblock) return true
                if (isEmpty(node)) out.push(deco(node, pos, $anchor.pos >= pos && $anchor.pos <= pos + node.nodeSize, docEmpty))
                return false
              })
            } else {
              // Only the empty text block holding the cursor (at any depth: callouts, columns…).
              const parent = $anchor.parent
              if (isEmpty(parent) && $anchor.depth > 0) out.push(deco(parent, $anchor.before(), true, docEmpty))
              else if (docEmpty) out.push(deco(doc.firstChild!, 0, false, true))
            }
            return out.length ? DecorationSet.create(doc, out) : null
          },
        },
      }),
    ]
  },
})
