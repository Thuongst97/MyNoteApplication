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
  /** Custom color per series (null = automatic). Used by columns, bars, line and area. */
  seriesColors?: Array<string | null>
  /** Custom color per row/label (null = automatic). Used by pie and parts of a whole. */
  labelColors?: Array<string | null>
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
  const sc = colors(r.seriesColors, series.length)
  const lc = colors(r.labelColors, labels.length)
  if (sc.some(Boolean)) out.seriesColors = sc
  if (lc.some(Boolean)) out.labelColors = lc
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
