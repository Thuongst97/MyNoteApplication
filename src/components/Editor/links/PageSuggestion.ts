import { Extension, ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { useAppStore } from '@/stores/useAppStore'
import { PageSuggestMenu, type PageSuggestItem, type PageSuggestMenuHandle, type PageSuggestMenuProps } from './PageSuggestMenu'

function pageItems(query: string): PageSuggestItem[] {
  const { pages, activePageId } = useAppStore.getState()
  const q = query.replace(/\]+$/, '').trim().toLowerCase()
  const byId = new Map(pages.map((p) => [p.id, p]))
  const pathOf = (id: string | null) => {
    const names: string[] = []
    let cur = id ? byId.get(id) : undefined
    while (cur) {
      names.unshift(cur.title || 'Untitled')
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return names.join(' / ')
  }
  const matches = pages
    .filter((p) => p.id !== activePageId && (!q || (p.title || 'untitled').toLowerCase().includes(q)))
    .sort((a, b) => {
      const at = (a.title || '').toLowerCase().startsWith(q) ? 0 : 1
      const bt = (b.title || '').toLowerCase().startsWith(q) ? 0 : 1
      return at - bt || b.updatedAt - a.updatedAt
    })
    .slice(0, 8)
    .map((page) => ({ kind: 'page' as const, page, path: pathOf(page.parentId) }))
  const exact = pages.some((p) => (p.title || '').toLowerCase() === q)
  return q && !exact ? [...matches, { kind: 'create', title: query.replace(/\]+$/, '').trim() }] : matches
}

function makeSuggestion(char: string, key: string, allowSpaces: boolean) {
  return {
    char,
    pluginKey: new PluginKey(key),
    allowSpaces,
    allowedPrefixes: char === '@' ? [' '] : null,
    placement: 'bottom-start' as const,
    offset: { mainAxis: 6 },
    allow: ({ state, range }: { state: import('@tiptap/pm/state').EditorState; range: { from: number } }) =>
      state.doc.resolve(range.from).parent.type.name !== 'codeBlock',
    items: ({ query }: { query: string }) => pageItems(query),
    shouldShow: ({ query }: { query: string }) => !(allowSpaces && query.length > 60),
    command: ({ editor, range, props }: { editor: import('@tiptap/react').Editor; range: { from: number; to: number }; props: PageSuggestItem }) => {
      const insert = (pageId: string) =>
        editor
          .chain()
          .focus()
          .insertContentAt(range, [{ type: 'mention', attrs: { pageId } }, { type: 'text', text: ' ' }])
          .run()
      if (props.kind === 'page') insert(props.page.id)
      else {
        // Create the page (as a sub-page of this one) without leaving the current page.
        const parent = useAppStore.getState().activePageId
        void useAppStore
          .getState()
          .createPage(parent, { title: props.title, navigate: false })
          .then((id) => insert(id))
      }
    },
    render: () => {
      let renderer: ReactRenderer<PageSuggestMenuHandle, PageSuggestMenuProps> | null = null
      let unmount: (() => void) | null = null
      return {
        onStart: (props: { items: PageSuggestItem[]; command: (i: PageSuggestItem) => void; editor: import('@tiptap/react').Editor; mount: (el: HTMLElement) => () => void }) => {
          renderer = new ReactRenderer(PageSuggestMenu, { props: { items: props.items, command: props.command }, editor: props.editor })
          const el = renderer.element as HTMLElement
          el.style.zIndex = '60'
          unmount = props.mount(el)
        },
        onUpdate: (props: { items: PageSuggestItem[]; command: (i: PageSuggestItem) => void }) =>
          renderer?.updateProps({ items: props.items, command: props.command }),
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
          if (event.key === 'Escape') {
            unmount?.()
            unmount = null
            return false
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
  }
}

/** `[[` (anywhere) and `@` (after a space) open a page picker that inserts a page link. */
export const PageSuggestion = Extension.create({
  name: 'pageSuggestion',
  addProseMirrorPlugins() {
    return [
      Suggestion({ editor: this.editor, ...makeSuggestion('[[', 'pageSuggestBrackets', true) } as never),
      Suggestion({ editor: this.editor, ...makeSuggestion('@', 'pageSuggestAt', false) } as never),
    ]
  },
})
