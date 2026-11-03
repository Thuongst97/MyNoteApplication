import { useEffect, useRef } from 'react'
import { EditorContent, useEditor, type JSONContent, type Editor as TiptapEditor } from '@tiptap/react'
import type { EditorView } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { FormattingToolbar } from './FormattingToolbar'
import { createEditorExtensions, type EditorExtensionOptions } from './extensions'
import { TableToolbar } from './TableToolbar'
import { imageFilesFrom, insertImageFiles } from '@/lib/images'
import { looksLikeMarkdown, markdownToHtml } from '@/lib/markdown'
import { blockSnippet } from './links/BlockIds'
import { parsePageUrl } from '@/lib/links'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/useAppStore'
import { MERMAID_START } from './mermaid/renderMermaid'
import { blockDrag, computeBlockDrop, performBlockDrop } from './blockMove'
import { BlockHandle } from './BlockHandle'

interface EditorProps {
  /** The page being edited (used for "Copy link to block"). */
  pageId: string
  initialContent: JSONContent | null
  onChange: (content: JSONContent) => void
  /** Receives the editor instance once created (e.g. so the title can move focus into it). */
  onReady?: (editor: TiptapEditor) => void
  /** Called when the user presses ArrowUp / Backspace at the very start of the document. */
  onExitTop?: () => void
  /**
   * 'slide': the editor of a presentation slide — no page gutter, block handle or bottom
   * padding, with slide placeholders.
   */
  variant?: 'page' | 'slide'
}

/** PowerPoint-like prompts in a near-empty slide; elsewhere only on the line with the cursor. */
const slidePlaceholder: EditorExtensionOptions['placeholder'] = (node, { hasAnchor, doc }) => {
  if (node.type.name === 'heading') return Number(node.attrs.level) <= 2 ? 'Click to add title' : `Heading ${node.attrs.level}`
  if (node.type.name !== 'paragraph') return null
  // "Click to add text" on the first body line while the slide has no body text yet.
  let first: PMNode | null = null
  let bodyEmpty = true
  doc.forEach((b) => {
    if (b.type.name === 'heading') return
    if (b.textContent.trim() || !['paragraph', 'bulletList', 'orderedList', 'taskList'].includes(b.type.name)) bodyEmpty = false
    if (!first) first = b.type.name === 'paragraph' ? b : (b.firstChild?.firstChild ?? null)
  })
  if (bodyEmpty && first === node) return 'Click to add text'
  return hasAnchor ? "Type '/' for blocks" : ''
}

