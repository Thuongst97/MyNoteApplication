import { Extension, type Editor } from '@tiptap/core'

export type TextAlignValue = 'left' | 'center' | 'right' | 'justify'
export const TEXT_ALIGNS: TextAlignValue[] = ['left', 'center', 'right', 'justify']
const TYPES = ['paragraph', 'heading']

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textAlign: {
      /** Align the paragraphs/headings in the selection ('left' clears the setting). */
      setTextAlign: (align: TextAlignValue) => ReturnType
      unsetTextAlign: () => ReturnType
    }
  }
}

/** Left / center / right / justify for paragraphs and headings (stored as `textAlign`). */
export const TextAlign = Extension.create({
  name: 'textAlign',
  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (el) => {
              const v = (el as HTMLElement).style.textAlign
              return TEXT_ALIGNS.includes(v as TextAlignValue) && v !== 'left' ? v : null
            },
            renderHTML: (attrs) => (attrs.textAlign ? { style: `text-align: ${attrs.textAlign}` } : {}),
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setTextAlign:
        (align) =>
        ({ commands }) => {
          if (!TEXT_ALIGNS.includes(align)) return false
          const value = align === 'left' ? null : align
          return TYPES.map((t) => commands.updateAttributes(t, { textAlign: value })).some(Boolean)
        },
      unsetTextAlign:
        () =>
        ({ commands }) =>
          TYPES.map((t) => commands.resetAttributes(t, 'textAlign')).some(Boolean),
    }
  },
  addKeyboardShortcuts() {
    // Pressing the shortcut of the current alignment goes back to left (Ctrl+Shift+L is the
    // app's light/dark switch, so left has no shortcut of its own).
    const toggle = (align: TextAlignValue) => () => this.editor.commands.setTextAlign(currentTextAlign(this.editor) === align ? 'left' : align)
    return {
      'Mod-Shift-e': toggle('center'),
      'Mod-Shift-r': toggle('right'),
      'Mod-Shift-j': toggle('justify'),
    }
  },
})

/** Alignment of the block with the cursor. */
export function currentTextAlign(editor: Editor): TextAlignValue {
  const { $from } = editor.state.selection
  for (let d = $from.depth; d >= 0; d--) {
    const n = $from.node(d)
    if (TYPES.includes(n.type.name)) return (n.attrs.textAlign as TextAlignValue | null) ?? 'left'
  }
  return 'left'
}
