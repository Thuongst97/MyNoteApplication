import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import type { Theme } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'
import { CHART_HEIGHTS, CHART_TOKENS, formatTick, formatValue, labelPositionOf, rechartsLabelPosition, partColor, partsOf, seriesColor, textOn, type ChartSpec, type LegendPosition } from './chartModel'

/** Renders a chart spec. Loaded lazily (recharts is large). */
export default function ChartRender({ spec, theme }: { spec: ChartSpec; theme: Theme }) {
  if (spec.type === 'parts') return <PartsBar spec={spec} theme={theme} />
  if (spec.type === 'pie') return <PieView spec={spec} theme={theme} />
  return <CartesianChart spec={spec} theme={theme} />
}

function CartesianChart({ spec, theme }: { spec: ChartSpec; theme: Theme }) {
  const colors = spec.series.map((_, j) => seriesColor(spec, j, theme))
  const t = CHART_TOKENS[theme]
  const multi = spec.series.length >= 2
  const f = spec.format
  const legendPos: LegendPosition = f?.legend ?? (multi ? 'top' : 'none')
  const stacked = !!f?.stacked && (spec.type === 'bar' || spec.type === 'hbar')
  const curve = f?.smooth ? 'monotone' : 'linear'
  const fmt = (v: unknown) => (typeof v === 'number' ? formatValue(v, f) : '')
  const rows = useMemo(
    () =>
      spec.labels.map((label, i) => {
        const row: Record<string, string | number | null> = {
          label: label || `#${i + 1}`,
        }
        spec.series.forEach((s, j) => (row[`s${j}`] = s.values[i] ?? null))
        return row
      }),
    [spec],
  )

  const tick = { fill: t.textSecondary, fontSize: 12 }
  const axisCommon = { tickLine: false, axisLine: false, tick } as const
  const valueAxis = {
    ...axisCommon,
    tickFormatter: (v: number) => formatTick(v, f),
    width: 56,
    tickCount: 6,
    allowDecimals: true,
  }
  const grid = f?.gridlines === false ? null : <CartesianGrid stroke={t.grid} strokeWidth={1} vertical={spec.type === 'hbar'} horizontal={spec.type !== 'hbar'} />
  // Axis titles: xTitle under the horizontal axis, yTitle beside the vertical one.
  const titleStyle = { fill: t.textSecondary, fontSize: 12, fontWeight: 500 }
  const xLabel = f?.xTitle ? { value: f.xTitle, position: 'insideBottom' as const, offset: -2, ...titleStyle } : undefined
  const yLabel = f?.yTitle ? { value: f.yTitle, angle: -90, position: 'insideLeft' as const, style: { textAnchor: 'middle' as const }, ...titleStyle } : undefined
  /** Values written on the bars / points. */
  const labelPos = labelPositionOf(spec)
  // Inside a bar the label takes a color that reads on the bar; outside, the text color.
  const onBar = (spec.type === 'bar' || spec.type === 'hbar') && labelPos !== 'outside'
  const dataLabels = (j: number) =>
    f?.dataLabels ? (
      <LabelList
        dataKey={`s${j}`}
        position={rechartsLabelPosition(spec.type, labelPos) as never}
        offset={labelPos === 'outside' || !onBar ? 6 : 8}
        formatter={fmt as never}
        fill={onBar ? textOn(colors[j]) : t.textSecondary}
        fontSize={11}
        fontWeight={onBar ? 600 : 500}
      />
    ) : null
  const tooltip = (
    <Tooltip
      content={(p: TooltipContentProps<ValueType, NameType>) => <TooltipCard {...p} spec={spec} colors={colors} fmt={fmt} />}
      cursor={spec.type === 'line' || spec.type === 'area' ? { stroke: t.textMuted, strokeWidth: 1 } : { fill: t.grid, opacity: 0.6 }}
      isAnimationActive={false}
    />
  )
  // Direct end-labels for line charts with up to 4 series (legend stays too).
  const endLabels = spec.type === 'line' && spec.series.length <= 4 && multi
  const margin = {
    top: f?.dataLabels && labelPos === 'outside' ? 20 : 8,
    right: endLabels ? 84 : f?.dataLabels && spec.type === 'hbar' && labelPos === 'outside' ? 56 : 12,
    bottom: (f?.xTitle ? 18 : 4) + (f?.dataLabels && labelPos === 'inside-base' && (spec.type === 'line' || spec.type === 'area') ? 14 : 0),
    left: f?.yTitle ? 14 : 0,
  }

  let chart: React.ReactElement
  if (spec.type === 'line') {
    chart = (
      <LineChart data={rows} margin={margin}>
        {grid}
        <XAxis dataKey="label" {...axisCommon} label={xLabel} />
        <YAxis {...valueAxis} label={yLabel} />
        {tooltip}
        {spec.series.map((s, j) => (
          <Line
            key={j}
            type={curve}
            dataKey={`s${j}`}
            name={s.name}
            stroke={colors[j]}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={rows.length <= 12 ? { r: 4, fill: colors[j], stroke: t.surface, strokeWidth: 2 } : false}
            activeDot={{
              r: 5,
              fill: colors[j],
              stroke: t.surface,
              strokeWidth: 2,
            }}
            connectNulls
            isAnimationActive={false}
            label={endLabels && !f?.dataLabels ? (endLabel(s.name, rows.length, t.textSecondary) as never) : undefined}
          >
            {dataLabels(j)}
          </Line>
        ))}
      </LineChart>
    )
  } else if (spec.type === 'area') {
    chart = (
      <AreaChart data={rows} margin={margin}>
        {grid}
        <XAxis dataKey="label" {...axisCommon} label={xLabel} />
        <YAxis {...valueAxis} label={yLabel} />
        {tooltip}
        {spec.series.map((s, j) => (
          <Area
            key={j}
            type={curve}
            dataKey={`s${j}`}
            name={s.name}
            stackId="stack"
            stroke={colors[j]}
            strokeWidth={2}
            fill={colors[j]}
            fillOpacity={0.28}
            activeDot={{
              r: 5,
              fill: colors[j],
              stroke: t.surface,
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          >
            {dataLabels(j)}
          </Area>
        ))}
      </AreaChart>
    )
  } else {
    const horizontal = spec.type === 'hbar'
    chart = (
      <BarChart data={rows} margin={margin} layout={horizontal ? 'vertical' : 'horizontal'} barGap={2} barCategoryGap="22%">
        {grid}
        {horizontal ? (
          <>
            <XAxis type="number" {...valueAxis} label={xLabel} />
            <YAxis type="category" dataKey="label" {...axisCommon} width={96} tickFormatter={(v: string) => truncate(v, 14)} label={yLabel} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" {...axisCommon} label={xLabel} />
            <YAxis {...valueAxis} label={yLabel} />
          </>
        )}
        {tooltip}
        {spec.series.map((s, j) => (
          <Bar
            key={j}
            dataKey={`s${j}`}
            name={s.name}
            fill={colors[j]}
            maxBarSize={stacked ? 36 : f?.dataLabels && onBar && !horizontal ? 46 : 24}
            stackId={stacked ? 'stack' : undefined}
            // 4px rounded data-end, square at the baseline (stacks: only the top segment).
            radius={stacked && j < spec.series.length - 1 ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            isAnimationActive={false}
          >
            {dataLabels(j)}
          </Bar>
        ))}
      </BarChart>
    )
  }

  const base = CHART_HEIGHTS[f?.height ?? 'medium']
  const perRow = stacked ? 1 : spec.series.length
  const height =
    spec.type === 'hbar' ? Math.max(160, Math.min(560 * (base / 300), rows.length * perRow * 26 + rows.length * 14 + 40)) : base

  return (
    <WithLegend pos={legendPos} names={spec.series.map((s) => s.name)} colors={colors}>
      <div style={{ height }} className="w-full min-w-0" data-testid="chart-plot">
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
    </WithLegend>
  )
}

function TooltipCard({
  active,
  payload,
  label,
  spec,
  colors,
  fmt,
}: TooltipContentProps<ValueType, NameType> & {
  spec: ChartSpec
  colors: string[]
  fmt: (v: unknown) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[140px] rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-[#252525]">
      <div className="mb-1 font-medium">{label}</div>
      {payload.map((p) => {
        const j = Number(String(p.dataKey).slice(1))
        return (
          <div key={String(p.dataKey)} className="flex items-center gap-2 py-0.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colors[j] }} />
            <span className="flex-1 opacity-70">{spec.series[j]?.name}</span>
            <span className="font-medium tabular-nums">{fmt(p.value)}</span>
          </div>
        )
      })}
    </div>
  )
}

/** The chart with its legend on the chosen side (or none). */
function WithLegend({ pos, names, colors, children }: { pos: LegendPosition; names: string[]; colors: string[]; children: React.ReactNode }) {
  if (pos === 'none') return <div className="w-full">{children}</div>
  const side = pos === 'left' || pos === 'right'
  const legend = <Legend names={names} colors={colors} vertical={side} />
  return (
    <div className={cn('flex w-full', side ? 'items-center gap-4' : 'flex-col gap-2', side ? 'flex-row' : '')} data-legend={pos}>
      {(pos === 'top' || pos === 'left') && legend}
      <div className="min-w-0 flex-1">{children}</div>
      {(pos === 'bottom' || pos === 'right') && legend}
    </div>
  )
}

function Legend({ names, colors, vertical }: { names: string[]; colors: string[]; vertical?: boolean }) {
  return (
    <div className={cn('flex px-1 text-xs opacity-80', vertical ? 'max-w-[180px] shrink-0 flex-col gap-1.5' : 'flex-wrap justify-center gap-x-4 gap-y-1')} data-testid="chart-legend">
      {names.map((n, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colors[i] }} />
          {n}
        </span>
      ))}
    </div>
  )
}

/** Tall segmented bar for "parts of a whole" (instead of a pie). */
function PartsBar({ spec, theme }: { spec: ChartSpec; theme: Theme }) {
  const parts = partsOf(spec)
  const colors = parts.map((p, rank) => partColor(spec, p.index, rank, theme))
  const total = parts.reduce((s, p) => s + p.value, 0)
  const [hover, setHover] = useState<number | null>(null)
  if (!parts.length || total <= 0) return <div className="py-6 text-center text-sm opacity-50">Add positive values to show parts of a whole.</div>
  const shown = hover !== null ? parts[hover] : null
  return (
    <div className="w-full px-1 py-2">
      <div className="mb-2 flex items-baseline gap-2 text-sm">
        <span className="opacity-60">{spec.series[0]?.name || 'Total'}</span>
        <span className="text-lg font-semibold tabular-nums">{formatValue(total, spec.format)}</span>
        {shown && (
          <span className="ml-auto text-xs opacity-80">
            {shown.label}: <b className="tabular-nums">{formatValue(shown.value, spec.format)}</b> ({((shown.value / total) * 100).toFixed(1)}%)
          </span>
        )}
      </div>
      <div className="flex h-7 w-full gap-[2px]" role="img" aria-label={parts.map((p) => `${p.label} ${formatValue(p.value, spec.format)}`).join(', ')}>
        {parts.map((p, i) => (
          <div
            key={i}
            tabIndex={0}
            aria-label={`${p.label}: ${formatValue(p.value, spec.format)} (${((p.value / total) * 100).toFixed(1)}%)`}
            title={`${p.label}: ${formatValue(p.value, spec.format)} (${((p.value / total) * 100).toFixed(1)}%)`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className="h-full rounded-[4px] outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-blue-400"
            style={{
              width: `${(p.value / total) * 100}%`,
              background: colors[i],
              opacity: hover !== null && hover !== i ? 0.55 : 1,
            }}
          />
        ))}
      </div>
      {(spec.format?.legend ?? 'bottom') !== 'none' && (
        <div className="mt-2.5">
          <Legend names={parts.map((p) => (spec.format?.dataLabels ? `${p.label} · ${formatValue(p.value, spec.format)}` : p.label))} colors={colors} />
        </div>
      )}
    </div>
  )
}

/** Series name drawn at the last point of a line (direct label). */
function endLabel(name: string, count: number, color: string) {
  return function EndLabel(props: { x?: number; y?: number; index?: number }) {
    if (props.index !== count - 1) return <g />
    return (
      <text x={(props.x ?? 0) + 10} y={(props.y ?? 0) + 4} fill={color} fontSize={12}>
        {truncate(name, 12)}
      </text>
    )
  }
}


function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

/** Pie (or donut) chart of the first series, with percentage labels and a legend. */
function PieView({ spec, theme }: { spec: ChartSpec; theme: Theme }) {
  const t = CHART_TOKENS[theme]
  const parts = partsOf(spec)
  const total = parts.reduce((s, p) => s + p.value, 0)
  const colors = parts.map((p, rank) => partColor(spec, p.index, rank, theme))
  const [hover, setHover] = useState<number | null>(null)
  if (!parts.length || total <= 0) return <div className="py-6 text-center text-sm opacity-50">Add positive values to draw the pie.</div>
  const pct = (v: number) => (v / total) * 100
  const fmtPct = (v: number) => `${pct(v) < 10 ? pct(v).toFixed(1) : Math.round(pct(v))}%`
  const shown = hover !== null ? parts[hover] : null
  const pieLegend = spec.format?.legend ?? 'right'
  const pieLabelPos = labelPositionOf(spec)
  return (
    <div className="w-full">
      <div
        data-legend={pieLegend}
        className={cn(
          'flex items-center gap-4',
          pieLegend === 'left' || pieLegend === 'right' ? 'flex-col sm:flex-row sm:justify-center' : 'flex-col',
          (pieLegend === 'left' || pieLegend === 'top') && (pieLegend === 'left' ? 'sm:flex-row-reverse' : 'flex-col-reverse'),
        )}
      >
        <div className="relative h-[280px] w-full max-w-[360px]" role="img" aria-label={parts.map((p) => `${p.label} ${fmtPct(p.value)}`).join(', ')}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={parts}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={pieLabelPos === 'outside' && spec.format?.dataLabels !== false ? '64%' : '78%'}
                innerRadius={spec.donut ? '50%' : 0}
                startAngle={90}
                endAngle={-270}
                paddingAngle={parts.length > 1 ? 1 : 0}
                stroke={t.surface}
                strokeWidth={2}
                isAnimationActive={false}
                labelLine={false}
                label={(props: { cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; value?: number; index?: number }) => {
                  const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, value = 0, index = 0 } = props
                  if (pct(value) < 4 || spec.format?.dataLabels === false) return null
                  const what = spec.format?.pieLabel ?? 'percent'
                  const text = what === 'value' ? formatValue(value, spec.format) : what === 'both' ? `${formatValue(value, spec.format)} (${fmtPct(value)})` : fmtPct(value)
                  const outside = pieLabelPos === 'outside'
                  const share = { 'inside-end': 0.84, center: spec.donut ? 0.5 : 0.62, 'inside-base': spec.donut ? 0.2 : 0.35, outside: 1 }[pieLabelPos]
                  const r = outside ? outerRadius + 14 : innerRadius + (outerRadius - innerRadius) * share
                  const cos = Math.cos((-midAngle * Math.PI) / 180)
                  const x = cx + r * cos
                  const y = cy + r * Math.sin((-midAngle * Math.PI) / 180)
                  return (
                    <text
                      x={x}
                      y={y}
                      fill={outside ? t.textSecondary : textOn(colors[index])}
                      textAnchor={outside ? (cos >= 0 ? 'start' : 'end') : 'middle'}
                      dominantBaseline="central"
                      fontSize={12}
                      fontWeight={600}
                      style={{ pointerEvents: 'none' }}
                    >
                      {text}
                    </text>
                  )
                }}
                onMouseEnter={(_: unknown, i: number) => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {parts.map((p, i) => (
                  <Cell key={p.index} fill={colors[i]} opacity={hover !== null && hover !== i ? 0.55 : 1} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {spec.donut && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs opacity-60">{shown ? shown.label : spec.series[0]?.name || 'Total'}</span>
              <span className="text-lg font-semibold tabular-nums">{shown ? fmtPct(shown.value) : formatValue(total, spec.format)}</span>
            </div>
          )}
        </div>
        {pieLegend !== 'none' && (
        <ul className={cn('min-w-[160px] gap-1.5 text-sm', pieLegend === 'top' || pieLegend === 'bottom' ? 'flex flex-wrap justify-center gap-x-4' : 'flex flex-col')} data-testid="chart-legend">
          {parts.map((p, i) => (
            <li
              key={p.index}
              className="flex items-center gap-2 rounded px-1 transition-opacity"
              style={{ opacity: hover !== null && hover !== i ? 0.55 : 1 }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: colors[i] }} />
              <span className="flex-1 truncate">{p.label}</span>
              <span className="tabular-nums opacity-70">{fmtPct(p.value)}</span>
            </li>
          ))}
        </ul>
        )}
      </div>
      {shown && !spec.donut && (
        <div className="mt-1 text-center text-xs opacity-80">
          {shown.label}: <b className="tabular-nums">{formatValue(shown.value, spec.format)}</b> ({fmtPct(shown.value)})
        </div>
      )}
    </div>
  )
}
