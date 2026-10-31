import { Extension, ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { SlashMenu, type SlashMenuHandle, type SlashMenuProps } from './SlashMenu'
import { filterSlashCommands, type SlashCommandItem } from './slashCommands'

export const SlashCommandPluginKey = new PluginKey('slashCommand')

/**
 * Opens the block menu when `/` is typed at the start of a line or after a space.
 */
export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem, SlashCommandItem>({
        editor: this.editor,
        pluginKey: SlashCommandPluginKey,
        char: '/',
        // Allow multi-word queries like "/heading 2" or "/to-do list".
        allowSpaces: true,
        startOfLine: false,
        placement: 'bottom-start',
        offset: { mainAxis: 6 },
        flip: true,
        // Don't trigger inside code blocks.
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from)
          return $from.parent.type.name !== 'codeBlock'
        },
        items: ({ query }) => filterSlashCommands(query),
        // Once a multi-word query matches nothing, the user is just writing prose: close the menu.
        shouldShow: ({ query }) => !(/\s/.test(query) && filterSlashCommands(query).length === 0),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let renderer: ReactRenderer<SlashMenuHandle, SlashMenuProps> | null = null
          let unmount: (() => void) | null = null

          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashMenu, {
                props: { items: props.items, command: props.command },
                editor: props.editor,
              })
              const el = renderer.element as HTMLElement
              el.style.zIndex = '60'
              unmount = props.mount(el)
            },
            onUpdate: (props) => {
              renderer?.updateProps({ items: props.items, command: props.command })
            },
            onKeyDown: ({ event }) => {
              if (event.key === 'Escape') {
                unmount?.()
                unmount = null
                return false // let the plugin dismiss the suggestion
              }
              return renderer?.ref?.onKeyDown(event) ?? false
            },
            onExit: () => {
              unmount?.()
              unmount = null
              renderer?.destroy()
              renderer = null
            },
          }
        },
      }),
    ]
  },
})
