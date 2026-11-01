import { useEffect, useRef, useState } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { NodeSelection } from '@tiptap/pm/state'
import {
  Bold,
  CheckSquare,
  ChevronDown,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Type,
  Underline,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Notion-style colors, stored as CSS variables so they adapt to dark/light mode. */
export const COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const
const label = (c: string) => c[0].toUpperCase() + c.slice(1)

export const FONT_SIZES: Array<{ label: string; value: string | null }> = [
  { label: 'Small', value: '13px' },
  { label: 'Default', value: null },
  { label: 'Medium', value: '19px' },
  { label: 'Large', value: '24px' },
  { label: 'Extra large', value: '32px' },
  { label: 'Huge', value: '44px' },
]

interface BlockType {
  label: string
  icon: LucideIcon
  isActive: (e: Editor) => boolean
  apply: (e: Editor) => void
}

const BLOCK_TYPES: BlockType[] = [
  { label: 'Text', icon: Type, isActive: (e) => e.isActive('paragraph') && !e.isActive('bulletList') && !e.isActive('orderedList') && !e.isActive('taskList') && !e.isActive('blockquote'), apply: (e) => e.chain().focus().clearNodes().setParagraph().run() },
  { label: 'Heading 1', icon: Heading1, isActive: (e) => e.isActive('heading', { level: 1 }), apply: (e) => e.chain().focus().clearNodes().setNode('heading', { level: 1 }).run() },
  { label: 'Heading 2', icon: Heading2, isActive: (e) => e.isActive('heading', { level: 2 }), apply: (e) => e.chain().focus().clearNodes().setNode('heading', { level: 2 }).run() },
  { label: 'Heading 3', icon: Heading3, isActive: (e) => e.isActive('heading', { level: 3 }), apply: (e) => e.chain().focus().clearNodes().setNode('heading', { level: 3 }).run() },
  { label: 'Bulleted list', icon: List, isActive: (e) => e.isActive('bulletList'), apply: (e) => e.chain().focus().clearNodes().toggleBulletList().run() },
  { label: 'Numbered list', icon: ListOrdered, isActive: (e) => e.isActive('orderedList'), apply: (e) => e.chain().focus().clearNodes().toggleOrderedList().run() },
  { label: 'To-do list', icon: CheckSquare, isActive: (e) => e.isActive('taskList'), apply: (e) => e.chain().focus().clearNodes().toggleTaskList().run() },
  { label: 'Quote', icon: Quote, isActive: (e) => e.isActive('blockquote'), apply: (e) => e.chain().focus().clearNodes().toggleBlockquote().run() },
  { label: 'Code', icon: Code2, isActive: (e) => e.isActive('codeBlock'), apply: (e) => e.chain().focus().clearNodes().toggleCodeBlock().run() },
]

type Menu = 'turn' | 'size' | 'color' | 'link' | null

/** Floating toolbar shown when text is selected. */
export function FormattingToolbar({ editor }: { editor: Editor }) {
  const [menu, setMenu] = useState<Menu>(null)
  const [href, setHref] = useState('')
  const linkRef = useRef<HTMLInputElement>(null)

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      linkHref: (e.getAttributes('link').href as string | undefined) ?? '',
      color: (e.getAttributes('textStyle').color as string | undefined) ?? null,
      background: (e.getAttributes('textStyle').backgroundColor as string | undefined) ?? null,
      fontSize: (e.getAttributes('textStyle').fontSize as string | undefined) ?? null,
      block: BLOCK_TYPES.find((b) => b.isActive(e))?.label ?? 'Text',
      selFrom: e.state.selection.from,
    }),
  })

  // Close sub-menus when the selection changes.
  useEffect(() => setMenu(null), [s.selFrom])
  useEffect(() => {
    if (menu === 'link') requestAnimationFrame(() => linkRef.current?.focus())
  }, [menu])

  const keep = (e: React.MouseEvent) => e.preventDefault() // keep the text selection
  const toggle = (m: Menu) => setMenu((cur) => (cur === m ? null : m))
  const sizeLabel = FONT_SIZES.find((f) => f.value === s.fontSize)?.label ?? s.fontSize ?? 'Default'

  const applyLink = () => {
    const url = href.trim()
    const chain = editor.chain().focus().extendMarkRange('link')
    if (!url) chain.unsetLink().run()
    else chain.setLink({ href: /^[a-z]+:/i.test(url) ? url : `https://${url}` }).run()
    setMenu(null)
  }

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top', offset: 8, flip: true, shift: { padding: 8 } }}
      shouldShow={({ editor: e, state }) => {
        const { selection } = state
        if (!e.isEditable || selection.empty || selection instanceof NodeSelection) return false
        if (e.isActive('codeBlock') || e.isActive('mermaid') || e.isActive('markdown')) return false
        return state.doc.textBetween(selection.from, selection.to, ' ').trim().length > 0
      }}
      className="no-drag z-50"
    >
      <div
        onMouseDown={(e) => {
          // Let inputs take focus, keep the editor selection for everything else.
          if (!(e.target instanceof HTMLInputElement)) keep(e)
        }}
        className="relative flex items-center gap-0.5 rounded-lg border border-black/10 bg-white p-1 text-sm shadow-xl dark:border-white/10 dark:bg-[#252525]"
      >
        {/* Turn into */}
        <div className="relative">
          <ToolButton wide onClick={() => toggle('turn')} active={menu === 'turn'} label="Turn into">
            {s.block} <ChevronDown size={13} className="opacity-50" />
          </ToolButton>
          {menu === 'turn' && (
            <Dropdown>
              <DropdownTitle>Turn into</DropdownTitle>
              {BLOCK_TYPES.map((b) => {
                const Icon = b.icon
                return (
                  <DropdownItem key={b.label} active={s.block === b.label} onClick={() => (b.apply(editor), setMenu(null))}>
                    <Icon size={15} className="opacity-70" /> {b.label}
                  </DropdownItem>
                )
              })}
            </Dropdown>
          )}
        </div>

        {/* Font size */}
        <div className="relative">
          <ToolButton wide onClick={() => toggle('size')} active={menu === 'size'} label="Text size">
            <span className="text-xs">Aa</span> {sizeLabel} <ChevronDown size={13} className="opacity-50" />
          </ToolButton>
          {menu === 'size' && (
            <Dropdown>
              <DropdownTitle>Text size</DropdownTitle>
              {FONT_SIZES.map((f) => (
                <DropdownItem
                  key={f.label}
                  active={s.fontSize === f.value}
                  onClick={() => {
                    if (f.value) editor.chain().focus().setFontSize(f.value).run()
                    else editor.chain().focus().unsetFontSize().run()
                    setMenu(null)
                  }}
                >
                  <span style={{ fontSize: f.value ?? '16px' }} className="leading-none">
                    {f.label}
                  </span>
                </DropdownItem>
              ))}
            </Dropdown>
          )}
        </div>

        <Divider />
        <ToolButton label="Bold (Ctrl+B)" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={15} strokeWidth={2.5} />
        </ToolButton>
        <ToolButton label="Italic (Ctrl+I)" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={15} />
        </ToolButton>
        <ToolButton label="Underline (Ctrl+U)" active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <Underline size={15} />
        </ToolButton>
        <ToolButton label="Strikethrough" active={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={15} />
        </ToolButton>
        <ToolButton label="Inline code" active={s.code} onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code size={15} />
        </ToolButton>

        {/* Link */}
        <div className="relative">
          <ToolButton
            label="Link"
            active={s.link || menu === 'link'}
            onClick={() => {
              setHref(s.linkHref)
              toggle('link')
            }}
          >
            <Link2 size={15} />
          </ToolButton>
          {menu === 'link' && (
            <Dropdown className="w-72 p-2">
              <form
                className="flex gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  applyLink()
                }}
              >
                <input
                  ref={linkRef}
                  value={href}
                  onChange={(e) => setHref(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && (setMenu(null), editor.commands.focus())}
                  placeholder="Paste a link…"
                  className="min-w-0 flex-1 rounded-md border border-black/10 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-400 dark:border-white/15"
                />
                <button type="submit" className="rounded-md bg-blue-500 px-2 text-sm text-white hover:bg-blue-600">
                  {href.trim() ? 'Apply' : 'Remove'}
                </button>
              </form>
            </Dropdown>
          )}
        </div>

        <Divider />
        {/* Colors */}
        <div className="relative">
          <ToolButton label="Text color" active={menu === 'color'} onClick={() => toggle('color')}>
            <span
              className="flex h-5 w-5 items-center justify-center rounded border border-black/10 text-[13px] font-semibold dark:border-white/15"
              style={{ color: s.color ?? undefined, background: s.background ?? undefined }}
            >
              A
            </span>
            <ChevronDown size={13} className="opacity-50" />
          </ToolButton>
          {menu === 'color' && (
            <Dropdown className="max-h-[60vh] w-52 overflow-y-auto">
              <DropdownTitle>Text color</DropdownTitle>
              <DropdownItem active={!s.color} onClick={() => editor.chain().focus().unsetColor().run()}>
                <Swatch /> Default
              </DropdownItem>
              {COLORS.map((c) => (
                <DropdownItem key={c} active={s.color === `var(--c-${c})`} onClick={() => editor.chain().focus().setColor(`var(--c-${c})`).run()}>
                  <Swatch color={`var(--c-${c})`} /> {label(c)}
                </DropdownItem>
              ))}
              <DropdownTitle>Background</DropdownTitle>
              <DropdownItem active={!s.background} onClick={() => editor.chain().focus().unsetBackgroundColor().run()}>
                <Swatch /> Default
              </DropdownItem>
              {COLORS.map((c) => (
                <DropdownItem
                  key={c}
                  active={s.background === `var(--bg-${c})`}
                  onClick={() => editor.chain().focus().setBackgroundColor(`var(--bg-${c})`).run()}
                >
                  <Swatch background={`var(--bg-${c})`} /> {label(c)} background
                </DropdownItem>
              ))}
            </Dropdown>
          )}
        </div>
      </div>
    </BubbleMenu>
  )
}

function ToolButton({
  children,
  label,
  onClick,
  active,
  wide,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
  wide?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded-md hover:bg-black/5 dark:hover:bg-white/10',
        wide ? 'px-2' : 'w-7',
        active && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      )}
    >
      {children}
    </button>
  )
}

const Divider = () => <div className="mx-0.5 h-5 w-px bg-black/10 dark:bg-white/10" />

function Dropdown({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'absolute left-0 top-9 z-50 w-48 animate-pop-in rounded-lg border border-black/10 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#252525]',
        className,
      )}
    >
      {children}
    </div>
  )
}

const DropdownTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide opacity-50">{children}</div>
)

function DropdownItem({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10',
        active && 'bg-black/5 font-medium dark:bg-white/10',
      )}
    >
      {children}
    </button>
  )
}

function Swatch({ color, background }: { color?: string; background?: string }) {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-black/10 text-xs font-semibold dark:border-white/15"
      style={{ color, background }}
    >
      A
    </span>
  )
}
