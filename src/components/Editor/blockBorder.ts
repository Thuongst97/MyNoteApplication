import { cn } from '@/lib/utils'

/**
 * Node attribute for the frame around a visual block (mind map, drawing). On by default,
 * including blocks created before the option existed; turning it off stores `false`.
 */
export const borderAttribute = {
  default: true,
  parseHTML: (el: HTMLElement) => el.getAttribute('data-border') !== 'false',
  renderHTML: (attrs: Record<string, unknown>) => (attrs.border === false ? { 'data-border': 'false' } : {}),
}

/** Border classes for a block wrapper: blue when selected, a soft frame when bordered, else only on hover. */
export function blockFrameClass(selected: boolean, border: boolean) {
  return cn(
    'rounded-lg border transition-colors',
    selected ? 'border-blue-400/70' : border ? 'border-black/15 dark:border-white/15' : 'border-transparent hover:border-black/10 dark:hover:border-white/10',
  )
}
