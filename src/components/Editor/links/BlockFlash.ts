import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const key = new PluginKey<string | null>('blockFlash')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockFlash: {
      /** Scrolls to the block with this id and highlights it briefly. Fails if it doesn't exist. */
      flashBlock: (blockId: string) => ReturnType
    }
  }
}

/** Highlight for blocks reached through a block reference (a decoration, so re-renders keep it). */
export const BlockFlash = Extension.create({
  name: 'blockFlash',

  addCommands() {
    return {
      flashBlock:
        (blockId) =>
        ({ state, dispatch, view }) => {
          let pos = -1
          state.doc.descendants((node, p) => {
            if (pos >= 0) return false
            if (node.attrs.blockId === blockId) pos = p
            return true
          })
          if (pos < 0) return false
          if (dispatch) {
            dispatch(state.tr.setMeta(key, blockId))
            requestAnimationFrame(() => {
              // The editor may be gone by the next frame (e.g. the user switched pages).
              if (view.isDestroyed) return
              ;(view.nodeDOM(pos) as HTMLElement | null)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
            })
            setTimeout(() => {
              if (!view.isDestroyed && key.getState(view.state) === blockId) view.dispatch(view.state.tr.setMeta(key, null))
            }, 2400)
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<string | null>({
        key,
        state: {
          init: () => null,
          apply: (tr, value) => {
            const meta = tr.getMeta(key)
            return meta === undefined ? value : meta
          },
        },
        props: {
          decorations(state) {
            const id = key.getState(state)
            if (!id) return null
            const decos: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (node.attrs.blockId === id) decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'block-flash' }))
            })
            return DecorationSet.create(state.doc, decos)
          },
        },
      }),
    ]
  },
})
