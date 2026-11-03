import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { BlockEditPanel } from '../BlockEditPanel'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import {
  AreaChart as AreaIcon,
  BarChart3,
  BarChartHorizontal,
  Check,
  ClipboardPaste,
  Code2,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Loader2,
  Plus,
  Rows3,
  Square,
  Table2,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useAppStore } from '@/stores/useAppStore'
import { cn, isMacLike } from '@/lib/utils'
import { placeCursorAfter } from '../mermaid/MermaidNode'
import {
  CHART_TYPES,
  MAX_SERIES,
  formatValue,
  normalizeFormat,
  normalizeSpec,
  partColor,
  partsOf,
  parseTable,
  seriesColor,
  toNumber,
  type ChartSpec,
  type ChartType,
} from './chartModel'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { ChartFormatPanel } from './ChartFormatPanel'

const ChartRender = lazy(() => import('./ChartRender'))

const TYPE_ICONS: Record<ChartType, LucideIcon> = {
  bar: BarChart3,
  hbar: BarChartHorizontal,
  line: LineIcon,
  area: AreaIcon,
  pie: PieIcon,
  parts: Rows3,
}

export function ChartView({ node, updateAttributes, deleteNode, selected, editor, getPos }: NodeViewProps) {
  const theme = useAppStore((s) => s.theme)
  const spec = useMemo(() => normalizeSpec(node.attrs.spec), [node.attrs.spec])
  const [editing, setEditing] = useState<boolean>(!!node.attrs.isNew && editor.isEditable)
  const [draft, setDraft] = useState<ChartSpec>(spec)
  const [showTable, setShowTable] = useState(false)
  const align = node.attrs.align as string

  useEffect(() => {
    if (!editing) setDraft(spec)
  }, [spec, editing])

  const leave = () =>
    requestAnimationFrame(() => {
      const pos = getPos()
      if (typeof pos === 'number' && !editor.isDestroyed) placeCursorAfter(editor, pos + editor.state.doc.nodeAt(pos)!.nodeSize)
    })

  const save = () => {
    updateAttributes({ spec: normalizeSpec(draft), isNew: false })
    setEditing(false)
    leave()
  }
  const cancel = () => {
    if (node.attrs.isNew) updateAttributes({ isNew: false })
    setDraft(spec)
    setEditing(false)
    leave()
  }

  return (
    <NodeViewWrapper
      data-drag-handle
      className={cn(
        'chart-block group/chart relative my-3 rounded-lg border transition-colors',
        editing || selected
          ? 'border-blue-400/70'
          : spec.border
            ? 'border-black/15 dark:border-white/15'
            : 'border-transparent hover:border-black/10 dark:hover:border-white/10',
      )}
    >
      {editing ? (
        <BlockEditPanel title="chart">
        <ChartEditor draft={draft} setDraft={setDraft} theme={theme} onSave={save} onCancel={cancel} />
        </BlockEditPanel>
      ) : (
        <div contentEditable={false} onDoubleClick={() => editor.isEditable && setEditing(true)} className="relative px-3 py-3">
          <div
            className={cn('mx-auto', align === 'left' && 'ml-0', align === 'right' && 'mr-0')}
            style={{
              maxWidth: spec.type === 'parts' || spec.type === 'pie' ? 640 : 760,
            }}
          >
            {spec.title && <div className="mb-2 px-1 text-[15px] font-semibold">{spec.title}</div>}
            <ChartPreview spec={spec} theme={theme} />
            {showTable && <DataTable spec={spec} />}
          </div>
          {editor.isEditable && (
            <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover/chart:opacity-100">
              <ToolbarButton label={showTable ? 'Hide data table' : 'Show data table'} active={showTable} onClick={() => setShowTable((v) => !v)}>
                <Table2 size={14} /> Table
              </ToolbarButton>
              <ToolbarButton
                label={spec.border ? 'Hide border' : 'Show border'}
                active={!!spec.border}
                onClick={() => updateAttributes({ spec: normalizeSpec({ ...spec, border: !spec.border }) })}
              >
                <Square size={14} /> Border
              </ToolbarButton>
              <ToolbarButton label="Edit chart" onClick={() => setEditing(true)}>
                <Code2 size={14} /> Edit
              </ToolbarButton>
              <ToolbarButton label="Delete chart" onClick={deleteNode}>
                <Trash2 size={14} />
              </ToolbarButton>
            </div>
          )}
        </div>
      )}
    </NodeViewWrapper>
  )
}

