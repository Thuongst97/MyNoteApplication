import { AlignCenterHorizontal, ArrowDownToLine, ArrowLeftToLine, ArrowRightToLine, ArrowUpToLine, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CURRENCIES, NUMBER_FORMATS, labelPositionOf, labelPositions, type LabelPosition, type ChartFormat, type ChartHeight, type ChartSpec, type LegendPosition, type NumberFormat, type PieLabel } from './chartModel'

const LEGEND_OPTIONS: Array<{ id: LegendPosition; label: string; icon: typeof EyeOff }> = [
  { id: 'top', label: 'Top', icon: ArrowUpToLine },
  { id: 'bottom', label: 'Bottom', icon: ArrowDownToLine },
  { id: 'left', label: 'Left', icon: ArrowLeftToLine },
  { id: 'right', label: 'Right', icon: ArrowRightToLine },
  { id: 'none', label: 'None', icon: EyeOff },
]

/**
 * Chart formatting (like Excel / PowerPoint "Format chart"): legend position, data labels,
 * gridlines, axis titles, number format, stacking, smooth lines and size.
 */
export function ChartFormatPanel({ draft, onChange }: { draft: ChartSpec; onChange: (f: ChartFormat) => void }) {
  const f = draft.format ?? {}
  const set = (patch: Partial<ChartFormat>) => onChange({ ...f, ...patch })
  const cartesian = draft.type !== 'pie' && draft.type !== 'parts'
  const multi = draft.series.length >= 2
  const legend = f.legend ?? (draft.type === 'pie' ? 'right' : draft.type === 'parts' ? 'bottom' : multi ? 'top' : 'none')
  const legendChoices = draft.type === 'parts' ? LEGEND_OPTIONS.filter((o) => o.id === 'bottom' || o.id === 'none') : LEGEND_OPTIONS
  const dataLabels = f.dataLabels ?? draft.type === 'pie'

  return (
    <div className="mt-3 grid gap-x-6 gap-y-4 rounded-md border border-black/10 bg-white p-3 text-sm sm:grid-cols-2 dark:border-white/10 dark:bg-[#191919]" data-testid="chart-format">
      <Field label="Legend">
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Legend position">
          {legendChoices.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={legend === o.id}
              onClick={() => set({ legend: o.id })}
              className={chip(legend === o.id)}
            >
              <o.icon size={13} /> {o.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Data labels">
        <div className="flex flex-wrap items-center gap-2">
          <Toggle checked={dataLabels} onChange={(v) => set({ dataLabels: v })} label="Show values on the chart" />
          {dataLabels && draft.type !== 'parts' && (
            <select aria-label="Label position" value={labelPositionOf(draft)} onChange={(e) => set({ labelPosition: e.target.value as LabelPosition })} className={select}>
              {labelPositions(draft.type).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {draft.type === 'pie' && dataLabels && (
            <select aria-label="Slice labels show" value={f.pieLabel ?? 'percent'} onChange={(e) => set({ pieLabel: e.target.value as PieLabel })} className={select}>
              <option value="percent">Percent</option>
              <option value="value">Value</option>
              <option value="both">Value and percent</option>
            </select>
          )}
        </div>
      </Field>

      <Field label="Number format">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Number format" value={f.numberFormat ?? 'number'} onChange={(e) => set({ numberFormat: e.target.value as NumberFormat })} className={select}>
            {NUMBER_FORMATS.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
          {f.numberFormat === 'currency' && (
            <select aria-label="Currency symbol" value={f.currency ?? '$'} onChange={(e) => set({ currency: e.target.value })} className={select}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Decimals"
            value={f.decimals ?? 'auto'}
            onChange={(e) => set({ decimals: e.target.value === 'auto' ? undefined : Number(e.target.value) })}
            className={select}
          >
            <option value="auto">Decimals: auto</option>
            {[0, 1, 2, 3].map((d) => (
              <option key={d} value={d}>
                {d} decimal{d === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </div>
      </Field>

      <Field label="Size">
        <div className="flex gap-1" role="radiogroup" aria-label="Chart height">
          {(['small', 'medium', 'large'] as ChartHeight[]).map((h) => (
            <button key={h} type="button" role="radio" aria-checked={(f.height ?? 'medium') === h} onClick={() => set({ height: h })} className={chip((f.height ?? 'medium') === h)}>
              {h[0].toUpperCase() + h.slice(1)}
            </button>
          ))}
        </div>
      </Field>

      {cartesian && (
        <>
          <Field label="Axis titles">
            <div className="flex flex-col gap-1.5">
              <input value={f.xTitle ?? ''} onChange={(e) => set({ xTitle: e.target.value || undefined })} placeholder="Horizontal axis title" aria-label="Horizontal axis title" className={input} />
              <input value={f.yTitle ?? ''} onChange={(e) => set({ yTitle: e.target.value || undefined })} placeholder="Vertical axis title" aria-label="Vertical axis title" className={input} />
            </div>
          </Field>
          <Field label="Style">
            <div className="flex flex-col gap-1.5">
              <Toggle checked={f.gridlines !== false} onChange={(v) => set({ gridlines: v })} label="Gridlines" />
              {(draft.type === 'bar' || draft.type === 'hbar') && (
                <Toggle checked={!!f.stacked} onChange={(v) => set({ stacked: v || undefined })} label="Stacked (series on top of each other)" />
              )}
              {(draft.type === 'line' || draft.type === 'area') && <Toggle checked={!!f.smooth} onChange={(v) => set({ smooth: v || undefined })} label="Smooth lines" />}
            </div>
          </Field>
        </>
      )}
      <div className="flex items-center gap-1.5 text-xs opacity-50 sm:col-span-2">
        <AlignCenterHorizontal size={12} /> The preview below updates as you change the format.
      </div>
    </div>
  )
}

const select = 'rounded-md border border-black/10 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400 dark:border-white/10 dark:bg-[#202020]'
const input = 'w-full rounded-md border border-black/10 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400 dark:border-white/10 dark:bg-[#202020]'
const chip = (on: boolean) =>
  cn(
    'flex items-center gap-1 rounded-md border px-2 py-1 text-xs',
    on ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'border-black/10 hover:bg-black/[0.04] dark:border-white/10 dark:hover:bg-white/[0.06]',
  )

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wide opacity-50">{label}</div>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-blue-500" />
      {label}
    </label>
  )
}
