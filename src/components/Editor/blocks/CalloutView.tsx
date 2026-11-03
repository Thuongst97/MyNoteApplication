import { useDocTheme } from '@/components/Editor/docTheme'
import { useRef, useState } from 'react'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Check, Palette } from 'lucide-react'
import { Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/utils'
import { EMOJIS } from '../pickerData'
import { BLOCK_COLORS, BLOCK_COLOR_IDS, blockBackground, normalizeBlockColor } from './blockColors'

/** Callout: icon + colored box around editable blocks. Hover for color/icon options. */
export function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
  const theme = useDocTheme()
  const color = normalizeBlockColor(node.attrs.color)
  const icon: string | null = node.attrs.icon || null
  const [iconOpen, setIconOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const iconRef = useRef<HTMLButtonElement>(null)
  const colorRef = useRef<HTMLButtonElement>(null)
  const editable = editor.isEditable

  return (
    <NodeViewWrapper
      className={cn('callout-block group/callout relative my-2 flex gap-2 rounded-lg px-4 py-3', color === 'none' && 'border border-black/10 dark:border-white/10')}
      style={{ background: blockBackground(color, theme) }}
      data-color={color}
    >
      {icon && (
        <button
          ref={iconRef}
          type="button"
          contentEditable={false}
          title={editable ? 'Change icon' : undefined}
          onClick={() => editable && setIconOpen((o) => !o)}
          className="no-drag mt-[1px] flex h-7 w-7 shrink-0 select-none items-center justify-center rounded text-lg leading-none hover:bg-black/5 dark:hover:bg-white/10"
        >
          {icon}
        </button>
      )}
      <NodeViewContent className="callout-content min-w-0 flex-1" />
      {editable && (
        <div contentEditable={false} className="no-drag absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover/callout:opacity-100">
          {!icon && (
            <button
              ref={iconRef}
              type="button"
              onClick={() => setIconOpen((o) => !o)}
              className="rounded-md border border-black/10 bg-white/90 px-1.5 py-0.5 text-xs shadow-sm hover:bg-white dark:border-white/10 dark:bg-[#2a2a2a]/90"
            >
              Add icon
            </button>
          )}
          <button
            ref={colorRef}
            type="button"
            title="Background color"
            aria-label="Callout color"
            onClick={() => setColorOpen((o) => !o)}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-black/10 bg-white/90 shadow-sm hover:bg-white dark:border-white/10 dark:bg-[#2a2a2a]/90"
          >
            <Palette size={13} />
          </button>
        </div>
      )}
      <Popover open={iconOpen} onClose={() => setIconOpen(false)} anchor={iconRef} className="w-64 p-2">
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                updateAttributes({ icon: e })
                setIconOpen(false)
              }}
              className="flex h-7 w-7 items-center justify-center rounded text-lg hover:bg-black/5 dark:hover:bg-white/10"
            >
              {e}
            </button>
          ))}
        </div>
        {icon && (
          <button
            type="button"
            onClick={() => {
              updateAttributes({ icon: '' })
              setIconOpen(false)
            }}
            className="mt-1.5 w-full rounded-md px-2 py-1 text-left text-xs opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          >
            Remove icon
          </button>
        )}
      </Popover>
      <Popover open={colorOpen} onClose={() => setColorOpen(false)} anchor={colorRef} className="w-48 p-1.5">
        <div className="px-1.5 pb-1 text-[11px] font-medium opacity-50">Background</div>
        {BLOCK_COLOR_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="menuitemradio"
            aria-checked={id === color}
            onClick={() => {
              updateAttributes({ color: id })
              setColorOpen(false)
            }}
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            <span className="h-4 w-4 rounded border border-black/10 dark:border-white/15" style={{ background: blockBackground(id, theme) }} />
            {BLOCK_COLORS[id].label}
            {id === color && <Check size={14} className="ml-auto opacity-60" />}
          </button>
        ))}
      </Popover>
    </NodeViewWrapper>
  )
}
