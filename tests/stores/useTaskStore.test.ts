import { beforeEach, describe, expect, it } from 'vitest'
import { useTaskStore } from '@/stores/useTaskStore'
import { api } from '@/lib/api'

const initial = useTaskStore.getState()
beforeEach(() => {
  localStorage.clear()
  useTaskStore.setState({ ...initial, tasks: [], isLoaded: false }, true)
})
const s = () => useTaskStore.getState()

describe('useTaskStore', () => {
  it('loads tasks and settings', async () => {
    await api.tasks.save({ id: 'x', title: 'Existing' })
    await s().load()
    expect(s().isLoaded).toBe(true)
    expect(s().tasks.map((t) => t.title)).toEqual(['Existing'])
    expect(s().settings.defaultReminders).toEqual([0, 15])
  })

  it('adds tasks with default reminders and saves them', async () => {
    await s().setSettings({ defaultReminders: [60] })
    const t = await s().add({ title: 'Plan', important: true, urgent: false })
    expect(t).toMatchObject({ title: 'Plan', urgent: false, reminders: [60] })
    expect((await api.tasks.list())[0].title).toBe('Plan')
  })

  it('updates (optimistically) and removes tasks', async () => {
    const t = await s().add({ title: 'Do it' })
    await s().update({ id: t.id, completed: true })
    expect(s().tasks[0].completed).toBe(true)
    expect(s().tasks[0].completedAt).toEqual(expect.any(Number))
    await s().remove(t.id)
    expect(s().tasks).toEqual([])
    expect(await api.tasks.list()).toEqual([])
  })

  it('remembers whether completed tasks are shown', () => {
    s().setShowCompleted(false)
    expect(localStorage.getItem('notion-clone:show-completed')).toBe('false')
  })
})
