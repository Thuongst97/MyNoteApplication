import { useEffect, useMemo, useRef, useState } from 'react'
import { CaptureUpdateAction, exportToSvg, MIME_TYPES, restoreElements, serializeLibraryAsJSON } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI, LibraryItems } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import {
  BookOpen,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  FileUp,
  Globe,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import type { Theme } from '@/stores/useAppStore'
import { useLibraryStore } from '@/stores/useLibraryStore'
import { filterLibraries, itemText, PERSONAL_ID, type LibraryCategory, type LibraryItem } from '@/lib/libraries'
import { MenuItem, Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/utils'
import { cloneItemElements } from './libraryInsert'

const toExcalidrawItems = (items: LibraryItem[]): LibraryItems =>
  items.map((i) => ({ id: i.id, status: 'unpublished', created: i.created, name: i.name, elements: i.elements as ExcalidrawElement[] })) as unknown as LibraryItems

interface PanelProps {
  api: ExcalidrawImperativeAPI | null
  theme: Theme
  onClose: () => void
}

/** Categorized, permanently saved drawing libraries. */
export function LibraryPanel({ api, theme, onClose }: PanelProps) {
  const data = useLibraryStore((s) => s.data)
  const busy = useLibraryStore((s) => s.busy)
  const store = useLibraryStore.getState()
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [link, setLink] = useState('')

  useEffect(() => {
    if (!data) void store.load()
  }, [data, store])

  const categories = useMemo(() => (data ? filterLibraries(data, query) : []), [data, query])
  const allCollapsed = categories.length > 0 && categories.every((c) => c.collapsed)
  const totalItems = data?.categories.reduce((n, c) => n + c.items.length, 0) ?? 0

  /** Places a copy of the item in the middle of the visible canvas. */
  const insert = (item: LibraryItem) => {
    if (!api) return
    const st = api.getAppState()
    const zoom = st.zoom.value
    const cx = -st.scrollX + st.width / 2 / zoom
    const cy = -st.scrollY + st.height / 2 / zoom
    const added = restoreElements(cloneItemElements(item, cx, cy) as unknown as ExcalidrawElement[], null)
    api.updateScene({
      elements: [...api.getSceneElementsIncludingDeleted(), ...added],
      appState: { selectedElementIds: Object.fromEntries(added.filter((e) => !('containerId' in e && e.containerId)).map((e) => [e.id, true])) },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    })
  }

  /** Saves the current selection as a new item in the personal library. */
  const addSelection = () => {
    if (!api) return
    const st = api.getAppState()
    const all = api.getSceneElements()
    const ids = new Set(Object.keys(st.selectedElementIds).filter((id) => st.selectedElementIds[id]))
    // include text bound inside selected shapes
    const selected = all.filter((e) => ids.has(e.id) || ('containerId' in e && e.containerId && ids.has(e.containerId)))
    if (!selected.length) return
    void store.addItems(PERSONAL_ID, [{ id: `p${Date.now().toString(36)}`, created: Date.now(), elements: structuredClone(selected) as unknown[] }])
  }

  const submitLink = async () => {
    if (!link.trim()) return
    const id = await store.installUrl(link)
    if (id) {
      setLink('')
      setLinkOpen(false)
    }
  }

  return (
    <aside
      aria-label="Libraries"
      onKeyDown={(e) => e.stopPropagation()}
      className="no-drag absolute bottom-3 right-3 top-[60px] z-20 flex w-[310px] flex-col overflow-hidden rounded-xl border border-black/10 bg-white text-[#37352f] shadow-xl dark:border-white/10 dark:bg-[#232323] dark:text-[#e6e6e4]"
    >
      {/* Header */}
      <div className="flex items-center gap-1 border-b border-black/5 px-3 py-2 dark:border-white/10">
        <BookOpen size={16} className="text-blue-500" />
        <span className="text-sm font-semibold">Libraries</span>
        <span className="text-xs opacity-45">{totalItems}</span>
        <div className="ml-auto flex items-center gap-0.5">
          <IconBtn
            label={allCollapsed ? 'Expand all' : 'Collapse all'}
            onClick={() => void store.setAllCollapsed(!allCollapsed)}
          >
            {allCollapsed ? <ChevronsUpDown size={15} /> : <ChevronsDownUp size={15} />}
          </IconBtn>
          <div className="relative">
            <IconBtn label="Add library" onClick={() => setAddOpen((o) => !o)}>
              <Plus size={16} />
            </IconBtn>
            <Popover open={addOpen} onClose={() => setAddOpen(false)} className="right-0 top-8 w-56">
              <MenuItem icon={<Globe size={14} />} onClick={() => (setAddOpen(false), void store.browse())}>
                Browse libraries…
              </MenuItem>
              <MenuItem icon={<Link2 size={14} />} onClick={() => (setAddOpen(false), setLinkOpen(true))}>
                Install from link…
              </MenuItem>
              <MenuItem icon={<FileUp size={14} />} onClick={() => (setAddOpen(false), void store.importFile())}>
                Import file (.excalidrawlib)…
              </MenuItem>
            </Popover>
          </div>
          <IconBtn label="Close libraries" onClick={onClose}>
            <X size={16} />
          </IconBtn>
        </div>
      </div>

      {/* Search + install from link */}
      <div className="space-y-2 px-3 pt-2">
        <label className="flex items-center gap-1.5 rounded-md border border-black/10 px-2 py-1 text-sm dark:border-white/15">
          <Search size={14} className="opacity-45" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search libraries" className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
        {linkOpen && (
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              void submitLink()
            }}
          >
            <input
              autoFocus
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…/name.excalidrawlib"
              aria-label="Library link"
              className="min-w-0 flex-1 rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs outline-none focus:border-blue-400 dark:border-white/15"
            />
            <button type="submit" className="rounded-md bg-blue-500 px-2 text-xs text-white hover:bg-blue-600" disabled={!!busy}>
              Install
            </button>
          </form>
        )}
        {busy && (
          <div className="flex items-center gap-1.5 text-xs opacity-60">
            <Loader2 size={12} className="animate-spin" /> {busy}
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1">
        {!data && (
          <div className="flex justify-center py-6 opacity-50">
            <Loader2 size={16} className="animate-spin" />
          </div>
        )}
        {categories.map((c) => (
          <CategorySection
            key={c.id}
            category={c}
            theme={theme}
            forceOpen={!!query.trim()}
            onInsert={insert}
            onAddSelection={c.id === PERSONAL_ID ? addSelection : undefined}
          />
        ))}
        {data && query && categories.length === 0 && <div className="py-6 text-center text-sm opacity-50">No matching items</div>}
        <button
          type="button"
          onClick={() => void store.browse()}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-500 py-2 text-sm font-medium text-white hover:bg-blue-600"
        >
          <Download size={15} /> Browse libraries
        </button>
        <p className="mt-1.5 px-1 text-center text-[11px] opacity-45">Installed libraries are saved permanently and available in every whiteboard and drawing.</p>
      </div>
    </aside>
  )
}

function CategorySection({
  category: c,
  theme,
  forceOpen,
  onInsert,
  onAddSelection,
}: {
  category: LibraryCategory
  theme: Theme
  forceOpen: boolean
  onInsert: (item: LibraryItem) => void
  onAddSelection?: () => void
}) {
  const store = useLibraryStore.getState()
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(c.name)
  const open = forceOpen || !c.collapsed
  const isPersonal = c.id === PERSONAL_ID
  const isUrl = /^https?:/.test(c.source)

  return (
    <section aria-label={c.name} className="mt-1 rounded-lg">
      <div className="group/cat flex items-center gap-1 rounded-md px-1 py-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${c.name}`}
          onClick={() => void store.toggleCollapsed(c.id)}
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
        >
          <ChevronRight size={15} className={cn('shrink-0 opacity-50 transition-transform', open && 'rotate-90')} />
          {renaming ? (
            <input
              autoFocus
              value={draft}
              aria-label="Library name"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => (setRenaming(false), void store.renameCategory(c.id, draft))}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
                if (e.key === 'Escape') (setDraft(c.name), setRenaming(false))
              }}
              className="min-w-0 flex-1 rounded border border-blue-400 bg-transparent px-1 text-sm outline-none"
            />
          ) : (
            <span className={cn('truncate text-sm font-semibold', isPersonal && 'text-blue-600 dark:text-blue-400')}>{c.name}</span>
          )}
          <span className="ml-1 shrink-0 text-xs opacity-40">{c.items.length}</span>
        </button>
        <div className="relative">
          <button
            type="button"
            aria-label={`${c.name} options`}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-6 w-6 items-center justify-center rounded opacity-0 hover:bg-black/5 group-hover/cat:opacity-60 dark:hover:bg-white/10"
          >
            <MoreHorizontal size={15} />
          </button>
          <Popover open={menuOpen} onClose={() => setMenuOpen(false)} className="right-0 top-7 w-48">
            <MenuItem icon={<Pencil size={14} />} onClick={() => (setMenuOpen(false), setDraft(c.name), setRenaming(true))}>
              Rename
            </MenuItem>
            {isUrl && (
              <MenuItem icon={<RefreshCw size={14} />} onClick={() => (setMenuOpen(false), void store.installUrl(c.source))}>
                Update from source
              </MenuItem>
            )}
            <MenuItem
              icon={<Trash2 size={14} />}
              danger
              onClick={() => {
                setMenuOpen(false)
                const msg = isPersonal ? `Remove all ${c.items.length} items from your personal library?` : `Delete the library “${c.name}” (${c.items.length} items)?`
                if (window.confirm(msg)) void store.deleteCategory(c.id)
              }}
            >
              {isPersonal ? 'Clear all items' : 'Delete library'}
            </MenuItem>
          </Popover>
        </div>
      </div>

      {open && (
        <div className="px-1 pb-2">
          {onAddSelection && (
            <button
              type="button"
              onClick={onAddSelection}
              className="mb-1.5 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-black/15 py-1 text-xs opacity-70 hover:opacity-100 dark:border-white/20"
            >
              <Plus size={13} /> Add selected shapes
            </button>
          )}
          {c.items.length === 0 ? (
            <div className="py-3 text-center text-xs opacity-45">{isPersonal ? 'Select shapes and click “Add selected shapes”.' : 'No items'}</div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {c.items.map((item) => (
                <ItemTile key={item.id} item={item} theme={theme} onInsert={() => onInsert(item)} onDelete={() => void store.deleteItem(c.id, item.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

const svgCache = new Map<string, string>()

function ItemTile({ item, theme, onInsert, onDelete }: { item: LibraryItem; theme: Theme; onInsert: () => void; onDelete: () => void }) {
  const key = `${item.id}:${theme}`
  const [svg, setSvg] = useState(() => svgCache.get(key) ?? '')
  const ref = useRef<HTMLDivElement>(null)

  // Render the preview when the tile scrolls into view.
  useEffect(() => {
    if (svg) return
    let cancelled = false
    const render = () =>
      exportToSvg({
        elements: item.elements as ExcalidrawElement[],
        appState: { exportBackground: false, viewBackgroundColor: 'transparent', exportWithDarkMode: theme === 'dark' },
        files: null,
        exportPadding: 6,
        skipInliningFonts: true,
      })
        .then((el: SVGSVGElement) => {
          el.removeAttribute('width')
          el.removeAttribute('height')
          const html = el.outerHTML
          svgCache.set(key, html)
          if (!cancelled) setSvg(html)
        })
        .catch(() => undefined)
    if (typeof IntersectionObserver === 'undefined' || !ref.current) {
      void render()
      return () => void (cancelled = true)
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect()
        void render()
      }
    })
    io.observe(ref.current)
    return () => {
      cancelled = true
      io.disconnect()
    }
  }, [item, key, svg, theme])

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      title={`${itemText(item) ? itemText(item) + ' — ' : ''}Click to add · drag onto the canvas`}
      aria-label={item.name ?? (itemText(item) || 'Library item')}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(MIME_TYPES.excalidrawlib, serializeLibraryAsJSON(toExcalidrawItems([item])))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={onInsert}
      onKeyDown={(e) => e.key === 'Enter' && onInsert()}
      className="group/item relative flex aspect-square cursor-pointer items-center justify-center rounded-md border border-black/10 bg-white p-1 hover:border-blue-400 dark:border-white/10 dark:bg-[#2a2a2a]"
    >
      {svg ? (
        <div className="library-thumb h-full w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <Loader2 size={12} className="animate-spin opacity-30" />
      )}
      <button
        type="button"
        aria-label={`Delete ${item.name ?? 'item'}`}
        title="Delete item"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-[#37352f] text-white shadow group-hover/item:flex dark:bg-[#ebebea] dark:text-[#191919]"
      >
        <X size={11} />
      </button>
    </div>
  )
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
    >
      {children}
    </button>
  )
}

/**
 * Connects an Excalidraw canvas to the saved libraries: replaces the built-in library
 * button with ours and keeps items added via "Add to library" (context menu) in the
 * personal library.
 */
export function useLibraryIntegration(theme: Theme) {
  const [open, setOpen] = useState(false)
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const data = useLibraryStore((s) => s.data)
  const known = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!data) void useLibraryStore.getState().load()
  }, [data])
  if (data && !known.current) known.current = new Set(data.categories.flatMap((c) => c.items.map((i) => i.id)))

  return {
    api,
    setApi,
    /** Props for <Excalidraw>. */
    excalidrawProps: {
      onLibraryChange: (items: LibraryItems) => {
        // "Add to library" from the canvas context menu adds items here; keep new ones permanently.
        const seen = known.current ?? new Set<string>()
        const fresh = items.filter((i) => !seen.has(i.id))
        fresh.forEach((i) => seen.add(i.id))
        known.current = seen
        if (fresh.length)
          void useLibraryStore.getState().addItems(
            PERSONAL_ID,
            fresh.map((i) => ({ id: i.id, name: i.name, created: i.created ?? Date.now(), elements: structuredClone(i.elements) as unknown[] })),
          )
      },
      renderTopRightUI: () => (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-pressed={open}
          aria-label="Libraries"
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm',
            open ? 'bg-[#e0dfff] text-[#4a47b1] dark:bg-[#403e6a] dark:text-[#d0ccff]' : 'bg-[#ececf4] text-[#1b1b1f] hover:bg-[#e0dfff] dark:bg-[#232329] dark:text-[#e3e3e8]',
          )}
        >
          <BookOpen size={15} /> Library
        </button>
      ),
    },
    panel: open ? <LibraryPanel api={api} theme={theme} onClose={() => setOpen(false)} /> : null,
  }
}
