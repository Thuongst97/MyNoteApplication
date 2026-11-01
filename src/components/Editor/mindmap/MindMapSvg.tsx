import type { Theme } from '@/stores/useAppStore'
import { SERIES_COLORS } from '../chart/chartModel'
import { levelStyle, type LaidOutNode, type MindLayoutResult } from './mindmapModel'

export const MIND_TOKENS: Record<Theme, { rootFill: string; rootText: string; text: string; surface: string; muted: string; select: string }> = {
  light: { rootFill: '#37352f', rootText: '#ffffff', text: '#37352f', surface: '#ffffff', muted: '#8a8984', select: '#2383e2' },
  dark: { rootFill: '#ebebea', rootText: '#191919', text: '#e6e6e4', surface: '#191919', muted: '#8a897f', select: '#5ea2ef' },
}

interface Props {
  layout: MindLayoutResult
  theme: Theme
  selectedId?: string | null
  dropTargetId?: string | null
  draggingId?: string | null
  /** Hide the text of this topic (it's being edited in an input on top). */
  editingId?: string | null
  onNodePointerDown?: (id: string, e: React.PointerEvent) => void
  onNodeDoubleClick?: (id: string) => void
  onToggle?: (id: string) => void
}

/** Draws a laid-out mind map (edges + topics). Coordinates are centered on the root. */
export function MindMapSvg({ layout, theme, selectedId, dropTargetId, draggingId, editingId, onNodePointerDown, onNodeDoubleClick, onToggle }: Props) {
  const t = MIND_TOKENS[theme]
  const colors = SERIES_COLORS[theme]
  const byId = layout.byId
  const interactive = !!onNodePointerDown

  return (
    <g>
      {/* edges */}
      {layout.nodes.map((n) => {
        if (!n.parentId) return null
        const p = byId.get(n.parentId)!
        const sx = p.x + (n.side * p.w) / 2
        const ex = n.x - (n.side * n.w) / 2
        const mx = (sx + ex) / 2
        return (
          <path
            key={`e-${n.id}`}
            d={`M ${sx} ${p.y} C ${mx} ${p.y}, ${mx} ${n.y}, ${ex} ${n.y}`}
            fill="none"
            stroke={colors[n.color]}
            strokeWidth={n.depth === 1 ? 3 : 2}
            strokeLinecap="round"
            opacity={draggingId && (n.id === draggingId || isUnder(byId, n.id, draggingId)) ? 0.3 : 1}
          />
        )
      })}
      {/* topics */}
      {layout.nodes.map((n) => (
        <Topic
          key={n.id}
          n={n}
          theme={theme}
          color={n.color >= 0 ? colors[n.color] : t.rootFill}
          selected={n.id === selectedId}
          dropTarget={n.id === dropTargetId}
          faded={!!draggingId && (n.id === draggingId || isUnder(byId, n.id, draggingId))}
          hideText={n.id === editingId}
          interactive={interactive}
          onPointerDown={onNodePointerDown}
          onDoubleClick={onNodeDoubleClick}
          onToggle={onToggle}
          hasChildren={layout.nodes.some((c) => c.parentId === n.id) || n.hiddenChildren > 0}
        />
      ))}
    </g>
  )
}

function isUnder(byId: Map<string, LaidOutNode>, id: string, ancestor: string) {
  let cur = byId.get(id)?.parentId
  while (cur) {
    if (cur === ancestor) return true
    cur = byId.get(cur)?.parentId ?? null
  }
  return false
}

function Topic({
  n,
  theme,
  color,
  selected,
  dropTarget,
  faded,
  hideText,
  interactive,
  hasChildren,
  onPointerDown,
  onDoubleClick,
  onToggle,
}: {
  n: LaidOutNode
  theme: Theme
  color: string
  selected: boolean
  dropTarget: boolean
  faded: boolean
  hideText: boolean
  interactive: boolean
  hasChildren: boolean
  onPointerDown?: (id: string, e: React.PointerEvent) => void
  onDoubleClick?: (id: string) => void
  onToggle?: (id: string) => void
}) {
  const t = MIND_TOKENS[theme]
  const st = levelStyle(n.depth)
  const isRoot = n.depth === 0
  const fill = isRoot ? t.rootFill : n.depth === 1 ? `${color}2e` : `${color}14`
  const stroke = isRoot ? t.rootFill : color
  const textColor = isRoot ? t.rootText : t.text
  const left = n.x - n.w / 2
  const top = n.y - n.h / 2
  const firstBaseline = top + st.padY + st.size - 2 + (st.lineH - st.size) / 2
  const toggleX = n.x + (n.side * n.w) / 2 + n.side * 10

  return (
    <g
      data-topic-id={n.id}
      opacity={faded ? 0.35 : 1}
      onPointerDown={interactive ? (e) => onPointerDown?.(n.id, e) : undefined}
      onDoubleClick={interactive ? () => onDoubleClick?.(n.id) : undefined}
      style={{ cursor: interactive ? 'pointer' : undefined }}
    >
      <title>{n.note ? `${n.text}\n\n${n.note}` : n.text}</title>
      {(selected || dropTarget) && (
        <rect x={left - 4} y={top - 4} width={n.w + 8} height={n.h + 8} rx={isRoot ? 14 : 10} fill="none" stroke={t.select} strokeWidth={2} strokeDasharray={dropTarget ? '5 4' : undefined} />
      )}
      <rect x={left} y={top} width={n.w} height={n.h} rx={isRoot ? 10 : 7} fill={fill} stroke={stroke} strokeWidth={isRoot ? 0 : n.depth === 1 ? 2 : 1.25} />
      {!hideText && (
        <text fill={textColor} fontSize={st.size} fontWeight={n.depth <= 1 ? 600 : 400} textAnchor="middle" style={{ fontFamily: 'ui-sans-serif, -apple-system, "Segoe UI", sans-serif' }}>
          {n.lines.map((line, i) => (
            <tspan key={i} x={n.x} y={firstBaseline + i * st.lineH}>
              {line || (n.text ? '' : isRoot ? 'Central topic' : 'Topic')}
            </tspan>
          ))}
        </text>
      )}
      {n.note && <circle cx={left + n.w - 6} cy={top + 6} r={3} fill={isRoot ? t.rootText : color} aria-label="Has notes" />}
      {/* fold / unfold */}
      {hasChildren && !isRoot && (n.hiddenChildren > 0 || (interactive && selected)) && (
        <g
          onPointerDown={(e) => {
            e.stopPropagation()
            onToggle?.(n.id)
          }}
          style={{ cursor: 'pointer' }}
          aria-label={n.hiddenChildren > 0 ? `Expand (${n.hiddenChildren} hidden)` : 'Collapse'}
        >
          <circle cx={toggleX} cy={n.y} r={n.hiddenChildren > 0 ? 9 : 7} fill={t.surface} stroke={color} strokeWidth={1.5} />
          <text x={toggleX} y={n.y + 3.5} textAnchor="middle" fontSize={n.hiddenChildren > 0 ? 10 : 11} fontWeight={600} fill={color}>
            {n.hiddenChildren > 0 ? n.hiddenChildren : '−'}
          </text>
        </g>
      )}
    </g>
  )
}
