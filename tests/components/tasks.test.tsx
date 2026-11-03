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
  it('numbers open tasks 1, 2, 3 by priority and reorders them with Alt+↑/↓ and drag & drop', async () => {
    const { add } = useTaskStore.getState()
    const ids: Record<string, string> = {}
    for (const [key, title, order, completed] of [['a', 'Alpha', 10, false], ['b', 'Bravo', 20, false], ['c', 'Charlie', 30, false], ['d', 'Done one', 5, true]] as const)
      ids[key] = (await add({ title, important: true, urgent: true, order, completed })).id
    render(<TaskMatrix />)
    const doFirst = screen.getByRole('region', { name: 'Do first' })
    const names = () => within(doFirst).getAllByRole('button', { name: /^\d+\. / }).map((b) => b.getAttribute('aria-label'))
    expect(names()).toEqual(['1. Alpha', '2. Bravo', '3. Charlie']) // the completed task has no number
    // Keyboard: move Charlie up one place → between Alpha and Bravo.
    within(doFirst).getByRole('button', { name: '3. Charlie' }).focus()
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}')
    expect(names()).toEqual(['1. Alpha', '2. Charlie', '3. Bravo'])
    // Drag Alpha to the top of Schedule (an empty quadrant) and back to the end of Do first.
    const schedule = screen.getByRole('region', { name: 'Schedule' })
    const drag = (id: string, target: HTMLElement) =>
      act(async () => {
        fireEvent.dragOver(target, { dataTransfer: { getData: () => id, types: ['application/x-task-id'] } })
        fireEvent.drop(target, { dataTransfer: { getData: () => id, types: ['application/x-task-id'] } })
      })
    await drag(ids.a, schedule)
    expect(within(schedule).getByRole('button', { name: '1. Alpha' })).toBeInTheDocument()
    expect(useTaskStore.getState().tasks.find((t) => t.id === ids.a)).toMatchObject({ important: true, urgent: false })
    expect(names()).toEqual(['1. Charlie', '2. Bravo'])
    await drag(ids.a, doFirst)
    expect(names()).toEqual(['1. Charlie', '2. Bravo', '3. Alpha'])
  })

  it('recolors a quadrant from its palette button and resets it to default', async () => {
    const setSettings = vi.fn(async (patch) => useTaskStore.setState((st) => ({ settings: { ...st.settings, ...patch } })))
    useTaskStore.setState({ setSettings } as never)
    useAppStore.setState({ theme: 'light' })
    render(<TaskMatrix />)
    const doFirst = screen.getByRole('region', { name: 'Do first' })
    await userEvent.click(within(doFirst).getByRole('button', { name: 'Color of Do first' }))
    await userEvent.click(within(doFirst).getByRole('button', { name: 'Use #8fbf9f' }))
    expect(setSettings).toHaveBeenLastCalledWith({ quadrantColors: { do: '#8fbf9f' } })
    // The quadrant's dot (and border/glow) use the custom color; others keep the Onyx default.
    const dot = (region: HTMLElement) => within(region).getByTestId('quadrant-dot').style.background
    expect(dot(doFirst)).toBe('rgb(143, 191, 159)')
    expect(doFirst.style.borderColor).toBe('rgba(143, 191, 159, 0.45)')
    // Light-mode defaults: deep green for Schedule, with a matching border.
    expect(dot(screen.getByRole('region', { name: 'Schedule' }))).toBe('rgb(28, 130, 86)')
    expect(screen.getByRole('region', { name: 'Schedule' }).style.borderColor).toBe('rgba(28, 130, 86, 0.45)')
    await userEvent.click(within(doFirst).getByRole('button', { name: 'Color of Do first' }))
    await userEvent.click(within(doFirst).getByRole('button', { name: 'Default' }))
    expect(setSettings).toHaveBeenLastCalledWith({ quadrantColors: {} })
    expect(dot(doFirst)).toBe('rgb(153, 58, 26)')
    expect(doFirst.style.borderColor).toBe('rgba(153, 58, 26, 0.45)')
    // Dark mode keeps its own defaults and no colored border unless recolored.
    act(() => useAppStore.setState({ theme: 'dark' }))
    expect(dot(doFirst)).toBe('rgb(224, 122, 122)')
    expect(doFirst.style.borderColor).toBe('')
  })

  it('shows the four quadrants with their meaning', () => {
    render(<TaskMatrix />)
    for (const q of ['Do first', 'Schedule', 'Delegate', 'Eliminate']) expect(screen.getByRole('region', { name: q })).toBeInTheDocument()
    expect(screen.getByText('Important & urgent')).toBeInTheDocument()
    expect(screen.getByText('Urgent, not important')).toBeInTheDocument()
    expect(screen.getAllByText('Clear. Keep it that way.')).toHaveLength(4)
  })

  it('"New task" in the header opens a new Do-first task; closing it without a name discards it', async () => {
    render(<TaskMatrix />)
    await userEvent.click(screen.getByRole('button', { name: /New task/ }))
    expect(useTaskStore.getState().tasks).toHaveLength(1)
    expect(useTaskStore.getState().tasks[0]).toMatchObject({ important: true, urgent: true, title: '' })
    await userEvent.keyboard('{Escape}')
    expect(useTaskStore.getState().tasks).toHaveLength(0)
    // With a name it's kept.
    await userEvent.click(screen.getByRole('button', { name: /New task/ }))
    await userEvent.keyboard('Call the bank{Enter}')
    await act(async () => {})
    expect(useTaskStore.getState().tasks.map((t) => t.title)).toEqual(['Call the bank'])
  })

  it('adds a task to a quadrant, moves it by drag & drop and completes it', async () => {
    render(<TaskMatrix />)
    const schedule = screen.getByRole('region', { name: 'Schedule' })
    await userEvent.click(within(schedule).getByText('Add task'))
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
