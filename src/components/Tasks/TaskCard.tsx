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
  /** The quadrant's accent color (fills the checkbox when done). */
  accent?: string
  onToggle: () => void
  onOpen: () => void
}

/** One task row in the matrix ("Midnight Onyx": soft rounded row, square checkbox, date on the right). */
export function TaskCard({ task, now, highlighted, accent = '#4F7FC9', onToggle, onOpen }: TaskCardProps) {
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
        'group flex cursor-pointer items-center gap-3 rounded-[14px] border px-3.5 py-3 text-[14.5px] outline-none transition',
        task.completed
          ? 'border-transparent bg-transparent'
          : 'border-[#EFECE6] bg-[#F8F7F4] hover:border-[#E3DED5] hover:bg-[#F4F2EE] dark:border-white/[0.05] dark:bg-white/[0.035] dark:hover:border-white/[0.1] dark:hover:bg-white/[0.055]',
        'focus-visible:ring-2 focus-visible:ring-[#C9A563]/60',
        highlighted && 'animate-pulse ring-2 ring-[#C9A563]',
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
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors',
          !task.completed && 'border-[#CFC9BE] bg-white hover:border-[#A8843F] dark:border-white/25 dark:bg-transparent dark:hover:border-[#D9B97A]',
        )}
        style={task.completed ? { background: accent, borderColor: accent } : undefined}
      >
        {task.completed && <Check size={12} strokeWidth={3} className="text-white dark:text-[#0E0F13]" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'break-words leading-snug',
            task.completed ? 'text-[#B3AEA5] line-through dark:text-[#6D6A65]' : 'text-[#1C1B19] dark:text-[#ECE7DD]',
            !task.title && 'opacity-50',
          )}
        >
          {task.title || 'Untitled task'}
        </div>
        {task.notes && !task.completed && <div className="mt-0.5 truncate text-[12.5px] text-[#9A958C] dark:text-[#7E7B76]">{task.notes.split('\n')[0]}</div>}
      </div>
      {task.dueAt !== null && !task.completed && (
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 whitespace-nowrap text-xs',
            state === 'overdue' && 'font-medium text-[#C24848] dark:text-[#E07A7A]',
            state === 'soon' && 'font-medium text-[#A8843F] dark:text-[#D9B97A]',
            (state === 'later' || state === null) && 'text-[#8A857D] dark:text-[#9C978E]',
          )}
        >
          {state === 'overdue' ? 'Overdue · ' : <Calendar size={12} className="opacity-70" />}
          {formatDueDate(task.dueAt, now)}
          {task.reminders.length > 0 && <Bell size={11} className="ml-1 opacity-50" aria-label={`${task.reminders.length} reminder(s)`} />}
        </span>
      )}
    </div>
  )
}
