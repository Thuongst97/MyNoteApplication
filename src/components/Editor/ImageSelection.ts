import { Extension } from '@tiptap/react'
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import { api } from '@/lib/api'

/**
 * Makes image blocks behave like Notion's:
 * - a single click always selects the image (even when the editor wasn't focused yet),
 *   so Delete/Backspace removes it;
 * - the selected image gets an `is-selected` class for a visible outline
 *   (the resizable image view doesn't add ProseMirror's own selected class).
 */
export const ImageSelection = Extension.create({
  name: 'imageSelection',
  // Before HardBreak's Mod-Enter / Shift-Enter.
  priority: 1000,

  addKeyboardShortcuts() {
    // Mod-Enter / Shift-Enter insert a line break, which would *replace* a selected
    // diagram, chart, drawing… Start a new line after the block instead.
    const newLineAfterBlock = () => {
      const { state, view } = this.editor
      const sel = state.selection
      if (!(sel instanceof NodeSelection) || !sel.node.isAtom || !sel.node.isBlock) return false
      const tr = state.tr.insert(sel.to, state.schema.nodes.paragraph.create())
      tr.setSelection(TextSelection.create(tr.doc, sel.to + 1)).scrollIntoView()
      view.dispatch(tr)
      return true
    }
    return { 'Mod-Enter': newLineAfterBlock, 'Shift-Enter': newLineAfterBlock }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('imageSelection'),
        props: {
          handleDOMEvents: {
            // Clicks inside a block's own editing panel (chart editor, Mermaid/Markdown source,
            // toolbars) belong to that panel. Without this, clicking the icon or label inside a
            // button selects the whole block and moves focus to the page, so the panel's
            // shortcuts (Ctrl+Enter to save) would act on the page instead.
            mousedown(view, event) {
              const t = event.target as HTMLElement | null
              // .selectable-text: rendered read-only content (e.g. a Markdown block) whose text
              // the user selects with the mouse — the editor must not turn that into a block selection.
              return !!t?.closest?.('.no-drag, .selectable-text') && view.dom.contains(t)
            },
            // Copying a text selection made inside read-only rendered content copies that text
            // (the browser's default), not the editor's idea of the selection (the whole block).
            cut(view) {
              if (selectionHasImage(view)) embedImagesAfterCopy()
              return false
            },
            copy(view) {
              if (selectionHasImage(view)) embedImagesAfterCopy()
              const sel = window.getSelection()
              const node = sel && !sel.isCollapsed ? sel.anchorNode : null
              let el = node ? (node instanceof Element ? node : node.parentElement) : null
              // Text inside an HTML block lives in a shadow root: look from its host.
              const root = el?.getRootNode()
              if (root instanceof ShadowRoot) el = root.host
              return !!el?.closest('.selectable-text') && view.dom.contains(el)
            },
          },
          handleClickOn(view, _pos, node, nodePos, event, direct) {
            if (!direct || node.type.name !== 'image') return false
            // Clicks on the resize handles are handled by the resize logic.
            if ((event.target as HTMLElement | null)?.closest('[data-resize-handle]')) return false
            view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)))
            view.focus()
            return true
          },
          // Typing while an image/diagram/divider is selected starts a new line after it
          // instead of replacing the block (like Notion).
          handleTextInput(view, _from, _to, text) {
            const sel = view.state.selection
            if (!(sel instanceof NodeSelection) || !sel.node.isAtom || !sel.node.isBlock) return false
            const { schema } = view.state
            const tr = view.state.tr.insert(sel.to, schema.nodes.paragraph.create(null, schema.text(text)))
            tr.setSelection(TextSelection.create(tr.doc, sel.to + 1 + text.length)).scrollIntoView()
            view.dispatch(tr)
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

/** Whether the editor's selection includes a stored image. */
function selectionHasImage(view: EditorView): boolean {
  const { from, to } = view.state.selection
  let found = false
  view.state.doc.nodesBetween(from, to, (n) => {
    if (n.type.name === 'image' && String(n.attrs.src ?? '').startsWith('notion-asset://')) found = true
    return !found
  })
  return found
}

/**
 * Copied images point at notion-asset:// files that other apps can't open: once the editor has
 * written the clipboard, embed them (and put a single image on the clipboard as a picture), so
 * they paste into Jira, Confluence, mail…
 */
function embedImagesAfterCopy() {
  setTimeout(() => void api.clipboard.inlineImages().catch(() => {}), 0)
}
