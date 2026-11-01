import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface PopoverProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  /**
   * Element to anchor to. When set, the popover is rendered in a portal with fixed
   * positioning (right-aligned under the anchor, or above it when there's no room), so
   * it can't be clipped by scrolling or collapsing containers (e.g. nested sidebar items).
   */
  anchor?: RefObject<HTMLElement | null>
}

/**
 * Minimal absolutely-positioned popover (shadcn-like look). Place it inside a
 * `relative` parent. Closes on outside click and Escape.
 */
export function Popover({ open, onClose, children, className, anchor }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<CSSProperties | null>(null)

  // Anchored mode: place next to the anchor; keep inside the window.
  useLayoutEffect(() => {
    if (!open || !anchor) return setPos(null)
    const a = anchor.current?.getBoundingClientRect()
    const el = ref.current
    if (!a) return
    const h = el?.offsetHeight ?? 0
    const w = el?.offsetWidth ?? 0
    const gap = 4
    const below = a.bottom + gap + h <= window.innerHeight - 8
    const top = below ? a.bottom + gap : Math.max(8, a.top - gap - h)
    const left = Math.min(Math.max(8, a.right - w), window.innerWidth - w - 8)
    setPos({ position: 'fixed', top, left })
  }, [open, anchor])

  // Anchored popovers close when anything scrolls (the anchor would move away).
  useEffect(() => {
    if (!open || !anchor) return
    const onScroll = (e: Event) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return
      onClose()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [open, anchor, onClose])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      // The anchor's own click toggles the popover; don't close-then-reopen here.
      if (anchor?.current?.contains(t)) return
      if (ref.current && !ref.current.contains(t)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    // Defer so the click that opened the popover doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener('mousedown', onDown))
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchor])

  if (!open) return null
  const box = (
    <div
      ref={ref}
      role="menu"
      style={anchor ? { position: 'fixed', ...(pos ?? { top: 0, left: 0, visibility: 'hidden' }) } : undefined}
      className={cn(
        'no-drag z-50 animate-pop-in rounded-lg border border-black/10 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#252525]',
        anchor ? 'z-[400]' : 'absolute',
        className,
      )}
    >
      {children}
    </div>
  )
  return anchor ? createPortal(box, document.body) : box
}

export function MenuItem({
  icon,
  children,
  onClick,
  danger,
  shortcut,
}: {
  icon?: ReactNode
  children: ReactNode
  onClick: () => void
  danger?: boolean
  shortcut?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10',
        danger && 'hover:text-red-600 dark:hover:text-red-400',
      )}
    >
      {icon && <span className="flex w-4 justify-center opacity-70">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-xs opacity-40">{shortcut}</span>}
    </button>
  )
}
