import type { Theme } from '@/stores/useAppStore'

export type ChartType = 'bar' | 'hbar' | 'line' | 'area' | 'pie' | 'parts'

export interface ChartSeries {
  name: string
  values: Array<number | null>
}

export interface ChartSpec {
  type: ChartType
  title: string
  labels: string[]
  series: ChartSeries[]
  /** Pie only: draw as a donut (ring). */
  donut?: boolean
  /** Draw a frame around the chart in the page (on unless turned off). */
  border?: boolean
  /** Custom color per series (null = automatic). Used by columns, bars, line and area. */
  seriesColors?: Array<string | null>
  /** Custom color per row/label (null = automatic). Used by pie and parts of a whole. */
  labelColors?: Array<string | null>
  /** Look of the chart (legend, data labels, number format…); missing = defaults. */
  format?: ChartFormat
}

export type LegendPosition = 'top' | 'bottom' | 'left' | 'right' | 'none'
export type NumberFormat = 'number' | 'compact' | 'percent' | 'currency'
export type PieLabel = 'percent' | 'value' | 'both'
export type ChartHeight = 'small' | 'medium' | 'large'

export interface ChartFormat {
  /** Where the legend goes (default: on top, and only with several series). */
  legend?: LegendPosition
  /** Show each value on its bar / point / slice. */
  dataLabels?: boolean
  /** Pie: what slice labels show (default percent). */
  pieLabel?: PieLabel
  /** Horizontal (or vertical, for bars) gridlines (default on). */
  gridlines?: boolean
  xTitle?: string
  yTitle?: string
  numberFormat?: NumberFormat
  /** Currency symbol for numberFormat "currency". */
  currency?: string
  /** Fixed number of decimals (default: as needed, up to 2). */
  decimals?: number
  /** Columns/bars stacked on top of each other. */
  stacked?: boolean
  /** Lines drawn as smooth curves. */
  smooth?: boolean
  height?: ChartHeight
}

export const LEGEND_POSITIONS: LegendPosition[] = ['top', 'bottom', 'left', 'right', 'none']
export const NUMBER_FORMATS: Array<{ id: NumberFormat; label: string }> = [
  { id: 'number', label: 'Number (1,234.5)' },
  { id: 'compact', label: 'Compact (1.2K)' },
  { id: 'percent', label: 'Percent (12%)' },
  { id: 'currency', label: 'Currency ($1,234)' },
]
export const CURRENCIES = ['$', '€', '£', '¥', '₫', '₩', '₹']
export const CHART_HEIGHTS: Record<ChartHeight, number> = { small: 220, medium: 300, large: 420 }

/** A stored format with unknown values dropped. */
export function normalizeFormat(raw: unknown): ChartFormat | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const f: ChartFormat = {}
  if (LEGEND_POSITIONS.includes(r.legend as LegendPosition)) f.legend = r.legend as LegendPosition
  if (typeof r.dataLabels === 'boolean') f.dataLabels = r.dataLabels
  if (r.pieLabel === 'percent' || r.pieLabel === 'value' || r.pieLabel === 'both') f.pieLabel = r.pieLabel
  if (typeof r.gridlines === 'boolean') f.gridlines = r.gridlines
  if (typeof r.xTitle === 'string' && r.xTitle.trim()) f.xTitle = r.xTitle.slice(0, 80)
  if (typeof r.yTitle === 'string' && r.yTitle.trim()) f.yTitle = r.yTitle.slice(0, 80)
  if (NUMBER_FORMATS.some((n) => n.id === r.numberFormat)) f.numberFormat = r.numberFormat as NumberFormat
  if (typeof r.currency === 'string' && CURRENCIES.includes(r.currency)) f.currency = r.currency
  if (Number.isInteger(r.decimals) && (r.decimals as number) >= 0 && (r.decimals as number) <= 4) f.decimals = r.decimals as number
  if (r.stacked === true) f.stacked = true
  if (r.smooth === true) f.smooth = true
  if (r.height === 'small' || r.height === 'medium' || r.height === 'large') f.height = r.height
  return Object.keys(f).length ? f : undefined
}

