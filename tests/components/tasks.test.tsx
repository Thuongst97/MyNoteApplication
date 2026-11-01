import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskCard, dueState } from '@/components/Tasks/TaskCard'
import { TaskMatrix } from '@/components/Tasks/TaskMatrix'
import { TaskDialog } from '@/components/Tasks/TaskDialog'
import { newTask } from '@/lib/reminders'
import { useTaskStore } from '@/stores/useTaskStore'
import { useAppStore } from '@/stores/useAppStore'

const NOW = new Date(2026, 9, 31, 12).getTime()
const settings = { defaultReminders: [0, 15], runInBackground: true }
const initial = useTaskStore.getState()
beforeEach(() => {
  localStorage.clear()
  useTaskStore.setState({ ...initial, tasks: [], isLoaded: true, showCompleted: true }, true)
})

describe('TaskCard', () => {
  it('shows overdue / due-soon states', () => {
    expect(dueState(newTask('a', { dueAt: NOW - 1 }, settings, NOW), NOW)).toBe('overdue')
    expect(dueState(newTask('a', { dueAt: NOW + 3600_000 }, settings, NOW), NOW)).toBe('soon')
    expect(dueState(newTask('a', { dueAt: NOW + 3 * 86400_000 }, settings, NOW), NOW)).toBe('later')
    expect(dueState(newTask('a', {}, settings, NOW), NOW)).toBeNull()
  })

  it('renders title, due date and reminder count; checkbox toggles without opening', async () => {
    const onToggle = vi.fn()
    const onOpen = vi.fn()
    render(<TaskCard task={newTask('a', { title: 'Pay bills', dueAt: NOW - 60_000 }, settings, NOW)} now={NOW} highlighted={false} onToggle={onToggle} onOpen={onOpen} />)
    expect(screen.getByText('Pay bills')).toBeInTheDocument()
    expect(screen.getByText(/Overdue ·/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Mark as done' }))
    expect(onToggle).toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
    await userEvent.click(screen.getByText('Pay bills'))
    expect(onOpen).toHaveBeenCalled()
  })
})

describe('TaskMatrix', () => {
  it('recolors a quadrant from its palette button and resets it to default', async () => {
    const setSettings = vi.fn(async (patch) => useTaskStore.setState((st) => ({ settings: { ...st.settings, ...patch } })))
    useTaskStore.setState({ setSettings } as never)
    useAppStore.setState({ theme: 'light' })
    render(<TaskMatrix />)
    const doFirst = screen.getByRole('region', { name: 'Do first' })
    await userEvent.click(within(doFirst).getByRole('button', { name: 'Color of Do first' }))
    await userEvent.click(within(doFirst).getByRole('button', { name: 'Use #8fbf9f' }))
    expect(setSettings).toHaveBeenLastCalledWith({ quadrantColors: { do: '#8fbf9f' } })
    // The quadrant is painted with the custom color (inline), others keep the default.
    expect(doFirst.style.borderColor).toBe('rgba(143, 191, 159, 0.45)')
    expect(screen.getByRole('region', { name: 'Schedule' }).style.borderColor).toBe('')
    await userEvent.click(within(doFirst).getByRole('button', { name: 'Color of Do first' }))
    await userEvent.click(within(doFirst).getByRole('button', { name: 'Default' }))
    expect(setSettings).toHaveBeenLastCalledWith({ quadrantColors: {} })
    expect(doFirst.style.borderColor).toBe('')
  })

  it('shows the four quadrants with axis labels', () => {
    render(<TaskMatrix />)
    for (const q of ['Do first', 'Schedule', 'Delegate', 'Eliminate']) expect(screen.getByRole('region', { name: q })).toBeInTheDocument()
    expect(screen.getByText('Urgent')).toBeInTheDocument()
    expect(screen.getByText('Not important')).toBeInTheDocument()
  })

  it('adds a task to a quadrant, moves it by drag & drop and completes it', async () => {
    render(<TaskMatrix />)
    const schedule = screen.getByRole('region', { name: 'Schedule' })
    await userEvent.click(within(schedule).getByText('New task'))
    await userEvent.type(within(schedule).getByPlaceholderText('Task name, then Enter'), 'Learn Rust{Enter}')
    expect(await within(schedule).findByText('Learn Rust')).toBeInTheDocument()
    expect(useTaskStore.getState().tasks[0]).toMatchObject({ important: true, urgent: false })

    const id = useTaskStore.getState().tasks[0].id
    const eliminate = screen.getByRole('region', { name: 'Eliminate' })
    await act(async () => {
      fireEvent.drop(eliminate, { dataTransfer: { getData: () => id, types: ['application/x-task-id'] } })
    })
    expect(await within(eliminate).findByText('Learn Rust')).toBeInTheDocument()
    expect(useTaskStore.getState().tasks[0]).toMatchObject({ important: false, urgent: false })

    await userEvent.click(within(eliminate).getByRole('checkbox'))
    expect(useTaskStore.getState().tasks[0].completed).toBe(true)
    expect(screen.getByText(/0 open/)).toBeInTheDocument()
  })
})

describe('TaskDialog', () => {
  it('edits priority, due date, reminders and notes', async () => {
    const task = await useTaskStore.getState().add({ title: 'Report' })
    const onClose = vi.fn()
    const { container } = render(<TaskDialog task={task} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /Schedule/ }))
    fireEvent.change(container.querySelector('input[type="datetime-local"]')!, { target: { value: '2030-01-02T09:30' } })
    await userEvent.click(await screen.findByRole('button', { name: '1 day before' }))
    await userEvent.type(screen.getByPlaceholderText('Add details…'), 'Q4 numbers')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClose).toHaveBeenCalled()
    const saved = useTaskStore.getState().tasks[0]
    expect(saved).toMatchObject({ important: true, urgent: false, notes: 'Q4 numbers', reminders: [0, 15, 1440] })
    expect(saved.dueAt).toBe(new Date(2030, 0, 2, 9, 30).getTime())
  })

  it('deletes after confirmation', async () => {
    const task = await useTaskStore.getState().add({ title: 'Junk' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TaskDialog task={task} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /Delete/ }))
    expect(useTaskStore.getState().tasks).toEqual([])
  })
})
