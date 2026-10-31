import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PopoverProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}

/**
 * Minimal absolutely-positioned popover (shadcn-like look). Place it inside a
 * `relative` parent. Closes on outside click and Escape.
 */
export function Popover({ open, onClose, children, className }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
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
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      ref={ref}
      className={cn(
        'no-drag absolute z-50 animate-pop-in rounded-lg border border-black/10 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#252525]',
        className,
      )}
    >
      {children}
    </div>
  )
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
