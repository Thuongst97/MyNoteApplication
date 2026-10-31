import { Bell, Calendar, Check } from 'lucide-react'
import type { Task } from '@/types'
import { formatDueDate } from '@/lib/reminders'
import { cn } from '@/lib/utils'

export function dueState(task: Task, now: number): 'overdue' | 'soon' | 'later' | null {
  if (task.dueAt === null || task.completed) return null
  if (task.dueAt < now) return 'overdue'
  if (task.dueAt - now < 24 * 60 * 60 * 1000) return 'soon'
  return 'later'
}

interface TaskCardProps {
  task: Task
  now: number
  highlighted: boolean
  onToggle: () => void
  onOpen: () => void
}

export function TaskCard({ task, now, highlighted, onToggle, onOpen }: TaskCardProps) {
  const state = dueState(task, now)
  return (
    <div
      data-task-id={task.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-task-id', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      tabIndex={0}
      role="button"
      className={cn(
        'group flex cursor-pointer items-start gap-2.5 rounded-md border border-black/[0.07] bg-white px-2.5 py-2 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)] outline-none transition',
        'hover:border-black/15 focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-white/[0.07] dark:bg-[#252525] dark:hover:border-white/15',
        highlighted && 'animate-pulse ring-2 ring-blue-500',
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={task.completed}
        aria-label={task.completed ? 'Mark as not done' : 'Mark as done'}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className={cn(
          'mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors',
          task.completed
            ? 'border-blue-500 bg-blue-500 text-white'
            : 'border-black/25 hover:border-blue-500 hover:bg-blue-500/10 dark:border-white/30',
        )}
      >
        {task.completed && <Check size={12} strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn('break-words leading-snug', task.completed && 'text-ink-light/45 line-through dark:text-ink-dark/40', !task.title && 'opacity-50')}>
          {task.title || 'Untitled task'}
        </div>
        {(task.dueAt !== null || task.notes) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {task.dueAt !== null && (
              <span
                className={cn(
                  'flex items-center gap-1',
                  state === 'overdue' && 'font-medium text-red-600 dark:text-red-400',
                  state === 'soon' && 'text-amber-600 dark:text-amber-400',
                  (state === 'later' || state === null) && 'opacity-55',
                )}
              >
                <Calendar size={12} />
                {state === 'overdue' && 'Overdue · '}
                {formatDueDate(task.dueAt, now)}
              </span>
            )}
            {task.dueAt !== null && task.reminders.length > 0 && !task.completed && (
              <span className="flex items-center gap-0.5 opacity-45" title={`${task.reminders.length} reminder(s)`}>
                <Bell size={11} />
                {task.reminders.length}
              </span>
            )}
            {task.notes && <span className="truncate opacity-45">{task.notes.split('\n')[0]}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
