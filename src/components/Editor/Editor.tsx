import { useEffect, useRef } from 'react'
import { EditorContent, useEditor, type JSONContent, type Editor as TiptapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { SlashCommand } from './SlashCommand'

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
      SlashCommand,
    ],
    content: initialContent ?? '',
    editorProps: {
      attributes: {
        class: 'notion-editor focus:outline-none',
        spellcheck: 'true',
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
