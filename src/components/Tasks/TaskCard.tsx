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

/** Id of the task being dragged (dataTransfer can't be read during dragover). */
export const taskDrag = { id: null as string | null }

interface TaskCardProps {
  task: Task
  now: number
  highlighted: boolean
  /** Priority number (1, 2, 3…) of an open task; none for completed ones. */
  rank?: number
  /** The quadrant's accent color (fills the checkbox when done). */
  accent?: string
  onToggle: () => void
  onOpen: () => void
  /** Alt+↑ / Alt+↓: move the task up or down one place. */
  onMove?: (delta: -1 | 1) => void
}

/** One task row: priority number, checkbox, title (+ note), due date. Drag it to reorder. */
export function TaskCard({ task, now, highlighted, rank, accent = '#4F7FC9', onToggle, onOpen, onMove }: TaskCardProps) {
  const state = dueState(task, now)
  return (
    <div
      data-task-id={task.id}
      data-completed={task.completed || undefined}
      draggable
      onDragStart={(e) => {
        taskDrag.id = task.id
        e.dataTransfer.setData('application/x-task-id', task.id)
        e.dataTransfer.effectAllowed = 'move'
        e.currentTarget.classList.add('opacity-40')
      }}
      onDragEnd={(e) => {
        taskDrag.id = null
        e.currentTarget.classList.remove('opacity-40')
      }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && onMove) {
          e.preventDefault()
          onMove(e.key === 'ArrowUp' ? -1 : 1)
        } else if (e.key === 'Enter') onOpen()
      }}
      tabIndex={0}
      role="button"
      aria-label={`${rank ? `${rank}. ` : ''}${task.title || 'Untitled task'}`}
      title="Click to open · drag to reorder (Alt+↑/↓)"
      className={cn(
        'group flex cursor-grab items-center gap-3 rounded-[14px] border px-3.5 py-3 text-[14.5px] outline-none transition active:cursor-grabbing',
        task.completed
          ? 'border-transparent bg-transparent'
          : 'border-[#E2DDD5] bg-white shadow-[0_1px_2px_rgba(41,37,36,0.06)] hover:border-[#CFC8BE] hover:shadow-[0_2px_6px_rgba(41,37,36,0.08)] dark:shadow-none dark:border-white/[0.05] dark:bg-white/[0.035] dark:hover:border-white/[0.1] dark:hover:bg-white/[0.055]',
        'focus-visible:ring-2 focus-visible:ring-[#C9A563]/60',
        highlighted && 'animate-pulse ring-2 ring-[#C9A563]',
      )}
    >
      <span
        aria-hidden
        className="w-4 shrink-0 text-right text-[13px] font-semibold tabular-nums text-[#78716C] dark:text-[#7E7B76]"
        style={rank === 1 ? { color: accent } : undefined}
      >
        {rank ?? ''}
      </span>
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
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors',
          !task.completed && 'border-[#A8A29E] bg-white hover:border-[#57534E] dark:border-white/25 dark:bg-transparent dark:hover:border-[#D9B97A]',
        )}
        style={task.completed ? { background: accent, borderColor: accent } : undefined}
      >
        {task.completed && <Check size={12} strokeWidth={3} className="text-white dark:text-[#0E0F13]" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'break-words leading-snug',
            task.completed ? 'text-[#6B655E] line-through decoration-[#A8A29E] dark:text-[#6D6A65] dark:decoration-current' : 'text-[#1C1917] dark:text-[#ECE7DD]',
            !task.title && 'opacity-60',
          )}
        >
          {task.title || 'Untitled task'}
        </div>
        {task.notes && !task.completed && <div className="mt-0.5 truncate text-[12.5px] text-[#57534E] dark:text-[#7E7B76]">{task.notes.split('\n')[0]}</div>}
      </div>
      {task.dueAt !== null && !task.completed && (
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 whitespace-nowrap text-xs',
            state === 'overdue' && 'font-semibold text-[#B42318] dark:font-medium dark:text-[#E07A7A]',
            state === 'soon' && 'font-semibold text-[#8A5A12] dark:font-medium dark:text-[#D9B97A]',
            (state === 'later' || state === null) && 'text-[#57534E] dark:text-[#9C978E]',
          )}
        >
          {state === 'overdue' ? 'Overdue · ' : <Calendar size={12} className="opacity-70" />}
          {formatDueDate(task.dueAt, now)}
          {task.reminders.length > 0 && <Bell size={11} className="ml-1 opacity-60" aria-label={`${task.reminders.length} reminder(s)`} />}
        </span>
      )}
    </div>
  )
}
