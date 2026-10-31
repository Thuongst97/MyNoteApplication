import type { Theme } from '@/stores/useAppStore'

export type ChartType = 'bar' | 'hbar' | 'line' | 'area' | 'parts'

export interface ChartSeries {
  name: string
  values: Array<number | null>
}

export interface ChartSpec {
  type: ChartType
  title: string
  labels: string[]
  series: ChartSeries[]
}

/** Categorical palette (fixed order, never cycled), validated against this app's surfaces. */
export const SERIES_COLORS: Record<Theme, string[]> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
}
export const MAX_SERIES = 8
/** "Parts of a whole" shows at most this many parts; the rest fold into "Other". */
export const MAX_PARTS = 6

export const CHART_TOKENS: Record<Theme, { surface: string; grid: string; textSecondary: string; textMuted: string }> = {
  light: { surface: '#ffffff', grid: '#ebebea', textSecondary: '#52514e', textMuted: '#8a8984' },
  dark: { surface: '#191919', grid: '#2f2f2f', textSecondary: '#c3c2b7', textMuted: '#8a897f' },
}

export const CHART_TYPES: Array<{ id: ChartType; label: string; hint: string }> = [
  { id: 'bar', label: 'Columns', hint: 'Compare values across categories' },
  { id: 'hbar', label: 'Bars', hint: 'Compare categories with long names' },
  { id: 'line', label: 'Line', hint: 'Show change over time' },
  { id: 'area', label: 'Area', hint: 'Show totals over time (stacked)' },
  { id: 'parts', label: 'Parts of a whole', hint: 'One total split into parts (first series)' },
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
  const series = (Array.isArray(r.series) && r.series.length ? r.series : DEFAULT_CHART.series)
    .slice(0, MAX_SERIES)
    .map((s, i) => ({
      name: String(s?.name ?? `Series ${i + 1}`),
      values: labels.map((_, j) => toNumber(s?.values?.[j])),
    }))
  const type = CHART_TYPES.some((t) => t.id === r.type) ? (r.type as ChartType) : 'bar'
  return { type, title: String(r.title ?? ''), labels, series }
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
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '')
  if (lines.length < 2) return null
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') && !lines[0].includes(',') ? ';' : ','
  const rows = lines.map((l) => splitRow(l, sep))
  const header = rows[0]
  const names = header.slice(1).map((h, i) => h.trim() || `Series ${i + 1}`).slice(0, MAX_SERIES)
  if (names.length === 0) return null
  const body = rows.slice(1)
  return {
    labels: body.map((r) => (r[0] ?? '').trim()),
    series: names.map((name, i) => ({ name, values: body.map((r) => toNumber(r[i + 1])) })),
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

/** Data for the "parts of a whole" bar: first series, top parts + "Other". */
export function partsOf(spec: ChartSpec) {
  const s = spec.series[0]
  const parts = spec.labels
    .map((label, i) => ({ label: label || `Item ${i + 1}`, value: Math.max(0, s?.values[i] ?? 0) }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value)
  if (parts.length > MAX_PARTS) {
    const keep = parts.slice(0, MAX_PARTS - 1)
    const other = parts.slice(MAX_PARTS - 1).reduce((sum, p) => sum + p.value, 0)
    return [...keep, { label: 'Other', value: other }]
  }
  return parts
}

export function formatNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return '–'
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
