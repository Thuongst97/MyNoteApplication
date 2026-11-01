import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReminderSettings, summarizeReminders } from '@/components/Tasks/ReminderSettings'
import { useTaskStore } from '@/stores/useTaskStore'
import { api } from '@/lib/api'

const initial = useTaskStore.getState()
beforeEach(() => {
  const setSettings = vi.fn(async (patch) => useTaskStore.setState((s) => ({ settings: { ...s.settings, ...patch } })))
  useTaskStore.setState({ ...initial, settings: { defaultReminders: [0, 15], runInBackground: true }, setSettings } as never, true)
})

describe('reminder settings', () => {
  it('summarizes the selection compactly', () => {
    expect(summarizeReminders([])).toBe('None')
    expect(summarizeReminders([15, 0])).toBe('At due time, 15m before')
    expect(summarizeReminders([0, 15, 60, 1440])).toBe('At due time +3 more')
  })

  it('picks reminders from one dropdown instead of a wall of chips', async () => {
    render(<ReminderSettings />)
    await userEvent.click(screen.getByRole('button', { name: 'Reminders' }))
    // No helper paragraph and no chip buttons up front.
    expect(screen.queryByText(/Used for new tasks/)).toBeNull()
    expect(screen.queryByText(/Needed for reminders/)).toBeNull()
    expect(screen.queryByRole('option')).toBeNull()

    const picker = screen.getByRole('button', { name: 'Default reminders' })
    expect(picker).toHaveTextContent('At due time, 15m before')
    await userEvent.click(picker)
    const list = screen.getByRole('listbox', { name: 'Reminder times' })
    const options = within(list).getAllByRole('option')
    expect(options).toHaveLength(8)
    expect(options.filter((o) => o.getAttribute('aria-selected') === 'true').map((o) => o.textContent)).toEqual(['At due time', '15 minutes before'])
    await userEvent.click(within(list).getByRole('option', { name: '1 hour before' }))
    await userEvent.click(within(list).getByRole('option', { name: 'At due time' }))
    expect(useTaskStore.getState().settings.defaultReminders).toEqual([15, 60])
    expect(picker).toHaveTextContent('15m before, 1h before')
  })

  it('sends a test notification from a secondary button', async () => {
    const spy = vi.spyOn(api.tasks, 'testNotification').mockResolvedValue(true)
    render(<ReminderSettings />)
    await userEvent.click(screen.getByRole('button', { name: 'Reminders' }))
    await userEvent.click(screen.getByRole('button', { name: 'Send test notification' }))
    expect(spy).toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('Sent')
  })
})
