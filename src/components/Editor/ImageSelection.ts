import { Extension } from '@tiptap/react'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * Makes image blocks behave like Notion's:
 * - a single click always selects the image (even when the editor wasn't focused yet),
 *   so Delete/Backspace removes it;
 * - the selected image gets an `is-selected` class for a visible outline
 *   (the resizable image view doesn't add ProseMirror's own selected class).
 */
export const ImageSelection = Extension.create({
  name: 'imageSelection',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('imageSelection'),
        props: {
          handleClickOn(view, _pos, node, nodePos, event, direct) {
            if (!direct || node.type.name !== 'image') return false
            // Clicks on the resize handles are handled by the resize logic.
            if ((event.target as HTMLElement | null)?.closest('[data-resize-handle]')) return false
            view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)))
            view.focus()
            return true
          },
          decorations(state) {
            const sel = state.selection
            if (!(sel instanceof NodeSelection) || sel.node.type.name !== 'image') return null
            return DecorationSet.create(state.doc, [
              Decoration.node(sel.from, sel.to, { class: 'is-selected' }),
            ])
          },
        },
      }),
    ]
  },
})
