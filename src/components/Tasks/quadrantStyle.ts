import { AlertOctagon, CalendarClock, Trash2, Users, type LucideIcon } from 'lucide-react'
import type { Quadrant } from '@/lib/reminders'
import { quadrantPalette, QUADRANT_PRESETS } from '@/lib/quadrantColors'
import { useTaskStore } from '@/stores/useTaskStore'
import { useAppStore } from '@/stores/useAppStore'

export { QUADRANT_PRESETS }

/**
 * Soft, low-saturation quadrant palette (light: tinted neutrals with thin refined borders;
 * dark: the same hues at very low opacity). Text stays charcoal for legibility; color is
 * carried by the icon, the border and the background tint only.
 */
export interface QuadrantStyle {
  icon: LucideIcon
  /** Icon / accent color. */
  accent: string
  /** Quadrant background. */
  tint: string
  /** Thin quadrant border. */
  border: string
  /** Drop-target / selected ring. */
  ring: string
  dot: string
}

export const QUADRANT_STYLE: Record<Quadrant, QuadrantStyle> = {
  do: {
    icon: AlertOctagon,
    accent: 'text-[#E26D6D] dark:text-[#F19A9A]',
    tint: 'bg-[#FAF5F5] dark:bg-[#F87171]/[0.055]',
    border: 'border-[#F87171]/45 dark:border-[#F87171]/25',
    ring: 'ring-[#F87171]/50',
    dot: 'bg-[#F87171]',
  },
  schedule: {
    icon: CalendarClock,
    accent: 'text-[#5B83B7] dark:text-[#93B4DD]',
    tint: 'bg-[#F0F4F8] dark:bg-[#7FA7D9]/[0.055]',
    border: 'border-[#9DB9DC]/60 dark:border-[#7FA7D9]/25',
    ring: 'ring-[#7FA7D9]/55',
    dot: 'bg-[#7FA7D9]',
  },
  delegate: {
    icon: Users,
    accent: 'text-[#B48A4C] dark:text-[#D7B57E]',
    tint: 'bg-[#FDFBF7] dark:bg-[#D7B57E]/[0.05]',
    border: 'border-[#E8DCC5] dark:border-[#D7B57E]/20',
    ring: 'ring-[#D7B57E]/55',
    dot: 'bg-[#D7B57E]',
  },
  eliminate: {
    icon: Trash2,
    accent: 'text-[#8B929C] dark:text-[#9CA3AF]',
    tint: 'bg-[#F3F4F6] dark:bg-white/[0.03]',
    border: 'border-[#E5E7EB] dark:border-white/[0.08]',
    ring: 'ring-[#9CA3AF]/50',
    dot: 'bg-[#9CA3AF]',
  },
}

/** Charcoal text used throughout the matrix (and its soft secondary tone). */
export const MATRIX_TEXT = 'text-[#1F2937] dark:text-[#E5E7EB]'
export const MATRIX_TEXT_SECONDARY = 'text-[#4B5563] dark:text-[#A1A7B0]'
/** Soft floating depth for quadrants and cards. */
export const SOFT_SHADOW = 'shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.25)]'

/** Inline colors for a quadrant the user has recolored (null = use the default classes). */
export function useQuadrantCustom(id: Quadrant) {
  const custom = useTaskStore((s) => s.settings.quadrantColors?.[id])
  const theme = useAppStore((s) => s.theme)
  return custom ? { hex: custom, ...quadrantPalette(custom, theme) } : null
}

/** The color shown on a quadrant's color button (its custom color or its default accent). */
export const QUADRANT_DEFAULT_HEX: Record<Quadrant, string> = { do: '#f87171', schedule: '#7fa7d9', delegate: '#d7b57e', eliminate: '#9ca3af' }
