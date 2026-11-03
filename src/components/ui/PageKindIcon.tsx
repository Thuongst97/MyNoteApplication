import { FileText, Presentation, Shapes } from 'lucide-react'
import type { PageKind } from '@/types'

/** The default icon of a page type (used when the page has no emoji icon). */
export function PageKindIcon({ kind, size = 15, className }: { kind: PageKind | undefined; size?: number; className?: string }) {
  const Icon = kind === 'whiteboard' ? Shapes : kind === 'slides' ? Presentation : FileText
  return <Icon size={size} className={className} />
}

/** The icon component for a page type (for places that render it themselves). */
export function pageKindIcon(kind: PageKind | undefined) {
  return kind === 'whiteboard' ? Shapes : kind === 'slides' ? Presentation : FileText
}
