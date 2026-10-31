import { useEffect, useLayoutEffect, useState } from 'react'
import { ImageIcon, Smile, Shuffle, Trash2 } from 'lucide-react'
import type { PageMeta } from '@/types'
import { Popover } from '@/components/ui/Popover'
import { COVERS, EMOJIS, coverToCss } from './pickerData'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  page: PageMeta
  autoFocusTitle: boolean
  onChange: (patch: Partial<Pick<PageMeta, 'title' | 'icon' | 'cover'>>) => void
  /** Move focus to the start of the editor (Enter / ArrowDown in the title). */
  onEnterBody: () => void
  titleRef: React.RefObject<HTMLTextAreaElement>
}

export function PageHeader({ page, autoFocusTitle, onChange, onEnterBody, titleRef }: PageHeaderProps) {
  const [iconOpen, setIconOpen] = useState(false)
  const [coverOpen, setCoverOpen] = useState(false)
  const [coverUrl, setCoverUrl] = useState('')

  // Auto-grow the title textarea.
  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [page.title, titleRef])

  useEffect(() => {
    if (autoFocusTitle) titleRef.current?.focus()
  }, [autoFocusTitle, titleRef])

  const randomEmoji = () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)]
  const randomCover = () => COVERS[Math.floor(Math.random() * COVERS.length)]

  return (
    <div className="group/header">
      {/* Cover */}
      {page.cover ? (
        <div className="group/cover relative h-[30vh] max-h-72 min-h-36 w-full" style={{ background: coverToCss(page.cover) }}>
          <div className="absolute bottom-3 right-4 flex gap-1 opacity-0 transition-opacity group-hover/cover:opacity-100">
            <div className="relative">
              <CoverButton onClick={() => setCoverOpen((o) => !o)}>Change cover</CoverButton>
              <Popover open={coverOpen} onClose={() => setCoverOpen(false)} className="right-0 top-9 w-80 p-3">
                <div className="mb-2 text-xs font-medium opacity-60">Gallery</div>
                <div className="grid grid-cols-4 gap-2">
                  {COVERS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label="Choose cover"
                      onClick={() => {
                        onChange({ cover: c })
                        setCoverOpen(false)
                      }}
                      className={cn(
                        'h-12 rounded-md ring-offset-1 hover:ring-2 hover:ring-blue-400',
                        page.cover === c && 'ring-2 ring-blue-500',
                      )}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="mb-2 mt-3 text-xs font-medium opacity-60">Image link</div>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (/^https?:\/\//.test(coverUrl.trim())) {
                      onChange({ cover: coverUrl.trim() })
                      setCoverUrl('')
                      setCoverOpen(false)
                    }
                  }}
                >
                  <input
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="https://…"
                    className="min-w-0 flex-1 rounded-md border border-black/10 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-400 dark:border-white/15"
                  />
                  <button type="submit" className="rounded-md bg-blue-500 px-2 text-sm text-white hover:bg-blue-600">
                    Set
                  </button>
                </form>
              </Popover>
            </div>
            <CoverButton onClick={() => onChange({ cover: null })}>Remove</CoverButton>
          </div>
        </div>
      ) : (
        <div className="h-16" />
      )}

      <div className="mx-auto w-full max-w-[900px] px-12 md:px-24">
        {/* Icon */}
        {page.icon && (
          <div className={cn('relative', page.cover ? '-mt-10' : 'mt-4')}>
            <button
              type="button"
              onClick={() => setIconOpen((o) => !o)}
              className="rounded-lg p-1 text-[64px] leading-none outline-none transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-400 dark:hover:bg-white/10"
              aria-label="Change icon"
            >
              {page.icon}
            </button>
            <IconPicker
              open={iconOpen}
              onClose={() => setIconOpen(false)}
              onPick={(icon) => {
                onChange({ icon })
                setIconOpen(false)
              }}
            />
          </div>
        )}

        {/* Hover controls */}
        <div className="relative mt-2 flex h-7 gap-1 text-sm opacity-0 transition-opacity group-hover/header:opacity-100 focus-within:opacity-100">
          {!page.icon && (
            <GhostButton onClick={() => onChange({ icon: randomEmoji() })}>
              <Smile size={15} /> Add icon
            </GhostButton>
          )}
          {!page.cover && (
            <GhostButton onClick={() => onChange({ cover: randomCover() })}>
              <ImageIcon size={15} /> Add cover
            </GhostButton>
          )}
          {page.cover && (
            <GhostButton onClick={() => onChange({ cover: randomCover() })}>
              <Shuffle size={15} /> Shuffle cover
            </GhostButton>
          )}
          {page.icon && (
            <GhostButton onClick={() => onChange({ icon: null })}>
              <Trash2 size={15} /> Remove icon
            </GhostButton>
          )}
        </div>

        {/* Title */}
        <textarea
          ref={titleRef}
          value={page.title}
          rows={1}
          placeholder="Untitled"
          spellCheck
          onChange={(e) => onChange({ title: e.target.value.replace(/\n/g, '') })}
          onKeyDown={(e) => {
            const el = e.currentTarget
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              onEnterBody()
            } else if (e.key === 'ArrowDown' && el.selectionStart === el.value.length) {
              e.preventDefault()
              onEnterBody()
            }
          }}
          className="mt-1 block w-full resize-none overflow-hidden bg-transparent text-[40px] font-bold leading-tight tracking-tight outline-none placeholder:text-ink-light/25 dark:placeholder:text-ink-dark/25"
        />
      </div>
    </div>
  )
}

function IconPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (icon: string | null) => void }) {
  return (
    <Popover open={open} onClose={onClose} className="left-0 top-[88px] w-80 p-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-xs font-medium opacity-60">Emoji</span>
        <button type="button" className="rounded px-1.5 py-0.5 text-xs opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10" onClick={() => onPick(null)}>
          Remove
        </button>
      </div>
      <div className="grid grid-cols-10 gap-0.5">
        {EMOJIS.map((e) => (
          <button key={e} type="button" onClick={() => onPick(e)} className="rounded p-1 text-xl hover:bg-black/5 dark:hover:bg-white/10">
            {e}
          </button>
        ))}
      </div>
    </Popover>
  )
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-2 text-ink-light/50 hover:bg-black/5 dark:text-ink-dark/50 dark:hover:bg-white/10"
    >
      {children}
    </button>
  )
}

function CoverButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-white/90 px-2 py-1 text-xs text-[#37352F] shadow-sm hover:bg-white"
    >
      {children}
    </button>
  )
}
