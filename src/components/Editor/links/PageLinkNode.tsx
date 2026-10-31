import { mergeAttributes, Node, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { ArrowUpRight, FileText, FileX, Shapes } from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageLink: {
      insertPageLink: (pageId: string) => ReturnType
    }
  }
}

/** A block that links to another page (sub-pages created with /page use it). */
export const PageLinkNode = Node.create({
  name: 'pageLink',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-page-id'),
        renderHTML: (attrs) => ({ 'data-page-id': attrs.pageId }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="page-link"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'page-link' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageLinkView)
  },

  addCommands() {
    return {
      insertPageLink:
        (pageId) =>
        ({ commands }) =>
          commands.insertContent([{ type: this.name, attrs: { pageId } }, { type: 'paragraph' }]),
    }
  },
})

function PageLinkView({ node, selected }: NodeViewProps) {
  const pageId = node.attrs.pageId as string
  const page = useAppStore((s) => s.pages.find((p) => p.id === pageId))
  const open = () => page && useAppStore.getState().setActivePage(pageId)
  const Icon = !page ? FileX : page.kind === 'whiteboard' ? Shapes : FileText

  return (
    <NodeViewWrapper data-drag-handle className="my-0.5">
      <div
        contentEditable={false}
        role="link"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => e.key === 'Enter' && open()}
        className={cn(
          'group/pl flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
          selected && 'bg-blue-500/10',
          !page && 'cursor-default opacity-50',
        )}
      >
        <span className="flex w-5 shrink-0 justify-center text-[17px] leading-none">
          {page?.icon ?? <Icon size={17} className="opacity-60" />}
        </span>
        <span className={cn('truncate font-medium underline decoration-black/20 underline-offset-[3px] dark:decoration-white/20', !page && 'line-through')}>
          {page ? page.title || 'Untitled' : 'Deleted page'}
        </span>
        {page && <ArrowUpRight size={14} className="opacity-0 transition-opacity group-hover/pl:opacity-50" />}
      </div>
    </NodeViewWrapper>
  )
}
