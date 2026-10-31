import { AlertOctagon, CalendarClock, Trash2, Users, type LucideIcon } from 'lucide-react'
import type { Quadrant } from '@/lib/reminders'

export const QUADRANT_STYLE: Record<Quadrant, { icon: LucideIcon; accent: string; tint: string; ring: string; dot: string }> = {
  do: {
    icon: AlertOctagon,
    accent: 'text-red-600 dark:text-red-400',
    tint: 'bg-red-500/[0.05] dark:bg-red-400/[0.06]',
    ring: 'ring-red-400/60',
    dot: 'bg-red-500',
  },
  schedule: {
    icon: CalendarClock,
    accent: 'text-blue-600 dark:text-blue-400',
    tint: 'bg-blue-500/[0.05] dark:bg-blue-400/[0.06]',
    ring: 'ring-blue-400/60',
    dot: 'bg-blue-500',
  },
  delegate: {
    icon: Users,
    accent: 'text-amber-600 dark:text-amber-400',
    tint: 'bg-amber-500/[0.06] dark:bg-amber-400/[0.06]',
    ring: 'ring-amber-400/60',
    dot: 'bg-amber-500',
  },
  eliminate: {
    icon: Trash2,
    accent: 'text-stone-500 dark:text-stone-400',
    tint: 'bg-stone-500/[0.05] dark:bg-white/[0.03]',
    ring: 'ring-stone-400/60',
    dot: 'bg-stone-400',
  },
}