/** A value written the way the chart's number format says (percent: 12 → "12%"). */
export function formatValue(n: number | null | undefined, f: ChartFormat | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–'
  const digits = f?.decimals
  const opts: Intl.NumberFormatOptions = digits !== undefined ? { minimumFractionDigits: digits, maximumFractionDigits: digits } : { maximumFractionDigits: 2 }
  switch (f?.numberFormat) {
    case 'compact':
      return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: digits ?? 1, minimumFractionDigits: digits ?? 0 }).format(n)
    case 'percent':
      return `${n.toLocaleString(undefined, opts)}%`
    case 'currency': {
      const sym = f.currency ?? '$'
      const body = Math.abs(n).toLocaleString(undefined, digits !== undefined ? opts : { maximumFractionDigits: 2 })
      return `${n < 0 ? '-' : ''}${sym}${body}`
    }
    default:
      return n.toLocaleString(undefined, opts)
  }
}

/** Short value for axis ticks (large numbers compact, with the format's unit). */
export function formatTick(n: number, f: ChartFormat | undefined): string {
  if (Math.abs(n) >= 10000 && f?.numberFormat !== 'compact') {
    const c = Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(n))
    const sign = n < 0 ? '-' : ''
    if (f?.numberFormat === 'currency') return `${sign}${f.currency ?? '$'}${c}`
    if (f?.numberFormat === 'percent') return `${sign}${c}%`
    return `${sign}${c}`
  }
  return formatValue(n, f && { ...f, decimals: undefined })
}

/** Categorical palette (fixed order, never cycled), validated against this app's surfaces. */
export const SERIES_COLORS: Record<Theme, string[]> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
}
export const MAX_SERIES = 8
/** "Parts of a whole" shows at most this many parts; the rest fold into "Other". */
export const MAX_PARTS = 6
/** A pie shows at most this many slices; the rest fold into "Other". */
export const MAX_SLICES = 8

/** Colors offered in the color picker (the chart palette plus a few neutrals and extras). */
export const COLOR_CHOICES = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
  '#0ea5b7',
  '#8b5a2b',
  '#7a7a7a',
  '#1f2937',
]
const HEX = /^#[0-9a-f]{6}$/i
export const isHexColor = (c: unknown): c is string => typeof c === 'string' && HEX.test(c)

/** Black or white, whichever reads better on `hex`. */
export function textOn(hex: string): string {
  if (!isHexColor(hex)) return '#ffffff'
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.4 ? '#1f1f1f' : '#ffffff'
}

/** The color of series `i` (custom or palette). */
export function seriesColor(spec: ChartSpec, i: number, theme: Theme): string {
  const c = spec.seriesColors?.[i]
  return isHexColor(c) ? c : SERIES_COLORS[theme][i % SERIES_COLORS[theme].length]
}

/** The color of a slice/part: the label's custom color, else the palette color for its rank. */
export function partColor(spec: ChartSpec, labelIndex: number, rank: number, theme: Theme): string {
  const c = labelIndex >= 0 ? spec.labelColors?.[labelIndex] : null
  if (isHexColor(c)) return c
  if (labelIndex < 0) return theme === 'dark' ? '#6b6b6b' : '#a3a29e' // "Other"
  return SERIES_COLORS[theme][rank % SERIES_COLORS[theme].length]
}

export const CHART_TOKENS: Record<Theme, { surface: string; grid: string; textSecondary: string; textMuted: string }> = {
  light: {
    surface: '#ffffff',
    grid: '#ebebea',
    textSecondary: '#52514e',
    textMuted: '#8a8984',
  },
  dark: {
    surface: '#191919',
    grid: '#2f2f2f',
    textSecondary: '#c3c2b7',
    textMuted: '#8a897f',
  },
}

export const CHART_TYPES: Array<{
  id: ChartType
  label: string
  hint: string
}> = [
  { id: 'bar', label: 'Columns', hint: 'Compare values across categories' },
  { id: 'hbar', label: 'Bars', hint: 'Compare categories with long names' },
  { id: 'line', label: 'Line', hint: 'Show change over time' },
  { id: 'area', label: 'Area', hint: 'Show totals over time (stacked)' },
  {
    id: 'pie',
    label: 'Pie',
    hint: 'Share of a total as slices (first series)',
  },
  {
    id: 'parts',
    label: 'Parts of a whole',
    hint: 'One total split into parts (first series)',
  },
]

