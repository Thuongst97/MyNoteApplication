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
import { TaskCard, dueState } from './TaskCard'
import { TaskDialog } from './TaskDialog'

/** Sort: open tasks first, then by due date (no date last), then by creation. */
function sortTasks(a: Task, b: Task) {
  if (a.completed !== b.completed) return a.completed ? 1 : -1
  if (a.completed && b.completed) return (b.completedAt ?? 0) - (a.completedAt ?? 0)
  const ad = a.dueAt ?? Infinity
  const bd = b.dueAt ?? Infinity
  if (ad !== bd) return ad - bd
  return a.order - b.order
}

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
    Object.values(groups).forEach((g) => g.sort(sortTasks))
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
    <div className="relative min-h-full text-[#1C1B19] dark:text-[#ECE7DD]">
      {/* Faint champagne / blue glows behind the matrix. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_85%_-10%,rgba(201,165,99,0.11),transparent_60%),radial-gradient(800px_600px_at_-10%_110%,rgba(79,127,201,0.06),transparent_60%)] dark:bg-[radial-gradient(900px_500px_at_85%_-10%,rgba(217,185,122,0.08),transparent_60%),radial-gradient(800px_600px_at_-10%_110%,rgba(127,166,224,0.06),transparent_60%)]"
      />
      <div className="relative mx-auto flex min-h-full w-full max-w-[1240px] flex-col px-10 pb-10 pt-8">
        {/* Header */}
        <div className="mb-7 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#A8843F] dark:text-[#D9B97A]">Focus</div>
            <h1 className="bg-gradient-to-b from-[#1C1B19] to-[#4A453D] bg-clip-text text-[42px] font-semibold leading-none tracking-[-0.025em] text-transparent dark:from-white dark:to-[#CFC6B6]">
              Tasks
            </h1>
            <p className="mt-3 text-sm text-[#8A857D] dark:text-[#8D8A85]">
              <span className="font-medium text-[#1C1B19] dark:text-[#ECE7DD]">{open.length} open</span>
              {overdue > 0 && <span className="text-[#C24848] dark:text-[#E07A7A]"> · {overdue} overdue</span>}
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
  onUpdate: (u: { id: string; important?: boolean; urgent?: boolean; completed?: boolean }) => Promise<void>
}

function QuadrantColumn({ id, tasks, now, flashId, onOpen, onAdd, onUpdate }: QuadrantColumnProps) {
  const q = QUADRANTS.find((x) => x.id === id)!
  const accent = useQuadrantAccent(id)
  const custom = useTaskStore((s) => s.settings.quadrantColors?.[id])
  const setQuadrantColor = (color: string | null) => {
    const { settings, setSettings } = useTaskStore.getState()
    const next = { ...settings.quadrantColors }
    if (color) next[id] = color
    else delete next[id]
    void setSettings({ quadrantColors: next })
  }
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const openCount = tasks.filter((t) => !t.completed).length

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
        setDragOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false)
      }}
      onDrop={(e) => {
        setDragOver(false)
        const taskId = e.dataTransfer.getData('application/x-task-id')
        if (taskId) void onUpdate({ id: taskId, important: q.important, urgent: q.urgent })
      }}
      className={cn(
        'group/quad relative flex min-h-[300px] flex-col overflow-hidden rounded-[20px] border px-[22px] pb-4 pt-5 transition-shadow',
        'border-[#ECE8E1] bg-gradient-to-b from-white to-[#FDFCFA] shadow-[0_24px_48px_-30px_rgba(60,48,30,0.28),0_1px_2px_rgba(28,27,25,0.04),inset_0_1px_0_#fff]',
        'dark:border-white/[0.07] dark:from-white/[0.045] dark:to-white/[0.02] dark:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]',
      )}
      style={{
        ...(dragOver && { boxShadow: `0 0 0 2px ${withAlpha(accent, 0.55)}` }),
        ...(custom && { borderColor: withAlpha(accent, 0.35) }),
      }}
    >
      {/* Corner glow in the quadrant's color */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(620px 170px at 0% 0%, ${withAlpha(accent, 0.09)}, transparent 62%)` }} />

      <header className="relative mb-3.5 flex items-center gap-3">
        <span
          data-testid="quadrant-dot"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: accent, boxShadow: `0 0 0 4px ${withAlpha(accent, 0.14)}, 0 0 14px ${withAlpha(accent, 0.35)}` }}
        />
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{q.title}</h2>
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#9A958C] dark:text-[#7E7B76]">{HINTS[id]}</span>
        <ColorPicker
          trigger="icon"
          align="right"
          label={q.title}
          color={accent}
          custom={custom}
          choices={QUADRANT_PRESETS}
          autoLabel="Default"
          onChange={setQuadrantColor}
          className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/quad:opacity-100 has-[[aria-expanded=true]]:opacity-100"
        />
        <span className="rounded-lg border border-[#ECE8E1] bg-[#F5F3EF] px-2 py-0.5 text-xs tabular-nums text-[#6E695F] dark:border-white/[0.07] dark:bg-white/[0.06] dark:text-[#BDB7AC]">
          {openCount}
        </span>
      </header>

      <div className="relative flex flex-1 flex-col gap-2">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            now={now}
            accent={accent}
            highlighted={flashId === t.id}
            onOpen={() => onOpen(t.id)}
            onToggle={() => void onUpdate({ id: t.id, completed: !t.completed })}
          />
        ))}
        {tasks.length === 0 && !adding && (
          <div className="rounded-[14px] border border-dashed border-[#E3DED5] px-4 py-7 text-center text-[13.5px] text-[#B3AEA5] dark:border-white/[0.08] dark:text-[#6D6A65]">
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
            className="rounded-[14px] border bg-white px-3.5 py-2.5 text-[14.5px] text-[#1C1B19] outline-none placeholder:text-[#B3AEA5] dark:bg-white/[0.04] dark:text-[#ECE7DD] dark:placeholder:text-[#6D6A65]"
            style={{ borderColor: withAlpha(accent, 0.6) }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-auto flex items-center gap-1.5 self-start rounded-lg px-1 pt-2 text-left text-[13px] text-[#9A958C] transition-colors hover:text-[#1C1B19] dark:text-[#8D8A85] dark:hover:text-[#ECE7DD]"
          >
            <Plus size={14} /> Add task
          </button>
        )}
      </div>
    </section>
  )
}
