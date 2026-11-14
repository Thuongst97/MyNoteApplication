import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { PageKindIcon } from '@/components/ui/PageKindIcon'
import { ChevronRight, FileDown, FileUp, Link2, MoreHorizontal, Pencil, Plus, Presentation, Shapes, Trash2, FilePlus, PanelTop } from 'lucide-react'
import { exportPageToFile, importPageFile } from '@/components/Editor/pageFiles'
import { pageUrl } from '@/lib/links'
import type { PageMeta } from '@/types'
import { useAppStore, useChildPages } from '@/stores/useAppStore'
import { MenuItem, Popover } from '@/components/ui/Popover'
import { openPageFromClick, useTabsStore } from '@/stores/useTabsStore'
import { cn } from '@/lib/utils'
import { dropPositionAt, planMove, type DropPosition } from '@/lib/pageMove'

/** Data type of a page dragged in the sidebar. */
export const PAGE_DRAG_TYPE = 'application/x-premiumnote-page'
/** The page being dragged in the sidebar (drag data can't be read during dragover). */
export const pageDrag: { id: string | null } = { id: null }

interface PageTreeItemProps {
  page: PageMeta
  depth: number
}

/**
 * One row of the page tree; renders its children recursively. Memoized: a row only
 * re-renders when its own page, expanded/active state or children change.
 */
