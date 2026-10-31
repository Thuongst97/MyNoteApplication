import { useEffect, useMemo, useRef, useState } from 'react'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'
import { Maximize2, Minus, Network, Plus, Search } from 'lucide-react'
import type { PageLinkEdge, PageMeta } from '@/types'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/useAppStore'
import { SERIES_COLORS } from '@/components/Editor/chart/chartModel'
import { cn } from '@/lib/utils'

interface GNode extends SimulationNodeDatum {
  id: string
  page: PageMeta
  degree: number
}
interface GLink extends SimulationLinkDatum<GNode> {
  kind: 'link' | 'child'
}

/** Graph of pages: edges are page links (and optionally parent → sub-page). */
export function GraphView() {
  const pages = useAppStore((s) => s.pages)
  const theme = useAppStore((s) => s.theme)
  const activePageId = useAppStore((s) => s.activePageId)
  const linksVersion = useAppStore((s) => s.linksVersion)
  const [edges, setEdges] = useState<PageLinkEdge[]>([])
  const [showChildren, setShowChildren] = useState(() => localStorage.getItem('notion-clone:graph-children') !== 'false')
  const [showOrphans, setShowOrphans] = useState(() => localStorage.getItem('notion-clone:graph-orphans') !== 'false')
  const [query, setQuery] = useState('')
  const [hover, setHover] = useState<string | null>(null)
  const [, setTick] = useState(0)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<Simulation<GNode, GLink> | null>(null)
  const nodesRef = useRef<Map<string, GNode>>(new Map())
  const [size, setSize] = useState({ w: 800, h: 600 })

  useEffect(() => {
    void api.getLinks().then(setEdges)
  }, [linksVersion])

  useEffect(() => {
    localStorage.setItem('notion-clone:graph-children', String(showChildren))
    localStorage.setItem('notion-clone:graph-orphans', String(showOrphans))
  }, [showChildren, showOrphans])

  // Track the canvas size.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const graph = useMemo(() => {
    const links: GLink[] = []
    const ids = new Set(pages.map((p) => p.id))
    const seen = new Set<string>()
    for (const e of edges) {
      const key = [e.source, e.target].sort().join('|')
      if (ids.has(e.source) && ids.has(e.target) && !seen.has(key)) {
        seen.add(key)
        links.push({ source: e.source, target: e.target, kind: 'link' })
      }
    }
    if (showChildren) for (const p of pages) if (p.parentId && ids.has(p.parentId)) links.push({ source: p.parentId, target: p.id, kind: 'child' })
    const degree = new Map<string, number>()
    for (const l of links) for (const id of [l.source as string, l.target as string]) degree.set(id, (degree.get(id) ?? 0) + 1)
    const nodes: GNode[] = pages
      .filter((p) => showOrphans || degree.has(p.id))
      .map((page) => {
        const prev = nodesRef.current.get(page.id)
        return { id: page.id, page, degree: degree.get(page.id) ?? 0, x: prev?.x, y: prev?.y, vx: prev?.vx, vy: prev?.vy }
      })
    const nodeIds = new Set(nodes.map((n) => n.id))
    return { nodes, links: links.filter((l) => nodeIds.has(l.source as string) && nodeIds.has(l.target as string)) }
  }, [pages, edges, showChildren, showOrphans])

  // Run the force layout.
  useEffect(() => {
    nodesRef.current = new Map(graph.nodes.map((n) => [n.id, n]))
    const sim = forceSimulation<GNode, GLink>(graph.nodes)
      .force('link', forceLink<GNode, GLink>(graph.links).id((d) => d.id).distance((l) => (l.kind === 'child' ? 60 : 90)).strength(0.6))
      .force('charge', forceManyBody().strength(-220))
      .force('center', forceCenter(0, 0))
      .force('x', forceX(0).strength(0.04))
      .force('y', forceY(0).strength(0.04))
      .force('collide', forceCollide<GNode>().radius((d) => radius(d) + 14))
      .alpha(0.9)
      .on('tick', () => setTick((t) => t + 1))
    simRef.current = sim
    return () => void sim.stop()
  }, [graph])

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const l of graph.links) {
      const s = typeof l.source === 'object' ? (l.source as GNode).id : (l.source as string)
      const t = typeof l.target === 'object' ? (l.target as GNode).id : (l.target as string)
      if (!m.has(s)) m.set(s, new Set())
      if (!m.has(t)) m.set(t, new Set())
      m.get(s)!.add(t)
      m.get(t)!.add(s)
    }
    return m
  }, [graph])

  const q = query.trim().toLowerCase()
  const focus = hover
  const isDim = (id: string) => {
    if (q) return !(nodesRef.current.get(id)?.page.title || 'untitled').toLowerCase().includes(q)
    if (focus) return id !== focus && !neighbors.get(focus)?.has(id)
    return false
  }

  // ---- pan / zoom / drag ----
  const drag = useRef<{ kind: 'pan' | 'node'; id?: string; sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null)
  const toWorld = (cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: (cx - r.left - size.w / 2 - view.x) / view.k, y: (cy - r.top - size.h / 2 - view.y) / view.k }
  }
  const onWheel = (e: React.WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect()
    const mx = e.clientX - r.left - size.w / 2
    const my = e.clientY - r.top - size.h / 2
    const k = Math.min(4, Math.max(0.2, view.k * Math.exp(-e.deltaY * 0.0015)))
    setView((v) => ({ k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k }))
  }
  const onPointerDown = (e: React.PointerEvent, id?: string) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { kind: id ? 'node' : 'pan', id, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false }
    if (id) {
      const n = nodesRef.current.get(id)
      if (n) {
        n.fx = n.x
        n.fy = n.y
        simRef.current?.alphaTarget(0.25).restart()
      }
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true
    if (d.kind === 'pan') setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }))
    else {
      const n = nodesRef.current.get(d.id!)
      if (n) {
        const w = toWorld(e.clientX, e.clientY)
        n.fx = w.x
        n.fy = w.y
      }
    }
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (d?.kind === 'node') {
      const n = nodesRef.current.get(d.id!)
      if (n) {
        n.fx = null
        n.fy = null
      }
      simRef.current?.alphaTarget(0)
      if (!d.moved) useAppStore.getState().setActivePage(d.id!)
    }
  }

  const colors = SERIES_COLORS[theme]
  const edgeColor = theme === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(55,53,47,0.22)'
  const childColor = theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(55,53,47,0.12)'
  const surface = theme === 'dark' ? '#191919' : '#ffffff'
  const pos = (n: GNode | string) => (typeof n === 'string' ? nodesRef.current.get(n) : n)
  const showLabel = (n: GNode) => view.k > 0.75 || n.degree >= 3 || n.id === focus || (focus && neighbors.get(focus)?.has(n.id)) || n.id === activePageId || (q && !isDim(n.id))

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-6 pb-3 pt-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Network size={22} className="text-blue-500" /> Graph view
        </h1>
        <span className="text-sm opacity-50">
          {graph.nodes.length} pages · {graph.links.filter((l) => l.kind === 'link').length} links
        </span>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5 rounded-md border border-black/10 px-2 py-1 dark:border-white/15">
            <Search size={14} className="opacity-50" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a page" className="w-36 bg-transparent outline-none" />
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showChildren} onChange={(e) => setShowChildren(e.target.checked)} className="accent-blue-500" />
            Sub-page connections
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={showOrphans} onChange={(e) => setShowOrphans(e.target.checked)} className="accent-blue-500" />
            Unlinked pages
          </label>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 border-t border-black/5 dark:border-white/5">
        <svg
          ref={svgRef}
          className={cn('h-full w-full touch-none select-none', drag.current?.kind === 'pan' ? 'cursor-grabbing' : 'cursor-grab')}
          onWheel={onWheel}
          onPointerDown={(e) => onPointerDown(e)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          role="img"
          aria-label={`Graph of ${graph.nodes.length} pages`}
        >
          <g transform={`translate(${size.w / 2 + view.x},${size.h / 2 + view.y}) scale(${view.k})`}>
            {graph.links.map((l, i) => {
              const s = pos(l.source as GNode | string)
              const t = pos(l.target as GNode | string)
              if (!s || !t || s.x === undefined || t.x === undefined) return null
              const dim = isDim(s.id) || isDim(t.id)
              return (
                <line
                  key={i}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y!}
                  stroke={l.kind === 'child' ? childColor : focus && !dim ? colors[0] : edgeColor}
                  strokeWidth={(l.kind === 'child' ? 1 : 1.5) / Math.sqrt(view.k)}
                  opacity={dim ? 0.25 : 1}
                />
              )
            })}
            {graph.nodes.map((n) => {
              if (n.x === undefined) return null
              const dim = isDim(n.id)
              const r = radius(n)
              const fill = n.page.kind === 'whiteboard' ? colors[1] : colors[0]
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  opacity={dim ? 0.2 : 1}
                  className="cursor-pointer"
                  onPointerDown={(e) => onPointerDown(e, n.id)}
                  onPointerEnter={() => setHover(n.id)}
                  onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
                >
                  <title>{n.page.title || 'Untitled'}</title>
                  {/* bigger invisible hit target */}
                  <circle r={r + 8} fill="transparent" />
                  <circle r={r} fill={fill} stroke={surface} strokeWidth={2} />
                  {n.id === activePageId && <circle r={r + 4} fill="none" stroke={fill} strokeWidth={1.5} />}
                  {showLabel(n) && (
                    <text
                      y={r + 13}
                      textAnchor="middle"
                      fontSize={12 / Math.max(0.8, Math.sqrt(view.k))}
                      fill={theme === 'dark' ? '#c3c2b7' : '#52514e'}
                      style={{ paintOrder: 'stroke', stroke: surface, strokeWidth: 3 }}
                    >
                      {(n.page.icon ? n.page.icon + ' ' : '') + truncate(n.page.title || 'Untitled', 28)}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        {/* Legend + zoom */}
        <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-4 text-xs opacity-70">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[0] }} /> Page
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[1] }} /> Whiteboard
          </span>
          <span className="opacity-70">Drag to move · scroll to zoom · click to open</span>
        </div>
        <div className="absolute bottom-3 right-4 flex gap-1">
          {[
            { label: 'Zoom in', icon: Plus, run: () => setView((v) => ({ ...v, k: Math.min(4, v.k * 1.25) })) },
            { label: 'Zoom out', icon: Minus, run: () => setView((v) => ({ ...v, k: Math.max(0.2, v.k / 1.25) })) },
            { label: 'Reset view', icon: Maximize2, run: () => setView({ x: 0, y: 0, k: 1 }) },
          ].map(({ label, icon: Icon, run }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              onClick={run}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-black/10 bg-white hover:bg-black/5 dark:border-white/10 dark:bg-[#252525] dark:hover:bg-white/10"
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
        {graph.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm opacity-50">No links yet — type [[ in a page to link to another page.</div>
        )}
      </div>
    </div>
  )
}

function radius(n: GNode) {
  return 5 + Math.min(10, Math.sqrt(n.degree) * 2.5)
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
