import { useEffect, useRef, useState } from 'react'
import { Bell, Calendar, Trash2, X } from 'lucide-react'
import type { Task } from '@/types'
import { QUADRANTS, REMINDER_PRESETS, quadrantOf, formatDueDate } from '@/lib/reminders'
import { atHour, fromLocalInput, nextWeek, toLocalInput } from '@/lib/dates'
import { useTaskStore } from '@/stores/useTaskStore'
import { cn, isMacLike } from '@/lib/utils'
import { QUADRANT_STYLE } from './quadrantStyle'
import { quadrantPalette } from '@/lib/quadrantColors'
import { useAppStore } from '@/stores/useAppStore'

interface TaskDialogProps {
  task: Task
  onClose: () => void
}

/** Edit a task: title, quadrant, due date, reminders and notes. */
export function TaskDialog({ task, onClose }: TaskDialogProps) {
  const { update, remove, settings } = useTaskStore.getState()
  const quadrantColors = useTaskStore((s) => s.settings.quadrantColors)
  const theme = useAppStore((s) => s.theme)
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [important, setImportant] = useState(task.important)
  const [urgent, setUrgent] = useState(task.urgent)
  const [dueAt, setDueAt] = useState<number | null>(task.dueAt)
  const [reminders, setReminders] = useState<number[]>(task.reminders.length ? task.reminders : settings.defaultReminders)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
    titleRef.current?.select()
  }, [])

  const save = () => {
    void update({ id: task.id, title: title.trim(), notes, important, urgent, dueAt, reminders: dueAt === null ? task.reminders : reminders })
    onClose()
  }

  const toggleReminder = (m: number) => setReminders((r) => (r.includes(m) ? r.filter((x) => x !== m) : [...r, m].sort((a, b) => a - b)))

  const now = Date.now()
  const mod = isMacLike() ? '⌘' : 'Ctrl'

  return (
    <div
      className="fixed inset-0 z-[100] flex animate-fade-in items-start justify-center overflow-y-auto bg-black/40 py-[8vh]"
      onMouseDown={(e) => e.target === e.currentTarget && save()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
      }}
    >
      <div
        role="dialog"
        aria-label="Edit task"
        className="no-drag w-[520px] max-w-[92vw] animate-pop-in rounded-xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#252525]"
      >
        <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3 dark:border-white/10">
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && save()}
            placeholder="Task name"
            className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none placeholder:opacity-40"
          />
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md p-1 opacity-50 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 px-4 py-4">
          {/* Quadrant */}
          <section>
            <Label>Priority</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {QUADRANTS.map((q) => {
                const style = QUADRANT_STYLE[q.id]
                const active = quadrantOf({ important, urgent }) === q.id
                const Icon = style.icon
                const customHex = quadrantColors?.[q.id]
                const custom = customHex ? quadrantPalette(customHex, theme) : null
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setImportant(q.important)
                      setUrgent(q.urgent)
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition',
                      active
                        ? cn('border-transparent ring-2', !custom && style.ring, !custom && style.tint)
                        : 'border-black/10 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.04]',
                    )}
                    style={active && custom ? { backgroundColor: custom.background, boxShadow: `0 0 0 2px ${custom.ring}` } : undefined}
                  >
                    <Icon size={15} className={cn(!custom && style.accent)} style={custom ? { color: custom.accent } : undefined} />
                    <span className="min-w-0">
                      <span className="block font-medium">{q.title}</span>
                      <span className="block truncate text-[11px] opacity-50">
                        {q.important ? 'Important' : 'Not important'} · {q.urgent ? 'Urgent' : 'Not urgent'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Due date */}
          <section>
            <Label icon={<Calendar size={13} />}>Due date</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="datetime-local"
                value={dueAt === null ? '' : toLocalInput(dueAt)}
                onChange={(e) => setDueAt(fromLocalInput(e.target.value))}
                className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-400 dark:border-white/15 dark:[color-scheme:dark]"
              />
              <Chip onClick={() => setDueAt(atHour(0, 17))}>Today 17:00</Chip>
              <Chip onClick={() => setDueAt(atHour(1, 9))}>Tomorrow 9:00</Chip>
              <Chip onClick={() => setDueAt(nextWeek(9))}>Next week</Chip>
              {dueAt !== null && <Chip onClick={() => setDueAt(null)}>Clear</Chip>}
            </div>
            {dueAt !== null && (
              <div className={cn('mt-1.5 text-xs', dueAt < now ? 'text-red-600 dark:text-red-400' : 'opacity-50')}>
                {dueAt < now ? 'In the past: ' : 'Due '}
                {formatDueDate(dueAt, now)}
              </div>
            )}
          </section>

          {/* Reminders */}
          <section>
            <Label icon={<Bell size={13} />}>Remind me</Label>
            {dueAt === null ? (
              <div className="text-xs opacity-50">Set a due date to get reminders.</div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {REMINDER_PRESETS.map((p) => (
                    <Chip key={p.minutes} active={reminders.includes(p.minutes)} onClick={() => toggleReminder(p.minutes)}>
                      {p.label}
                    </Chip>
                  ))}
                </div>
                {reminders.length === 0 && <div className="mt-1.5 text-xs opacity-50">No reminders for this task.</div>}
              </>
            )}
          </section>

          {/* Notes */}
          <section>
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add details…"
              className="block w-full resize-y rounded-md border border-black/10 bg-transparent px-2.5 py-2 text-sm outline-none focus:border-blue-400 dark:border-white/15"
            />
          </section>
        </div>

        <div className="flex items-center gap-2 border-t border-black/5 px-4 py-3 dark:border-white/10">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete "${task.title || 'Untitled task'}"?`)) {
                void remove(task.id)
                onClose()
              }
            }}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
          >
            <Trash2 size={14} /> Delete
          </button>
          <span className="ml-auto text-xs opacity-40">{mod}+Enter to save</span>
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10">
            Cancel
          </button>
          <button type="button" onClick={save} className="rounded-md bg-blue-500 px-3 py-1.5 text-sm text-white hover:bg-blue-600">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function Label({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide opacity-50">
      {icon}
      {children}
    </div>
  )
}

export function Chip({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs transition',
        active ? 'border-blue-500 bg-blue-500 text-white' : 'border-black/10 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10',
      )}
    >
      {children}
    </button>
  )
}
