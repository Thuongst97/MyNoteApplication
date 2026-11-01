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
        'group flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#EEF0F3] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none transition',
        'shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:-translate-y-px hover:border-[#E2E5EA] hover:shadow-[0_6px_24px_rgba(0,0,0,0.06)]',
        'focus-visible:ring-2 focus-visible:ring-[#93B4DD] dark:border-white/[0.06] dark:bg-[#202227] dark:text-[#E5E7EB] dark:shadow-[0_4px_20px_rgba(0,0,0,0.25)] dark:hover:border-white/[0.12]',
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
          task.completed ? 'border-[#5B83B7] bg-[#5B83B7] text-white' : 'border-[#CBD0D8] hover:border-[#5B83B7] hover:bg-[#5B83B7]/10 dark:border-white/25',
        )}
      >
        {task.completed && <Check size={12} strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn('break-words leading-snug', task.completed && 'text-[#9CA3AF] line-through dark:text-[#6B7280]', !task.title && 'opacity-50')}>
          {task.title || 'Untitled task'}
        </div>
        {(task.dueAt !== null || task.notes) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {task.dueAt !== null && (
              <span
                className={cn(
                  'flex items-center gap-1',
                  state === 'overdue' && 'font-medium text-[#D25C5C] dark:text-[#F19A9A]',
                  state === 'soon' && 'text-[#B48A4C] dark:text-[#D7B57E]',
                  (state === 'later' || state === null) && 'text-[#6B7280] dark:text-[#9CA3AF]',
                )}
              >
                <Calendar size={12} />
                {state === 'overdue' && 'Overdue · '}
                {formatDueDate(task.dueAt, now)}
              </span>
            )}
            {task.dueAt !== null && task.reminders.length > 0 && !task.completed && (
              <span className="flex items-center gap-0.5 text-[#9CA3AF]" title={`${task.reminders.length} reminder(s)`}>
                <Bell size={11} />
                {task.reminders.length}
              </span>
            )}
            {task.notes && <span className="truncate text-[#6B7280] dark:text-[#9CA3AF]">{task.notes.split('\n')[0]}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
