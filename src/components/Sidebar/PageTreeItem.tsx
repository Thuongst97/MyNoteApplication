import { useEffect, useRef, useState } from 'react'
import { ChevronRight, FileText, MoreHorizontal, Pencil, Plus, Trash2, FilePlus } from 'lucide-react'
import type { PageMeta } from '@/types'
import { selectChildren, useAppStore } from '@/stores/useAppStore'
import { MenuItem, Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/utils'

interface PageTreeItemProps {
  page: PageMeta
  depth: number
}

/** One row of the page tree; renders its children recursively. */
export function PageTreeItem({ page, depth }: PageTreeItemProps) {
  const pages = useAppStore((s) => s.pages)
  const isActive = useAppStore((s) => s.activePageId === page.id)
  const isExpanded = useAppStore((s) => !!s.expanded[page.id])
  const { setActivePage, toggleExpanded, createPage, deletePage, updatePageMeta } = useAppStore.getState()

  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(page.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const children = selectChildren(pages, page.id)
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
    const count = countDescendants(pages, page.id)
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
        onClick={() => !renaming && setActivePage(page.id)}
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
          {page.icon ?? <FileText size={15} className="opacity-60" />}
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
          <Popover open={menuOpen} onClose={() => setMenuOpen(false)} className="right-0 top-7 w-52">
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

      {/* Fold/unfold animation via grid-rows 0fr → 1fr */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden" role="group">
          {isExpanded &&
            (hasChildren ? (
              children.map((child) => <PageTreeItem key={child.id} page={child} depth={depth + 1} />)
            ) : (
              <div style={{ paddingLeft: 8 + (depth + 1) * 14 + 24 }} className="py-1 text-xs opacity-40">
                No pages inside
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
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
