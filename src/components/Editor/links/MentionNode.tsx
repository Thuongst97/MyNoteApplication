import { mergeAttributes, Node, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { pageKindIcon } from '@/components/ui/PageKindIcon'
import { FileX } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { openPageFromClick } from '@/stores/useTabsStore'
import { cn } from '@/lib/utils'

/** Inline link to a page, or to a block on a page (block reference). */
export const MentionNode = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      pageId: { default: null, parseHTML: (el) => el.getAttribute('data-page-id'), renderHTML: (a) => ({ 'data-page-id': a.pageId }) },
      blockId: { default: null, parseHTML: (el) => el.getAttribute('data-block-ref'), renderHTML: (a) => (a.blockId ? { 'data-block-ref': a.blockId } : {}) },
      /** Snapshot of the referenced block's text, shown after the page title. */
      label: { default: '', parseHTML: (el) => el.getAttribute('data-label') ?? '', renderHTML: (a) => (a.label ? { 'data-label': a.label } : {}) },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="mention"]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'mention' }), `@${node.attrs.label || 'page'}`]
  },

  renderText({ node }) {
    const page = useAppStore.getState().pages.find((p) => p.id === node.attrs.pageId)
    return `@${page?.title || 'Untitled'}${node.attrs.label ? ` › ${node.attrs.label}` : ''}`
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionView, { as: 'span', className: 'mention-wrapper' })
  },
})

function MentionView({ node, selected }: NodeViewProps) {
  const pageId = node.attrs.pageId as string
  const blockId = node.attrs.blockId as string | null
  const label = node.attrs.label as string
  const page = useAppStore((s) => s.pages.find((p) => p.id === pageId))
  const Icon = !page ? FileX : pageKindIcon(page.kind)
  const open = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (page) openPageFromClick(pageId, e, { blockId })
  }
  return (
    <NodeViewWrapper as="span">
      <span
        contentEditable={false}
        role="link"
        title={page ? (blockId ? `Go to block in “${page.title || 'Untitled'}”` : `Open “${page.title || 'Untitled'}”`) : 'This page was deleted'}
        onClick={open}
        onAuxClick={(e) => e.button === 1 && open(e)}
        data-mention
        className={cn(
          'mx-[1px] inline-flex max-w-full cursor-pointer items-baseline gap-1 rounded px-1 align-baseline transition-colors hover:bg-black/[0.06] dark:hover:bg-white/[0.08]',
          selected && 'bg-blue-500/15',
          !page && 'cursor-default line-through opacity-50',
        )}
      >
        <span className="self-center leading-none">{page?.icon ?? <Icon size={14} className="opacity-60" />}</span>
        <span className="underline decoration-black/25 underline-offset-[3px] dark:decoration-white/25">
          {page ? page.title || 'Untitled' : 'Deleted page'}
          {blockId && label && <span className="opacity-60"> › {label}</span>}
        </span>
      </span>
    </NodeViewWrapper>
  )
}
