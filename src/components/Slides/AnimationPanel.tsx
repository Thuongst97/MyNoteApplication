import type { Editor as TiptapEditor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { ArrowDown, ArrowUp, Play, Plus, Sparkles, X } from 'lucide-react'
import { ANIM_EFFECTS, TRANSITIONS, type AnimEffect, type SlideAnimation, type SlideData, type SlideTransition } from '@/lib/presentation'
import { newId, cn } from '@/lib/utils'
import type { JSONContent } from '@tiptap/react'

const LISTS = ['bulletList', 'orderedList', 'taskList']

/** The top-level block holding the editor's cursor (or the selected block). */
export function blockAtCursor(editor: TiptapEditor): { pos: number; node: import('@tiptap/pm/model').Node } | null {
  const sel = editor.state.selection
  if (sel instanceof NodeSelection && sel.$from.depth === 0) return { pos: sel.from, node: sel.node }
  const $f = sel.$from
  if ($f.depth < 1) return null
  return { pos: $f.before(1), node: $f.node(1) }
}

/** The block's id, giving it one first if needed (null if the block type can't have one). */
export function ensureBlockId(editor: TiptapEditor, pos: number, node: import('@tiptap/pm/model').Node): string | null {
  if (typeof node.attrs.blockId === 'string' && node.attrs.blockId) return node.attrs.blockId
  if (!('blockId' in node.attrs)) return null
  const id = newId()
  editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'blockId', id))
  return id
}

function textOf(n: JSONContent | undefined): string {
  if (!n) return ''
  if (n.type === 'text') return n.text ?? ''
  return (n.content ?? []).map(textOf).join(' ')
}

const TYPE_LABEL: Record<string, string> = {
  heading: 'Title',
  paragraph: 'Text',
  bulletList: 'List',
  orderedList: 'Numbered list',
  taskList: 'To-do list',
  image: 'Image',
  codeBlock: 'Code',
  mermaid: 'Diagram',
  plantuml: 'Diagram',
  chart: 'Chart',
  drawing: 'Drawing',
  htmlBlock: 'HTML',
  table: 'Table',
  callout: 'Callout',
  blockquote: 'Quote',
  columns: 'Columns',
  equation: 'Equation',
  mindmap: 'Mind map',
}

/** "Text: First words…" for an animated block. */
export function blockLabel(slide: SlideData, blockId: string): string | null {
  const box = slide.boxes?.find((x) => x.id === blockId)
  if (box) {
    const first = box.content.content?.find((x) => x.type !== 'paragraph' || textOf(x).trim()) ?? box.content.content?.[0]
    const kind = TYPE_LABEL[first?.type ?? ''] ?? 'Box'
    const t = textOf(box.content).replace(/\s+/g, ' ').trim()
    return `${kind} box${t ? `: ${t.length > 28 ? `${t.slice(0, 28)}…` : t}` : ''}`
  }
  const b = (slide.content.content ?? []).find((x) => x.attrs?.blockId === blockId)
  if (!b) return null
  const kind = TYPE_LABEL[b.type ?? ''] ?? 'Block'
  const t = textOf(b).replace(/\s+/g, ' ').trim()
  return t ? `${kind}: ${t.length > 34 ? `${t.slice(0, 34)}…` : t}` : kind
}

/**
 * The Animations panel: the slide's transition, and its click animations in order
 * (add one for the block with the cursor, change its effect, reorder, remove).
 */