export const PageTreeItem = memo(function PageTreeItem({ page, depth }: PageTreeItemProps) {
  const isActive = useAppStore((s) => s.view === 'page' && s.activePageId === page.id)
  const isExpanded = useAppStore((s) => !!s.expanded[page.id])
  const { setActivePage, toggleExpanded, createPage, deletePage, updatePageMeta } = useAppStore.getState()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(page.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const [drop, setDrop] = useState<DropPosition | null>(null)
  const expandTimer = useRef<number | null>(null)
  const clearDrop = () => {
    setDrop(null)
    if (expandTimer.current) window.clearTimeout(expandTimer.current)
    expandTimer.current = null
  }
  const children = useChildPages(page.id)
  const hasChildren = children.length > 0

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [renaming])

  const commitRename = () => {
    if (draft !== page.title) updatePageMeta(page.id, { title: draft })
    setRenaming(false)
  }

  const confirmDelete = () => {
    setMenuOpen(false)
    const count = countDescendants(useAppStore.getState().pages, page.id)
    const name = page.title || 'Untitled'
    const msg = count
      ? `Delete "${name}" and its ${count} sub-page${count > 1 ? 's' : ''}? This cannot be undone.`
      : `Delete "${name}"? This cannot be undone.`
    if (window.confirm(msg)) void deletePage(page.id)
  }

  return (
    <div>
      <div
        role="treeitem"
        aria-selected={isActive}
        aria-expanded={hasChildren ? isExpanded : undefined}
        tabIndex={0}
        onClick={(e) => !renaming && openPageFromClick(page.id, e)}
        onAuxClick={(e) => !renaming && e.button === 1 && openPageFromClick(page.id, e)}
        onMouseDown={(e) => e.button === 1 && e.preventDefault()}
        // Drag a page onto another: top/bottom edge = before/after it, middle = inside it.
        draggable={!renaming}
        onDragStart={(e) => {
          pageDrag.id = page.id
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData(PAGE_DRAG_TYPE, page.id)
        }}
        onDragEnd={() => {
          pageDrag.id = null
          clearDrop()
        }}
        onDragOver={(e) => {
          const id = pageDrag.id
          if (!id) return
          const r = e.currentTarget.getBoundingClientRect()
          const pos = dropPositionAt(e.clientY - r.top, r.height)
          if (!planMove(useAppStore.getState().pages, id, page.id, pos)) {
            if (drop) clearDrop()
            return
          }
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = 'move'
          if (pos !== drop) setDrop(pos)
          // Hovering in the middle of a collapsed page opens it, to drop deeper.
          if (pos === 'inside' && hasChildren && !isExpanded && !expandTimer.current) {
            expandTimer.current = window.setTimeout(() => toggleExpanded(page.id, true), 600)
          } else if (pos !== 'inside' && expandTimer.current) {
            window.clearTimeout(expandTimer.current)
            expandTimer.current = null
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) clearDrop()
        }}
        onDrop={(e) => {
          const id = pageDrag.id
          const pos = drop
          clearDrop()
          if (!id || !pos) return
          e.preventDefault()
          e.stopPropagation()
          const plan = planMove(useAppStore.getState().pages, id, page.id, pos)
          if (plan) void useAppStore.getState().movePage(id, plan.parentId, plan.order)
          pageDrag.id = null
        }}
        onKeyDown={(e) => {
          if (renaming) return
          if (e.key === 'Enter') setActivePage(page.id)
          if (e.key === 'ArrowRight') toggleExpanded(page.id, true)
          if (e.key === 'ArrowLeft') toggleExpanded(page.id, false)
          if (e.key === 'F2') {
            setDraft(page.title)
            setRenaming(true)
          }
        }}
        onDoubleClick={() => {
          setDraft(page.title)
          setRenaming(true)
        }}
        style={{ paddingLeft: 8 + depth * 14 }}
        className={cn(
          'group relative flex h-[30px] cursor-pointer select-none items-center gap-1 rounded-md pr-1 text-sm outline-none',
          'hover:bg-black/[0.04] focus-visible:ring-1 focus-visible:ring-blue-400 dark:hover:bg-white/[0.06]',
          isActive && 'bg-black/[0.06] font-medium text-ink-light dark:bg-white/[0.09] dark:text-white',
          drop === 'inside' && 'bg-[#2383e2]/15 ring-1 ring-[#2383e2]/60 dark:bg-[#2383e2]/25',
        )}
      >
        {/* Drop guide: a line above or below the row. */}
        {(drop === 'before' || drop === 'after') && (
          <span
            aria-hidden
            data-drop-line={drop}
            className={cn('pointer-events-none absolute right-1 h-[2px] rounded bg-[#2383e2]', drop === 'before' ? '-top-px' : '-bottom-px')}
            style={{ left: 8 + depth * 14 + 22 }}
          />
        )}
        <button
          type="button"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          onClick={(e) => {
            e.stopPropagation()
            toggleExpanded(page.id)
          }}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10"
        >
          <ChevronRight
            size={14}
            className={cn('opacity-60 transition-transform duration-150', isExpanded && 'rotate-90', !hasChildren && 'opacity-30')}
          />
        </button>
        <span className="flex w-5 shrink-0 items-center justify-center text-[15px] leading-none">
          {page.icon ?? <PageKindIcon kind={page.kind} size={15} className="opacity-80" />}
        </span>

        {renaming ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenaming(false)
            }}
            className="min-w-0 flex-1 rounded border border-blue-400 bg-white px-1 py-0.5 text-sm outline-none dark:bg-[#2a2a2a]"
          />
        ) : (
          // The full width is for the title; the hover buttons only take room while shown.
          // Long names fade out at the end (no "…"); while the row's buttons show, the fade ends before them.
          <span className={cn('page-title-fade min-w-0 flex-1 overflow-hidden whitespace-nowrap', menuOpen && 'page-title-fade-open', !page.title && 'opacity-50')}>{page.title || 'Untitled'}</span>
        )}

        {!renaming && (
          <div className={cn('absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100', menuOpen && 'pointer-events-auto opacity-100')}>
            <IconButton
              buttonRef={menuButton}
              label="More actions"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((o) => !o)
              }}
            >
              <MoreHorizontal size={15} />
            </IconButton>
            <IconButton
              label="Add a page inside"
              onClick={(e) => {
                e.stopPropagation()
                void createPage(page.id)
              }}
            >
              <Plus size={15} />
            </IconButton>
          </div>
        )}

        <div onClick={(e) => e.stopPropagation()}>
          <Popover open={menuOpen} onClose={closeMenu} anchor={menuButton} className="w-52">
            <MenuItem
              icon={<PanelTop size={14} />}
              onClick={() => {
                setMenuOpen(false)
                useTabsStore.getState().openInNewTab(`page:${page.id}`)
              }}
            >
              Open in new tab
            </MenuItem>
            <MenuItem
              icon={<FilePlus size={14} />}
              onClick={() => {
                setMenuOpen(false)
                void createPage(page.id)
              }}
            >
              Add sub-page
            </MenuItem>
            <MenuItem
              icon={<Shapes size={14} />}
              onClick={() => {
                setMenuOpen(false)
                void createPage(page.id, { kind: 'whiteboard', title: 'Untitled whiteboard' })
              }}
            >
              Add whiteboard inside
            </MenuItem>
            <MenuItem
              icon={<Presentation size={14} />}
              onClick={() => {
                setMenuOpen(false)
                void createPage(page.id, { kind: 'slides', title: 'Untitled presentation' })
              }}
            >
              Add presentation inside
            </MenuItem>
            <MenuItem
              icon={<Link2 size={14} />}
              onClick={() => {
                setMenuOpen(false)
                void navigator.clipboard.writeText(pageUrl(page.id))
                useAppStore.getState().showToast('Link to page copied — paste it in any page or whiteboard')
              }}
            >
              Copy link to page
            </MenuItem>
            <MenuItem
              icon={<FileUp size={14} />}
              onClick={() => {
                setMenuOpen(false)
                void exportPageToFile(page.id, true)
              }}
            >
              {hasChildren ? 'Export with sub-pages…' : 'Export…'}
            </MenuItem>
            <MenuItem
              icon={<FileDown size={14} />}
              onClick={() => {
                setMenuOpen(false)
                void importPageFile(page.id)
              }}
            >
              Import inside…
            </MenuItem>
            <MenuItem
              icon={<Pencil size={14} />}
              shortcut="F2"
              onClick={() => {
                setMenuOpen(false)
                setDraft(page.title)
                setRenaming(true)
              }}
            >
              Rename
            </MenuItem>
            <div className="my-1 h-px bg-black/5 dark:bg-white/10" />
            <MenuItem icon={<Trash2 size={14} />} danger onClick={confirmDelete}>
              Delete
            </MenuItem>
          </Popover>
        </div>
      </div>

      {/* Children appear with a short fade (no layout animation, which made unfolding feel laggy). */}
      {isExpanded && (
        <div role="group" className="animate-tree-in">
          {hasChildren ? (
            children.map((child) => <PageTreeItem key={child.id} page={child} depth={depth + 1} />)
          ) : (
            <div style={{ paddingLeft: 8 + (depth + 1) * 14 + 24 }} className="py-1 text-xs opacity-55">
              No pages inside
            </div>
          )}
        </div>
      )}
    </div>
  )
})

function IconButton({
  children,
  label,
  onClick,
  buttonRef,
}: {
  children: React.ReactNode
  label: string
  onClick: (e: React.MouseEvent) => void
  buttonRef?: React.Ref<HTMLButtonElement>
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded-md opacity-80 hover:bg-black/[0.08] hover:opacity-100 hover:opacity-100 dark:hover:bg-white/10"
    >
      {children}
    </button>
  )
}

function countDescendants(pages: PageMeta[], id: string): number {
  return pages.filter((p) => p.parentId === id).reduce((n, c) => n + 1 + countDescendants(pages, c.id), 0)
}