export const DEFAULT_CHART: ChartSpec = {
  type: 'bar',
  title: 'Quarterly results',
  labels: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [
    { name: 'Revenue', values: [120, 150, 170, 210] },
    { name: 'Costs', values: [90, 100, 115, 130] },
  ],
}

/** Makes sure a stored spec is well-formed (rows/columns line up, numbers are numbers). */
export function normalizeSpec(raw: unknown): ChartSpec {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ChartSpec>
  const labels = Array.isArray(r.labels) ? r.labels.map((l) => String(l ?? '')) : [...DEFAULT_CHART.labels]
  const series = (Array.isArray(r.series) && r.series.length ? r.series : DEFAULT_CHART.series).slice(0, MAX_SERIES).map((s, i) => ({
    name: String(s?.name ?? `Series ${i + 1}`),
    values: labels.map((_, j) => toNumber(s?.values?.[j])),
  }))
  const type = CHART_TYPES.some((t) => t.id === r.type) ? (r.type as ChartType) : 'bar'
  const colors = (list: unknown, n: number) => Array.from({ length: n }, (_, i) => (Array.isArray(list) && isHexColor(list[i]) ? (list[i] as string) : null))
  const out: ChartSpec = { type, title: String(r.title ?? ''), labels, series }
  if (r.donut === true) out.donut = true
  // On by default (also for charts made before the option existed); only an explicit false turns it off.
  out.border = r.border !== false
  const sc = colors(r.seriesColors, series.length)
  const lc = colors(r.labelColors, labels.length)
  if (sc.some(Boolean)) out.seriesColors = sc
  if (lc.some(Boolean)) out.labelColors = lc
  const format = normalizeFormat(r.format)
  if (format) out.format = format
  return out
}

export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[\s,%$€£¥]/g, ''))
  return Number.isFinite(n) ? n : null
}

/**
 * Parses data pasted from Excel/Google Sheets/Numbers (tab-separated) or CSV.
 * First row = series names, first column = labels.
 */
export function parseTable(text: string): Pick<ChartSpec, 'labels' | 'series'> | null {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .filter((l) => l.trim() !== '')
  if (lines.length < 2) return null
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') && !lines[0].includes(',') ? ';' : ','
  const rows = lines.map((l) => splitRow(l, sep))
  const header = rows[0]
  const names = header
    .slice(1)
    .map((h, i) => h.trim() || `Series ${i + 1}`)
    .slice(0, MAX_SERIES)
  if (names.length === 0) return null
  const body = rows.slice(1)
  return {
    labels: body.map((r) => (r[0] ?? '').trim()),
    series: names.map((name, i) => ({
      name,
      values: body.map((r) => toNumber(r[i + 1])),
    })),
  }
}

function splitRow(line: string, sep: string): string[] {
  if (sep === '\t') return line.split('\t')
  // Minimal CSV: supports quoted cells containing the separator.
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"'
        i++
      } else quoted = !quoted
    } else if (ch === sep && !quoted) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

export interface Part {
  label: string
  value: number
  /** Row index in the data, or -1 for the combined "Other" part. */
  index: number
}

/** Data for "parts of a whole" and pie charts: first series, largest first, the smallest folded into "Other". */
export function partsOf(spec: ChartSpec, max = spec.type === 'pie' ? MAX_SLICES : MAX_PARTS): Part[] {
  const s = spec.series[0]
  const parts = spec.labels
    .map((label, i) => ({
      label: label || `Item ${i + 1}`,
      value: Math.max(0, s?.values[i] ?? 0),
      index: i,
    }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value)
  if (parts.length > max) {
    const keep = parts.slice(0, max - 1)
    const other = parts.slice(max - 1).reduce((sum, p) => sum + p.value, 0)
    return [...keep, { label: 'Other', value: other, index: -1 }]
  }
  return parts
}

export function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return '–'
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