function ChartPreview({ spec, theme }: { spec: ChartSpec; theme: 'light' | 'dark' }) {
  const hasData = spec.labels.length > 0 && spec.series.some((s) => s.values.some((v) => v !== null))
  if (!hasData) return <div className="py-10 text-center text-sm opacity-50">Add some data to see the chart.</div>
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 py-10 text-sm opacity-50">
          <Loader2 size={14} className="animate-spin" /> Loading chart…
        </div>
      }
    >
      <ChartRender spec={spec} theme={theme} />
    </Suspense>
  )
}

/** Read-only table view of the data (accessibility / exact values). */
function DataTable({ spec }: { spec: ChartSpec }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10">
            <th className="px-2 py-1.5 text-left font-medium opacity-60"></th>
            {spec.series.map((s, i) => (
              <th key={i} className="px-2 py-1.5 text-right font-medium opacity-80">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.labels.map((l, r) => (
            <tr key={r} className="border-b border-black/5 dark:border-white/5">
              <td className="px-2 py-1.5">{l}</td>
              {spec.series.map((s, i) => (
                <td key={i} className="px-2 py-1.5 text-right tabular-nums">
                  {formatValue(s.values[r], spec.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ChartEditorProps {
  draft: ChartSpec
  setDraft: React.Dispatch<React.SetStateAction<ChartSpec>>
  theme: 'light' | 'dark'
  onSave: () => void
  onCancel: () => void
}

function ChartEditor({ draft, setDraft, theme, onSave, onCancel }: ChartEditorProps) {
  const [tab, setTab] = useState<'data' | 'format'>('data')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const mod = isMacLike() ? '⌘' : 'Ctrl'
  const byRow = draft.type === 'pie' || draft.type === 'parts'
  // Pie / parts colors follow each row; automatic colors depend on the row's rank by value.
  const rowColors = useMemo(() => {
    const spec = normalizeSpec(draft)
    const out = spec.labels.map(() => null as string | null)
    partsOf(spec).forEach((p, rank) => p.index >= 0 && (out[p.index] = partColor(spec, p.index, rank, theme)))
    return out
  }, [draft, theme])

  const update = (fn: (d: ChartSpec) => ChartSpec) => setDraft((d) => fn(structuredClone(d)))
  const setCell = (series: number, row: number, raw: string) =>
    update((d) => {
      d.series[series].values[row] = toNumber(raw)
      return d
    })

  const applyPaste = () => {
    const parsed = parseTable(pasteText)
    if (!parsed) {
      setPasteError('Paste at least a header row and one data row (first column = labels).')
      return
    }
    // New rows: row colors no longer match, series colors are kept.
    update((d) => ({ ...d, ...parsed, labelColors: undefined }))
    setPasteOpen(false)
    setPasteText('')
    setPasteError(null)
  }

  return (
    <div
      contentEditable={false}
      className="no-drag rounded-lg bg-[#f7f6f3] p-3 dark:bg-[#202020]"
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          onSave()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={draft.title}
          onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
          placeholder="Chart title"
          className="min-w-[180px] flex-1 rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-sm font-medium outline-none focus:border-blue-400 dark:border-white/10 dark:bg-[#191919]"
        />
        <div className="flex rounded-md border border-black/10 bg-white p-0.5 dark:border-white/10 dark:bg-[#191919]">
          {CHART_TYPES.map((t) => {
            const Icon = TYPE_ICONS[t.id]
            return (
              <button
                key={t.id}
                type="button"
                title={`${t.label} — ${t.hint}`}
                aria-label={t.label}
                aria-pressed={draft.type === t.id}
                onClick={() => update((d) => ({ ...d, type: t.id }))}
                className={cn(
                  'flex items-center gap-1 rounded px-2 py-1 text-xs',
                  draft.type === t.id ? 'bg-blue-500 text-white' : 'hover:bg-black/5 dark:hover:bg-white/10',
                )}
              >
                <Icon size={14} /> <span className="hidden xl:inline">{t.label}</span>
              </button>
            )
          })}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-black/10 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-[#191919]">
          <input type="checkbox" checked={!!draft.border} onChange={(e) => update((d) => ({ ...d, border: e.target.checked }))} />
          Border
        </label>
        {draft.type === 'pie' && (
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-black/10 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-[#191919]">
            <input type="checkbox" checked={!!draft.donut} onChange={(e) => update((d) => ({ ...d, donut: e.target.checked }))} />
            Donut
          </label>
        )}
      </div>
      <div className="mt-3 flex gap-1 border-b border-black/10 dark:border-white/10" role="tablist" aria-label="Chart editor">
        {(['data', 'format'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn('-mb-px border-b-2 px-3 py-1.5 text-xs font-medium', tab === t ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent opacity-60 hover:opacity-100')}
          >
            {t === 'data' ? 'Data' : 'Format'}
          </button>
        ))}
      </div>
      {tab === 'format' && <ChartFormatPanel draft={draft} onChange={(format) => update((d) => ({ ...d, format: normalizeFormat(format) }))} />}
      {tab === 'data' && byRow && (
        <div className="mt-2 text-xs opacity-60">
          Each row is one {draft.type === 'pie' ? 'slice' : 'part'} (values from the first series). Click a row's color square to change its color.
        </div>
      )}

      {/* Data grid */}
      {tab === 'data' && (
      <div className="mt-3 max-h-[300px] overflow-auto rounded-md border border-black/10 bg-white dark:border-white/10 dark:bg-[#191919]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 w-[30%] border-b border-black/10 bg-inherit px-2 py-1 text-left text-xs font-medium opacity-60 dark:border-white/10">
                Label
              </th>
              {draft.series.map((s, i) => (
                <th key={i} className="sticky top-0 z-10 border-b border-l border-black/10 bg-white p-0 dark:border-white/10 dark:bg-[#191919]">
                  <div className="flex items-center gap-1 px-1.5">
                    {byRow ? (
                      i === 0 ? null : (
                        <span className="text-[10px] opacity-40" title="Pie and parts charts use the first series">
                          unused
                        </span>
                      )
                    ) : (
                      <ColorPicker
                        label={s.name || `Series ${i + 1}`}
                        color={seriesColor(draft, i, theme)}
                        custom={draft.seriesColors?.[i]}
                        onChange={(c) =>
                          update((d) => {
                            const list = d.series.map((_, k) => d.seriesColors?.[k] ?? null)
                            list[i] = c
                            d.seriesColors = list
                            return d
                          })
                        }
                      />
                    )}
                    <input
                      value={s.name}
                      onChange={(e) => update((d) => ((d.series[i].name = e.target.value), d))}
                      aria-label={`Series ${i + 1} name`}
                      className="w-full min-w-[60px] bg-transparent py-1 text-xs font-medium outline-none"
                    />
                    {draft.series.length > 1 && (
                      <button
                        type="button"
                        title="Remove series"
                        aria-label={`Remove series ${s.name}`}
                        onClick={() =>
                          update((d) => {
                            d.series = d.series.filter((_, k) => k !== i)
                            if (d.seriesColors) d.seriesColors = d.seriesColors.filter((_, k) => k !== i)
                            return d
                          })
                        }
                        className="rounded p-0.5 opacity-40 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="sticky top-0 z-10 w-8 border-b border-l border-black/10 bg-white dark:border-white/10 dark:bg-[#191919]">
                <button
                  type="button"
                  title={draft.series.length >= MAX_SERIES ? `At most ${MAX_SERIES} series` : 'Add series'}
                  aria-label="Add series"
                  disabled={draft.series.length >= MAX_SERIES}
                  onClick={() =>
                    update((d) => {
                      d.series.push({
                        name: `Series ${d.series.length + 1}`,
                        values: d.labels.map(() => null),
                      })
                      d.seriesColors?.push(null)
                      return d
                    })
                  }
                  className="flex h-6 w-full items-center justify-center opacity-50 hover:opacity-100 disabled:opacity-20"
                >
                  <Plus size={14} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.labels.map((label, r) => (
              <tr key={r} className="group/row">
                <td className="border-b border-black/5 p-0 dark:border-white/5">
                  <div className="flex items-center">
                    {byRow && (
                      <span className="pl-2">
                        <ColorPicker
                          label={label || `Row ${r + 1}`}
                          color={rowColors[r] ?? '#a3a29e'}
                          custom={draft.labelColors?.[r]}
                          onChange={(c) =>
                            update((d) => {
                              const list = d.labels.map((_, k) => d.labelColors?.[k] ?? null)
                              list[r] = c
                              d.labelColors = list
                              return d
                            })
                          }
                        />
                      </span>
                    )}
                    <input
                      value={label}
                      onChange={(e) => update((d) => ((d.labels[r] = e.target.value), d))}
                      aria-label={`Row ${r + 1} label`}
                      className="w-full bg-transparent px-2 py-1 outline-none focus:bg-blue-500/5"
                    />
                  </div>
                </td>
                {draft.series.map((s, i) => (
                  <td key={i} className="border-b border-l border-black/5 p-0 dark:border-white/5">
                    <input
                      inputMode="decimal"
                      defaultValue={s.values[r] ?? ''}
                      key={`${r}-${i}-${s.values[r]}`}
                      onBlur={(e) => setCell(i, r, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                      aria-label={`${s.name}, ${label || `row ${r + 1}`}`}
                      className="w-full bg-transparent px-2 py-1 text-right tabular-nums outline-none focus:bg-blue-500/5"
                    />
                  </td>
                ))}
                <td className="border-b border-l border-black/5 text-center dark:border-white/5">
                  <button
                    type="button"
                    title="Remove row"
                    aria-label={`Remove row ${label}`}
                    onClick={() =>
                      update((d) => {
                        d.labels.splice(r, 1)
                        d.series.forEach((s) => s.values.splice(r, 1))
                        d.labelColors?.splice(r, 1)
                        return d
                      })
                    }
                    className="rounded p-0.5 opacity-0 hover:bg-black/5 group-hover/row:opacity-50 dark:hover:bg-white/10"
                  >
                    <X size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {tab === 'data' && (
        <>
        <SmallButton
          onClick={() =>
            update((d) => {
              d.labels.push('')
              d.series.forEach((s) => s.values.push(null))
              d.labelColors?.push(null)
              return d
            })
          }
        >
          <Plus size={13} /> Row
        </SmallButton>
        <SmallButton onClick={() => setPasteOpen((v) => !v)} active={pasteOpen}>
          <ClipboardPaste size={13} /> Paste from spreadsheet
        </SmallButton>
        </>
        )}
        <span className="ml-auto text-xs opacity-40">{mod}+Enter to save · Esc to cancel</span>
        <button type="button" onClick={onCancel} className="flex items-center gap-1 rounded-md px-2.5 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10">
          <X size={14} /> Cancel
        </button>
        <button type="button" onClick={onSave} className="flex items-center gap-1 rounded-md bg-blue-500 px-2.5 py-1 text-sm text-white hover:bg-blue-600">
          <Check size={14} /> Save
        </button>
      </div>

      {tab === 'data' && pasteOpen && (
        <div className="mt-2">
          <textarea
            autoFocus
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            placeholder={
              'Copy cells from Excel / Google Sheets / CSV and paste here.\nFirst row = series names, first column = labels, e.g.\nMonth\tSales\tTarget\nJan\t120\t100'
            }
            className="block w-full resize-y rounded-md border border-black/10 bg-white p-2 font-mono text-xs outline-none focus:border-blue-400 dark:border-white/10 dark:bg-[#191919]"
          />
          <div className="mt-1 flex items-center gap-2">
            {pasteError && <span className="text-xs text-red-600 dark:text-red-400">{pasteError}</span>}
            <SmallButton onClick={applyPaste} className="ml-auto">
              Use this data
            </SmallButton>
          </div>
        </div>
      )}

      <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
        <div className="mb-1 text-xs opacity-50">Preview</div>
        {draft.title && <div className="mb-2 px-1 text-[15px] font-semibold">{draft.title}</div>}
        <ChartPreview spec={normalizeSpec(draft)} theme={theme} />
      </div>
    </div>
  )
}

function SmallButton({ children, onClick, active, className }: { children: React.ReactNode; onClick: () => void; active?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-md border border-black/10 bg-white px-2 py-1 text-xs hover:bg-black/5 dark:border-white/10 dark:bg-[#191919] dark:hover:bg-white/10',
        active && 'border-blue-400 text-blue-600 dark:text-blue-400',
        className,
      )}
    >
      {children}
    </button>
  )
}

function ToolbarButton({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-md border border-black/10 bg-white/95 px-2 py-1 text-xs shadow-sm hover:bg-white dark:border-white/10 dark:bg-[#2a2a2a]/95 dark:hover:bg-[#333]',
        active && 'text-blue-600 dark:text-blue-400',
      )}
    >
      {children}
    </button>
  )
}
