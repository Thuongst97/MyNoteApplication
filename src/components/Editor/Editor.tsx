import { useEffect, useRef } from 'react'
import { EditorContent, useEditor, type JSONContent, type Editor as TiptapEditor } from '@tiptap/react'
import type { EditorView } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Image from '@tiptap/extension-image'
import { imageFilesFrom, insertImageFiles } from '@/lib/images'
import { SlashCommand } from './SlashCommand'
import { ImageSelection } from './ImageSelection'
import { MermaidNode } from './mermaid/MermaidNode'
import { MERMAID_START } from './mermaid/renderMermaid'

interface EditorProps {
  initialContent: JSONContent | null
  onChange: (content: JSONContent) => void
  /** Receives the editor instance once created (e.g. so the title can move focus into it). */
  onReady?: (editor: TiptapEditor) => void
  /** Called when the user presses ArrowUp / Backspace at the very start of the document. */
  onExitTop?: () => void
}

/** TipTap block canvas. Mount one instance per page (keyed by page id). */
export function Editor({ initialContent, onChange, onReady, onExitTop }: EditorProps) {
  const onChangeRef = useRef(onChange)
  const onExitTopRef = useRef(onExitTop)
  onChangeRef.current = onChange
  onExitTopRef.current = onExitTop

  const editorRef = useRef<TiptapEditor | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Placeholder.configure({
        includeChildren: false,
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') return `Heading ${node.attrs.level}`
          if (node.type.name === 'codeBlock') return ''
          return "Write something, or press '/' for commands…"
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({
        inline: false,
        allowBase64: true,
        resize: {
          enabled: true,
          directions: ['left', 'right', 'bottom-left', 'bottom-right'],
          minWidth: 60,
          minHeight: 40,
          alwaysPreserveAspectRatio: true,
        },
      }),
      ImageSelection,
      MermaidNode,
      SlashCommand,
    ],
    content: initialContent ?? '',
    editorProps: {
      attributes: {
        class: 'notion-editor focus:outline-none',
        spellcheck: 'true',
      },
      // Pasted image files (screenshots, copied images) are stored and inserted as image blocks.
      handlePaste: (view, event) => {
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

        const files = imageFilesFrom(event.clipboardData)
        if (files.length === 0 || !editorRef.current) return false
        event.preventDefault()
        void insertImageFiles(editorRef.current, files)
        return true
      },
      // Image files dragged in from the desktop are inserted where they are dropped.
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false
        const files = imageFilesFrom(event.dataTransfer)
        if (files.length === 0 || !editorRef.current) return false
        event.preventDefault()
        void insertImageFiles(editorRef.current, files, dropPosition(view, event))
        return true
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

  useEffect(() => {
    if (editor) onReady?.(editor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  return (
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
