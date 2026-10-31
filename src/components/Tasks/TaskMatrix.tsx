import { useEffect, useMemo, useState } from 'react'
import { BellRing, CheckSquare, Eye, EyeOff, Plus, Settings2 } from 'lucide-react'
import type { Task } from '@/types'
import { QUADRANTS, REMINDER_PRESETS, quadrantOf, type Quadrant } from '@/lib/reminders'
import { useTaskStore } from '@/stores/useTaskStore'
import { useAppStore } from '@/stores/useAppStore'
import { api, isElectron, platform } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Popover } from '@/components/ui/Popover'
import { QUADRANT_STYLE } from './quadrantStyle'
import { TaskCard, dueState } from './TaskCard'
import { Chip, TaskDialog } from './TaskDialog'

/** Sort: open tasks first, then by due date (no date last), then by creation. */
function sortTasks(a: Task, b: Task) {
  if (a.completed !== b.completed) return a.completed ? 1 : -1
  if (a.completed && b.completed) return (b.completedAt ?? 0) - (a.completedAt ?? 0)
  const ad = a.dueAt ?? Infinity
  const bd = b.dueAt ?? Infinity
  if (ad !== bd) return ad - bd
  return a.order - b.order
}

/** The Eisenhower Matrix: tasks split by important × urgent. */
export function TaskMatrix() {
  const tasks = useTaskStore((s) => s.tasks)
  const isLoaded = useTaskStore((s) => s.isLoaded)
  const showCompleted = useTaskStore((s) => s.showCompleted)
  const { load, add, update, setShowCompleted } = useTaskStore.getState()
  const highlightTaskId = useAppStore((s) => s.highlightTaskId)
  const [openId, setOpenId] = useState<string | null>(null)
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
    requestAnimationFrame(() =>
      document.querySelector(`[data-task-id="${highlightTaskId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    )
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

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1200px] flex-col px-8 pb-10 pt-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2.5 text-[32px] font-bold leading-tight tracking-tight">
            <CheckSquare size={30} strokeWidth={2.2} className="text-blue-500" /> Tasks
          </h1>
          <p className="mt-1 text-sm opacity-55">
            Eisenhower Matrix · {open.length} open
            {overdue > 0 && <span className="text-red-600 dark:text-red-400"> · {overdue} overdue</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCompleted(!showCompleted)}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        >
          {showCompleted ? <EyeOff size={15} /> : <Eye size={15} />}
          {showCompleted ? 'Hide completed' : 'Show completed'}
        </button>
        <ReminderSettings />
      </div>

      {/* Axis labels + 2×2 grid */}
      <div className="grid flex-1 grid-cols-[28px_1fr_1fr] grid-rows-[auto_1fr_1fr] gap-3">
        <div />
        <AxisLabel>Urgent</AxisLabel>
        <AxisLabel>Not urgent</AxisLabel>
        <AxisLabel vertical>Important</AxisLabel>
        <QuadrantColumn id="do" tasks={byQuadrant.do} now={now} flashId={flashId} onOpen={setOpenId} onAdd={add} onUpdate={update} />
        <QuadrantColumn id="schedule" tasks={byQuadrant.schedule} now={now} flashId={flashId} onOpen={setOpenId} onAdd={add} onUpdate={update} />
        <AxisLabel vertical>Not important</AxisLabel>
        <QuadrantColumn id="delegate" tasks={byQuadrant.delegate} now={now} flashId={flashId} onOpen={setOpenId} onAdd={add} onUpdate={update} />
        <QuadrantColumn id="eliminate" tasks={byQuadrant.eliminate} now={now} flashId={flashId} onOpen={setOpenId} onAdd={add} onUpdate={update} />
      </div>

      {openTask && <TaskDialog key={openTask.id} task={openTask} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function AxisLabel({ children, vertical }: { children: React.ReactNode; vertical?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center text-[11px] font-semibold uppercase tracking-[0.12em] opacity-40',
        vertical && '[writing-mode:vertical-rl] rotate-180',
      )}
    >
      {children}
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
  const style = QUADRANT_STYLE[id]
  const Icon = style.icon
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
        'flex min-h-[220px] flex-col rounded-xl border border-black/[0.06] p-3 transition dark:border-white/[0.06]',
        style.tint,
        dragOver && cn('ring-2', style.ring),
      )}
    >
      <header className="mb-2.5 flex items-start gap-2 px-0.5">
        <Icon size={17} className={cn('mt-0.5 shrink-0', style.accent)} />
        <div className="min-w-0 flex-1">
          <div className={cn('flex items-center gap-2 text-[15px] font-semibold', style.accent)}>
            {q.title}
            <span className="rounded-full bg-black/5 px-1.5 text-[11px] font-medium text-ink-light/60 dark:bg-white/10 dark:text-ink-dark/60">
              {openCount}
            </span>
          </div>
          <div className="truncate text-xs opacity-50">{q.hint}</div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-1.5">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            now={now}
            highlighted={flashId === t.id}
            onOpen={() => onOpen(t.id)}
            onToggle={() => void onUpdate({ id: t.id, completed: !t.completed })}
          />
        ))}
        {tasks.length === 0 && !adding && <div className="px-1 py-3 text-center text-xs opacity-35">Drop tasks here</div>}

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
            className="rounded-md border border-blue-400 bg-white px-2.5 py-2 text-sm outline-none dark:bg-[#252525]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm opacity-50 hover:bg-black/5 hover:opacity-90 dark:hover:bg-white/10"
          >
            <Plus size={15} /> New task
          </button>
        )}
      </div>
    </section>
  )
}

function ReminderSettings() {
  const settings = useTaskStore((s) => s.settings)
  const { setSettings } = useTaskStore.getState()
  const [open, setOpen] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const showBackground = isElectron && platform !== 'darwin'

  const toggle = (m: number) => {
    const cur = settings.defaultReminders
    void setSettings({ defaultReminders: cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m] })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
      >
        <Settings2 size={15} /> Reminders
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="right-0 top-10 w-[340px] p-3">
        <div className="mb-1 text-sm font-medium">Default reminders</div>
        <p className="mb-2 text-xs opacity-55">Used for new tasks once they have a due date. You can change them per task.</p>
        <div className="flex flex-wrap gap-1.5">
          {REMINDER_PRESETS.map((p) => (
            <Chip key={p.minutes} active={settings.defaultReminders.includes(p.minutes)} onClick={() => toggle(p.minutes)}>
              {p.label}
            </Chip>
          ))}
        </div>

        {showBackground && (
          <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.runInBackground}
              onChange={(e) => void setSettings({ runInBackground: e.target.checked })}
              className="mt-0.5 accent-blue-500"
            />
            <span>
              Keep running in the system tray after closing the window
              <span className="block text-xs opacity-55">Needed for reminders while the window is closed.</span>
            </span>
          </label>
        )}

        <div className="mt-4 flex items-center gap-2 border-t border-black/5 pt-3 dark:border-white/10">
          <button
            type="button"
            onClick={async () => {
              const ok = await api.tasks.testNotification()
              setTestResult(ok ? 'Sent — check your system notifications.' : 'Notifications are not available or are blocked.')
            }}
            className="flex items-center gap-1.5 rounded-md border border-black/10 px-2.5 py-1 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            <BellRing size={14} /> Send test notification
          </button>
        </div>
        {testResult && <div className="mt-1.5 text-xs opacity-60">{testResult}</div>}
      </Popover>
    </div>
  )
}
