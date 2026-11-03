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
        )}
      >
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
            className={cn('opacity-50 transition-transform duration-150', isExpanded && 'rotate-90', !hasChildren && 'opacity-25')}
          />
        </button>
        <span className="flex w-5 shrink-0 items-center justify-center text-[15px] leading-none">
          {page.icon ?? <PageKindIcon kind={page.kind} size={15} className="opacity-60" />}
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
          <span className={cn('min-w-0 flex-1 truncate', !page.title && 'opacity-50')}>{page.title || 'Untitled'}</span>
        )}

        {!renaming && (
          <div className={cn('flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100', menuOpen && 'opacity-100')}>
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
            <div style={{ paddingLeft: 8 + (depth + 1) * 14 + 24 }} className="py-1 text-xs opacity-40">
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
      className="flex h-5 w-5 items-center justify-center rounded opacity-60 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
    >
      {children}
    </button>
  )
}

function countDescendants(pages: PageMeta[], id: string): number {
  return pages.filter((p) => p.parentId === id).reduce((n, c) => n + 1 + countDescendants(pages, c.id), 0)
}