export function AnimationPanel({
  slide,
  editor,
  boxId,
  onChange,
  onTransitionToAll,
  onPreview,
  onClose,
}: {
  slide: SlideData
  editor: TiptapEditor | null
  /** The box the editor belongs to: its whole box gets the animation. */
  boxId?: string | null
  onChange: (patch: Partial<SlideData>) => void
  onTransitionToAll: () => void
  onPreview: () => void
  onClose: () => void
}) {
  const anims = (slide.animations ?? []).filter((a) => blockLabel(slide, a.blockId) !== null)
  const set = (next: SlideAnimation[]) => onChange({ animations: next.length ? next : undefined })

  const add = () => {
    if (boxId) {
      if (!anims.some((a) => a.blockId === boxId)) set([...anims, { blockId: boxId, effect: 'fade' }])
      return
    }
    if (!editor || editor.isDestroyed) return
    const hit = blockAtCursor(editor)
    if (!hit) return
    const id = ensureBlockId(editor, hit.pos, hit.node)
    if (!id || anims.some((a) => a.blockId === id)) return
    set([...anims, { blockId: id, effect: 'fade', ...(LISTS.includes(hit.node.type.name) && { byItem: true }) }])
  }
  const move = (i: number, d: -1 | 1) => {
    const next = [...anims]
    const [a] = next.splice(i, 1)
    next.splice(Math.max(0, Math.min(next.length, i + d)), 0, a)
    set(next)
  }

  return (
    <div className="flex w-[264px] shrink-0 flex-col overflow-y-auto border-l border-black/[0.07] dark:border-white/[0.07]" aria-label="Animations" role="region">
      <div className="flex h-10 items-center gap-2 px-3 text-sm font-medium">
        <Sparkles size={15} className="opacity-70" /> Animations
        <button type="button" aria-label="Close animations" onClick={onClose} className="ml-auto rounded p-1 opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10">
          <X size={14} />
        </button>
      </div>

      <section className="border-t border-black/[0.06] px-3 py-3 dark:border-white/[0.06]">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide opacity-50">Slide transition</div>
        <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Slide transition">
          {TRANSITIONS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={(slide.transition ?? 'none') === t.id}
              onClick={() => onChange({ transition: t.id === 'none' ? undefined : (t.id as SlideTransition) })}
              className={cn(
                'rounded-md border px-2 py-1.5 text-xs',
                (slide.transition ?? 'none') === t.id ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'border-black/10 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.05]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onTransitionToAll} className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400">
          Apply to all slides
        </button>
      </section>

      <section className="border-t border-black/[0.06] px-3 py-3 dark:border-white/[0.06]">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide opacity-50">On click</div>
        {anims.length === 0 && <p className="mb-2 text-xs opacity-60">Put the cursor in a block on the slide (a title, a list, an image…) and add an animation. Blocks appear one click at a time while presenting.</p>}
        <ol className="mb-2 flex flex-col gap-1.5">
          {anims.map((a, i) => (
            <li key={a.blockId} className="rounded-md border border-black/10 p-2 dark:border-white/10" data-testid="animation-item">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-500 text-[11px] font-semibold text-white">{i + 1}</span>
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-xs hover:underline"
                  title="Show on the slide"
                  onClick={() => editor?.commands.flashBlock(a.blockId)}
                >
                  {blockLabel(slide, a.blockId)}
                </button>
                <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp size={12} />
                </IconBtn>
                <IconBtn label="Move down" disabled={i === anims.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown size={12} />
                </IconBtn>
                <IconBtn label="Remove animation" onClick={() => set(anims.filter((x) => x.blockId !== a.blockId))}>
                  <X size={12} />
                </IconBtn>
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Effect"
                  value={a.effect}
                  onChange={(e) => set(anims.map((x) => (x.blockId === a.blockId ? { ...x, effect: e.target.value as AnimEffect } : x)))}
                  className="min-w-0 flex-1 rounded border border-black/10 bg-transparent px-1.5 py-1 text-xs dark:border-white/10 dark:bg-[#252525]"
                >
                  {ANIM_EFFECTS.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
                {LISTS.includes((slide.content.content ?? []).find((b) => b.attrs?.blockId === a.blockId)?.type ?? '') && (
                  <label className="flex shrink-0 items-center gap-1 text-xs" title="Each item appears on its own click">
                    <input
                      type="checkbox"
                      checked={!!a.byItem}
                      onChange={(e) => set(anims.map((x) => (x.blockId === a.blockId ? { ...x, byItem: e.target.checked || undefined } : x)))}
                      className="accent-blue-500"
                    />
                    By item
                  </label>
                )}
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={add}
          disabled={!editor && !boxId}
          onMouseDown={(e) => e.preventDefault() /* keep the cursor where it is in the slide */}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-black/15 py-1.5 text-xs hover:bg-black/[0.03] disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/[0.05]"
        >
          <Plus size={13} /> {boxId ? 'Animate selected box' : 'Animate block at cursor'}
        </button>
        <button type="button" onClick={onPreview} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs text-blue-600 hover:bg-blue-500/10 dark:text-blue-400">
          <Play size={12} fill="currentColor" /> Preview this slide (Shift+F5)
        </button>
      </section>
    </div>
  )
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="rounded p-0.5 opacity-60 hover:bg-black/5 hover:opacity-100 disabled:opacity-20 dark:hover:bg-white/10">
      {children}
    </button>
  )
}