/** TipTap block canvas. Mount one instance per page (keyed by page id). */
export function Editor({ pageId, initialContent, onChange, onReady, onExitTop, variant = 'page' }: EditorProps) {
  const onChangeRef = useRef(onChange)
  const onExitTopRef = useRef(onExitTop)
  onChangeRef.current = onChange
  onExitTopRef.current = onExitTop

  const editorRef = useRef<TiptapEditor | null>(null)

  const editor = useEditor({
    extensions: createEditorExtensions(variant === 'slide' ? { placeholder: slidePlaceholder, placeholderEverywhere: true } : {}),
    content: initialContent ?? '',
    editorProps: {
      // Read on every view update, so turning spell check off applies right away.
      attributes: () => ({
        class: 'notion-editor focus:outline-none',
        spellcheck: String(useAppStore.getState().spellcheck),
      }),
      // Pasted image files (screenshots, copied images) are stored and inserted as image blocks.
      handlePaste: (view, event) => {
        // A copied page/block link (notionclone://page/…) becomes a page link / block reference.
        const pasted = (event.clipboardData?.getData('text/plain') ?? '').trim()
        const ref = parsePageUrl(pasted)
        if (ref && editorRef.current) {
          event.preventDefault()
          void insertReference(editorRef.current, ref.pageId, ref.blockId)
          return true
        }
        // A pasted ```mermaid fenced block (or bare mermaid code on an empty line) becomes a diagram.
        const text = event.clipboardData?.getData('text/plain') ?? ''
        const fenced = text.trim().match(/^```mermaid[ \t]*\r?\n([\s\S]*?)\r?\n?```$/)
        const { $from, empty } = view.state.selection
        const onEmptyLine = empty && $from.parent.isTextblock && $from.parent.content.size === 0 && $from.parent.type.name === 'paragraph'
        const bare = onEmptyLine && MERMAID_START.test(text.trim()) && text.includes('\n') ? text.trim() : null
        const code = fenced?.[1] ?? bare
        if (code && editorRef.current) {
          event.preventDefault()
          editorRef.current.chain().focus().insertMermaid(code).run()
          return true
        }

        // Pasted Markdown (plain text, e.g. a README or text copied from VS Code) becomes real blocks:
        // headings, lists, task lists, tables, quotes, highlighted code and Mermaid docs.
        if (editorRef.current && shouldConvertMarkdown(event.clipboardData, view)) {
          event.preventDefault()
          editorRef.current.chain().focus().insertContent(markdownToHtml(text)).run()
          return true
        }

        const files = imageFilesFrom(event.clipboardData)
        if (files.length === 0 || !editorRef.current) return false
        event.preventDefault()
        void insertImageFiles(editorRef.current, files)
        return true
      },
      // Image files dragged in from the desktop are inserted where they are dropped.
      handleDrop: (view, event, _slice, moved) => {
        // Blocks dragged by their handle: place by top/bottom half of the block under the pointer.
        if (blockDrag.current) {
          const source = blockDrag.current
          blockDrag.current = null
          const drop = computeBlockDrop(view, source, event.clientX, event.clientY)
          if (drop) performBlockDrop(view, source, drop)
          event.preventDefault()
          return true
        }
        if (moved) return false
        const files = imageFilesFrom(event.dataTransfer)
        if (files.length === 0 || !editorRef.current) return false
        event.preventDefault()
        void insertImageFiles(editorRef.current, files, dropPosition(view, event))
        return true
      },
      // Internal links (notionclone://) navigate; web links open in the browser with Ctrl/⌘+click.
      handleClick: (view, pos, event) => {
        const $pos = view.state.doc.resolve(pos)
        const link = $pos.marks().find((m) => m.type.name === 'link') ?? view.state.doc.nodeAt(pos)?.marks.find((m) => m.type.name === 'link')
        const href = link?.attrs.href as string | undefined
        if (!href) return false
        const ref = parsePageUrl(href)
        if (ref) {
          useAppStore.getState().setActivePage(ref.pageId, { blockId: ref.blockId })
          return true
        }
        if ((event.metaKey || event.ctrlKey) && /^https?:/i.test(href)) {
          window.open(href, '_blank')
          return true
        }
        return false
      },
      handleKeyDown: (view, event) => {
        const { from, empty } = view.state.selection
        if (empty && from <= 1 && (event.key === 'ArrowUp' || (event.key === 'Backspace' && view.state.doc.textContent === ''))) {
          if (onExitTopRef.current) {
            onExitTopRef.current()
            return true
          }
        }
        return false
      },
    },
    onUpdate: ({ editor }) => onChangeRef.current(editor.getJSON()),
  })

  editorRef.current = editor

  // Spell check switched on/off: redraw the editor's attributes.
  const spellcheck = useAppStore((s) => s.spellcheck)
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.view.updateState(editor.view.state)
  }, [editor, spellcheck])

  useEffect(() => {
    if (editor) onReady?.(editor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  const containerRef = useRef<HTMLDivElement>(null)

  if (variant === 'slide') {
    return (
      <div ref={containerRef} className="relative">
        <EditorContent editor={editor} />
        {/* The slide is zoomed: menus live in <body> so they keep their normal size and place. */}
        {editor && editor.isEditable && <FormattingToolbar editor={editor} appendTo={document.body} />}
        {editor && editor.isEditable && <TableToolbar editor={editor} appendTo={document.body} />}
      </div>
    )
  }

  return (
    // Extends into the left gutter so the block handle stays reachable.
    <div ref={containerRef} className="relative -ml-16 pl-16">
      <div
        className="min-h-[50vh] cursor-text pb-[30vh]"
        onMouseDown={(e) => {
          // Clicking the empty area below the document focuses the end of it.
          if (e.target === e.currentTarget && editor) {
            e.preventDefault()
            editor.commands.focus('end')
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>
      {editor && editor.isEditable && <BlockHandle editor={editor} containerRef={containerRef} pageId={pageId} />}
      {editor && editor.isEditable && <FormattingToolbar editor={editor} />}
      {editor && editor.isEditable && <TableToolbar editor={editor} />}
    </div>
  )
}

/**
 * Where a dropped image goes: between top-level blocks (before the block under
 * the pointer if over its upper half, otherwise after it), never inside a line of text.
 */
function dropPosition(view: EditorView, event: DragEvent): number | undefined {
  const hit = view.posAtCoords({ left: event.clientX, top: event.clientY })
  if (!hit) return undefined
  const $pos = view.state.doc.resolve(hit.pos)
  if ($pos.depth === 0) return hit.pos
  const before = $pos.before(1)
  const dom = view.nodeDOM(before) as HTMLElement | null
  const rect = dom?.getBoundingClientRect?.()
  if (rect && event.clientY < rect.top + rect.height / 2) return before
  return $pos.after(1)
}

/** Inserts a link to a page, or to a block on a page (with a snapshot of the block's text). */
async function insertReference(editor: TiptapEditor, pageId: string, blockId: string | null) {
  const at = editor.state.selection.from
  let label = ''
  if (blockId) {
    const page = await api.readPage(pageId).catch(() => null)
    const find = (n: { attrs?: Record<string, unknown>; content?: unknown[] } | null | undefined): unknown => {
      if (!n) return null
      if (n.attrs?.blockId === blockId) return n
      for (const c of (n.content ?? []) as typeof n[]) {
        const hit = find(c)
        if (hit) return hit
      }
      return null
    }
    const node = find(page?.content as never)
    if (node) label = blockSnippet(editor.schema.nodeFromJSON(node), 50)
  }
  if (editor.isDestroyed) return
  editor
    .chain()
    .focus()
    .insertContentAt(Math.min(at, editor.state.doc.content.size), [
      { type: 'mention', attrs: { pageId, blockId, label } },
      { type: 'text', text: ' ' },
    ])
    .run()
}

/**
 * Plain-text Markdown is converted on paste. Rich HTML from web pages and other apps is
 * kept as is (it already has formatting), except VS Code's HTML, which is just colored text.
 * Inside code blocks text is always pasted literally.
 */
function shouldConvertMarkdown(data: DataTransfer | null, view: EditorView) {
  if (!data) return false
  const { $from } = view.state.selection
  if ($from.parent.type.spec.code) return false
  const text = data.getData('text/plain')
  if (!text || !looksLikeMarkdown(text)) return false
  const fromVsCode = data.types.includes('vscode-editor-data')
  const html = data.getData('text/html')
  return !html || fromVsCode
}
