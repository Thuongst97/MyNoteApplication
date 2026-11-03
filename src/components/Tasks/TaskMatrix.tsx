import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Plus } from 'lucide-react'
import type { Task } from '@/types'
import { QUADRANTS, quadrantOf, type Quadrant } from '@/lib/reminders'
import { useTaskStore } from '@/stores/useTaskStore'
import { useAppStore } from '@/stores/useAppStore'
import { cn } from '@/lib/utils'
import { ReminderSettings } from './ReminderSettings'
import { PILL, QUADRANT_PRESETS, useQuadrantAccent, withAlpha } from './quadrantStyle'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { TaskCard, dueState, taskDrag } from './TaskCard'
import { dropIndexFromY, orderForIndex, sortByPriority } from '@/lib/taskOrder'
import { TaskDialog } from './TaskDialog'
import { BackgroundPicker } from './BackgroundPicker'
import { STICKY, type QuadrantBackground } from '@/lib/quadrantColors'

/** Short hints shown next to each quadrant's title. */
const HINTS: Record<Quadrant, string> = {
  do: 'Important & urgent',
  schedule: 'Important, not urgent',
  delegate: 'Urgent, not important',
  eliminate: 'Neither — let it go',
}

/** The Eisenhower Matrix ("Midnight Onyx" design): tasks split by important × urgent. */
export function TaskMatrix() {
  const tasks = useTaskStore((s) => s.tasks)
  const isLoaded = useTaskStore((s) => s.isLoaded)
  const showCompleted = useTaskStore((s) => s.showCompleted)
  const { load, add, update, remove, setShowCompleted } = useTaskStore.getState()
  const highlightTaskId = useAppStore((s) => s.highlightTaskId)
  const [openId, setOpenId] = useState<string | null>(null)
  /** A task created by "+ New task": discarded if the dialog closes without a title. */
  const [draftId, setDraftId] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [flashId, setFlashId] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) void load()
  }, [isLoaded, load])

  // Keep "overdue"/"due soon" labels fresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Scroll to and flash a task (e.g. after clicking its notification).
  useEffect(() => {
    if (!highlightTaskId || !isLoaded) return
    setFlashId(highlightTaskId)
    requestAnimationFrame(() => document.querySelector(`[data-task-id="${highlightTaskId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
    useAppStore.setState({ highlightTaskId: null })
    const t = setTimeout(() => setFlashId(null), 2500)
    return () => clearTimeout(t)
  }, [highlightTaskId, isLoaded])

  const byQuadrant = useMemo(() => {
    const groups: Record<Quadrant, Task[]> = { do: [], schedule: [], delegate: [], eliminate: [] }
    for (const t of tasks) if (showCompleted || !t.completed) groups[quadrantOf(t)].push(t)
    Object.values(groups).forEach((g) => g.sort(sortByPriority))
    return groups
  }, [tasks, showCompleted])

  const open = tasks.filter((t) => !t.completed)
  const overdue = open.filter((t) => dueState(t, now) === 'overdue').length
  const openTask = tasks.find((t) => t.id === openId) ?? null

  const newTask = async () => {
    const t = await add({ title: '', important: true, urgent: true })
    setDraftId(t.id)
    setOpenId(t.id)
  }
  const closeDialog = () => {
    const id = openId
    setOpenId(null)
    if (id && id === draftId) {
      setDraftId(null)
      // Closed without giving the new task a name: don't leave an empty task behind.
      if (!useTaskStore.getState().tasks.find((t) => t.id === id)?.title.trim()) void remove(id)
    }
  }

  return (
    <div className="relative min-h-full text-[#171717] dark:text-[#ECE7DD]">
      {/* Dark mode only: faint champagne / blue glows behind the matrix (light mode is plain black & white). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden dark:block dark:bg-[radial-gradient(900px_500px_at_85%_-10%,rgba(217,185,122,0.08),transparent_60%),radial-gradient(800px_600px_at_-10%_110%,rgba(127,166,224,0.06),transparent_60%)]"
      />
      <div className="relative mx-auto flex min-h-full w-full max-w-[1240px] flex-col px-10 pb-10 pt-8">
        {/* Header */}
        <div className="mb-7 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[42px] font-semibold leading-none tracking-[-0.025em] text-[#171717] dark:bg-gradient-to-b dark:from-white dark:to-[#CFC6B6] dark:bg-clip-text dark:text-transparent">
              Tasks
            </h1>
            <p className="mt-3 text-sm text-[#57534E] dark:text-[#8D8A85]">
              <span className="font-medium text-[#171717] dark:text-[#ECE7DD]">{open.length} open</span>
              {overdue > 0 && <span className="font-medium text-[#B42318] dark:font-normal dark:text-[#E07A7A]"> · {overdue} overdue</span>}
              <span> · Eisenhower matrix</span>
            </p>
          </div>
          <button type="button" onClick={() => setShowCompleted(!showCompleted)} className={PILL}>
            {showCompleted ? <EyeOff size={15} /> : <Eye size={15} />}
            {showCompleted ? 'Hide completed' : 'Show completed'}
          </button>
          <ReminderSettings />
          <button
            type="button"
            onClick={() => void newTask()}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-[#E3C68C] to-[#C29A55] px-4 py-2 text-[13px] font-semibold text-[#2A2114] shadow-[0_6px_16px_-6px_rgba(178,138,70,0.55),inset_0_1px_0_rgba(255,255,255,0.45)] transition hover:brightness-105 dark:from-[#E6CC94] dark:to-[#C9A563] dark:text-[#1A1712]"
          >
            <Plus size={15} strokeWidth={2.5} /> New task
          </button>
        </div>

        {/* 2×2 grid */}
        <div className="grid flex-1 grid-cols-2 grid-rows-[1fr_1fr] gap-[18px]">
          {(['do', 'schedule', 'delegate', 'eliminate'] as const).map((id) => (
            <QuadrantColumn key={id} id={id} tasks={byQuadrant[id]} now={now} flashId={flashId} onOpen={setOpenId} onAdd={add} onUpdate={update} />
          ))}
        </div>

        {openTask && <TaskDialog key={openTask.id} task={openTask} onClose={closeDialog} />}
      </div>
    </div>
  )
}

interface QuadrantColumnProps {
  id: Quadrant
  tasks: Task[]
  now: number
  flashId: string | null
  onOpen: (id: string) => void
  onAdd: (init: Partial<Task>) => Promise<Task>
  onUpdate: (u: { id: string; important?: boolean; urgent?: boolean; completed?: boolean; order?: number }) => Promise<void>
}

function QuadrantColumn({ id, tasks, now, flashId, onOpen, onAdd, onUpdate }: QuadrantColumnProps) {
  const q = QUADRANTS.find((x) => x.id === id)!
  const accent = useQuadrantAccent(id)
  const custom = useTaskStore((s) => s.settings.quadrantColors?.[id])
  const theme = useAppStore((s) => s.theme)
  // Light mode: every quadrant has a border in its color. Dark mode: only when recolored.
  const coloredBorder = !!custom || theme === 'light'
  const background = useTaskStore((s) => s.settings.quadrantBackgrounds?.[id])
  // Sticky Notes colors are a light-mode style; dark mode keeps its own look.
  const sticky = theme === 'light' && background && background !== 'white' ? STICKY[background] : null
  const onDarkPaper = !!sticky?.dark
  const setBackground = (bg: QuadrantBackground | null) => {
    const { settings, setSettings } = useTaskStore.getState()
    const next = { ...settings.quadrantBackgrounds }
    if (bg) next[id] = bg
    else delete next[id]
    void setSettings({ quadrantBackgrounds: next })
  }
  const setQuadrantColor = (color: string | null) => {
    const { settings, setSettings } = useTaskStore.getState()
    const next = { ...settings.quadrantColors }
    if (color) next[id] = color
    else delete next[id]
    void setSettings({ quadrantColors: next })
  }
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  /** Where a dragged task would land among this quadrant's open tasks (null = not dragging here). */
  const [dropAt, setDropAt] = useState<number | null>(null)
  const openTasks = tasks.filter((t) => !t.completed)
  const openCount = openTasks.length
  /** Open tasks a dragged task can be dropped between (itself excluded). */
  const landing = openTasks.filter((t) => t.id !== taskDrag.id)

  /** Puts task `id` at position `index` of this quadrant (moving it here if it's elsewhere). */
  const placeAt = (id: string, index: number) => {
    const others = openTasks.filter((t) => t.id !== id)
    void onUpdate({ id, important: q.important, urgent: q.urgent, order: orderForIndex(others, index) })
  }
  const dropIndex = (section: HTMLElement, y: number) => {
    const rows = [...section.querySelectorAll<HTMLElement>('[data-task-id]:not([data-completed])')].filter((r) => r.dataset.taskId !== taskDrag.id)
    return dropIndexFromY(
      rows.map((r) => r.getBoundingClientRect()),
      y,
    )
  }
  /** Alt+↑/↓ on a focused task. */
  const move = (id: string, delta: -1 | 1) => {
    const i = openTasks.findIndex((t) => t.id === id)
    const target = i + delta
    if (i < 0 || target < 0 || target >= openTasks.length) return
    placeAt(id, target)
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-task-id="${id}"]`)?.focus())
  }

  const submit = () => {
    const title = draft.trim()
    if (title) void onAdd({ title, important: q.important, urgent: q.urgent })
    setDraft('')
  }

  return (
    <section
      aria-label={q.title}
      data-quadrant={id}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('application/x-task-id')) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        const at = dropIndex(e.currentTarget, e.clientY)
        if (at !== dropAt) setDropAt(at)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropAt(null)
      }}
      onDrop={(e) => {
        e.preventDefault()
        const taskId = e.dataTransfer.getData('application/x-task-id') || taskDrag.id
        const at = dropAt ?? dropIndex(e.currentTarget, e.clientY)
        setDropAt(null)
        if (taskId) placeAt(taskId, at)
      }}
      className={cn(
        'group/quad relative flex min-h-[300px] flex-col overflow-hidden rounded-[20px] border px-[22px] pb-4 pt-5 transition-shadow',
        'border-[#E2DDD5] bg-[var(--quad-tint)] shadow-[0_24px_48px_-30px_rgba(41,37,36,0.22),0_1px_2px_rgba(41,37,36,0.05)]',
        'dark:border-white/[0.07] dark:bg-transparent dark:bg-gradient-to-b dark:from-white/[0.045] dark:to-white/[0.02] dark:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]',
      )}
      style={{
        ...(dropAt !== null && { boxShadow: `0 0 0 2px ${withAlpha(accent, 0.55)}` }),
        ...(coloredBorder && { borderColor: withAlpha(accent, 0.45) }),
        // Light mode: a faint wash of the quadrant's color so the white task cards stand out,
        // or the chosen background (white / Sticky Notes paper).
        ['--quad-tint' as string]: sticky ? sticky.body : background === 'white' && theme === 'light' ? '#ffffff' : withAlpha(accent, 0.045),
        ...(sticky && {
          borderColor: sticky.band,
          ...(dropAt === null && { boxShadow: '0 16px 30px -20px rgba(41,37,36,0.38), 0 2px 5px rgba(41,37,36,0.07)' }),
        }),
      }}
    >

      {/* Dark mode only: corner glow in the quadrant's color */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{ background: `radial-gradient(620px 170px at 0% 0%, ${withAlpha(accent, 0.09)}, transparent 62%)` }}
      />
      <header
        className={cn(
          'relative mb-3.5 flex items-center gap-3',
          // Sticky Notes: a deeper band across the top of the note.
          sticky ? '-mx-[22px] -mt-5 px-[22px] pb-3 pt-4' : 'border-b border-[#E7E2DA] pb-3 dark:border-b-0 dark:pb-0',
        )}
        style={sticky ? { background: sticky.band } : undefined}
      >
        <span
          data-testid="quadrant-dot"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: accent, boxShadow: `0 0 0 4px ${withAlpha(accent, 0.14)}, 0 0 14px ${withAlpha(accent, 0.35)}` }}
        />
        <h2 className={cn('text-[17px] font-semibold tracking-[-0.01em]', onDarkPaper && 'text-white')}>{q.title}</h2>
        <span className={cn('min-w-0 flex-1 truncate text-[12.5px]', onDarkPaper ? 'text-[#E7E5E4]' : 'text-[#6B655E] dark:text-[#7E7B76]')}>{HINTS[id]}</span>
        <BackgroundPicker
          label={q.title}
          value={background as QuadrantBackground | undefined}
          tint={withAlpha(accent, 0.12)}
          onChange={setBackground}
          className={cn(
            'opacity-0 transition-opacity focus-within:opacity-100 group-hover/quad:opacity-100 has-[[aria-expanded=true]]:opacity-100',
            onDarkPaper && '[&>button]:text-white [&>button:hover]:bg-white/15',
          )}
        />
        <ColorPicker
          trigger="icon"
          align="right"
          label={q.title}
          color={accent}
          custom={custom}
          choices={QUADRANT_PRESETS}
          autoLabel="Default"
          onChange={setQuadrantColor}
          className={cn(
            'opacity-0 transition-opacity focus-within:opacity-100 group-hover/quad:opacity-100 has-[[aria-expanded=true]]:opacity-100',
            onDarkPaper && '[&_button]:text-white',
          )}
        />
        <span className="rounded-lg border border-[#E2DDD5] bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-[#44403C] dark:border-white/[0.07] dark:bg-white/[0.06] dark:text-[#BDB7AC]">
          {openCount}
        </span>
      </header>

      <div className="relative flex flex-1 flex-col gap-2">
        {tasks.map((t) => {
          const rank = t.completed ? undefined : openTasks.indexOf(t) + 1
          // Drop positions count the open tasks other than the one being dragged.
          const slot = t.completed || t.id === taskDrag.id ? -1 : landing.findIndex((x) => x.id === t.id)
          return (
            <div key={t.id} className="relative">
              {dropAt !== null && slot !== -1 && dropAt === slot && <DropLine color={accent} />}
              <TaskCard
                task={t}
                now={now}
                rank={rank}
                accent={accent}
                highlighted={flashId === t.id}
                onOpen={() => onOpen(t.id)}
                onDarkPaper={onDarkPaper}
                onToggle={() => void onUpdate({ id: t.id, completed: !t.completed })}
                onMove={(d) => move(t.id, d)}
              />
            </div>
          )
        })}
        {dropAt !== null && dropAt >= landing.length && <DropLine color={accent} />}
        {tasks.length === 0 && !adding && (
          <div
            className={cn(
              'rounded-[14px] border border-dashed px-4 py-7 text-center text-[13.5px]',
              onDarkPaper ? 'border-white/35 text-[#F5F5F4]' : 'border-[#D6D0C7] text-[#6B655E] dark:border-white/[0.08] dark:text-[#6D6A65]',
            )}
          >
            Clear. Keep it that way.
          </div>
        )}

        {adding ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              submit()
              setAdding(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit()
              if (e.key === 'Escape') {
                setDraft('')
                setAdding(false)
              }
            }}
            placeholder="Task name, then Enter"
            className="rounded-[14px] border bg-white px-3.5 py-2.5 text-[14.5px] text-[#171717] outline-none placeholder:text-[#78716C] dark:bg-white/[0.04] dark:text-[#ECE7DD] dark:placeholder:text-[#6D6A65]"
            style={{ borderColor: withAlpha(accent, 0.6) }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={cn(
              'mt-auto flex items-center gap-1.5 self-start rounded-lg px-1 pt-2 text-left text-[13px] font-medium transition-colors',
              onDarkPaper ? 'text-[#F5F5F4] hover:text-white' : 'text-[#57534E] hover:text-[#1C1917] dark:font-normal dark:text-[#8D8A85] dark:hover:text-[#ECE7DD]',
            )}
          >
            <Plus size={14} /> Add task
          </button>
        )}
      </div>
    </section>
  )
}

/** Thin line showing where a dragged task will be dropped. */
function DropLine({ color }: { color: string }) {
  return <div aria-hidden data-testid="drop-line" className="-my-[5px] h-[2px] rounded-full" style={{ background: color }} />
}
