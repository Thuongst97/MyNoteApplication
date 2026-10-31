// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { TaskStore } from '../../electron/tasks'

let root: string
beforeEach(async () => (root = await fs.mkdtemp(path.join(os.tmpdir(), 'nc-tasks-'))))
afterEach(async () => fs.rm(root, { recursive: true, force: true }))

describe('TaskStore', () => {
  it('saves, lists and removes tasks, persisting to tasks.json', async () => {
    const s = new TaskStore(root)
    await s.save({ id: 't1', title: 'Pay rent', urgent: false })
    await s.save({ id: 't1', completed: true })
    const again = new TaskStore(root)
    const [t] = await again.list()
    expect(t).toMatchObject({ id: 't1', title: 'Pay rent', urgent: false, completed: true })
    expect(t.completedAt).toEqual(expect.any(Number))
    await again.remove('t1')
    expect(JSON.parse(await fs.readFile(path.join(root, 'tasks.json'), 'utf8'))).toEqual([])
  })

  it('validates ids', async () => {
    await expect(new TaskStore(root).save({ id: '../x' })).rejects.toThrow(/Invalid task id/)
  })

  it('stores settings with sanitised reminders', async () => {
    const s = new TaskStore(root)
    expect(await s.getSettings()).toEqual({ defaultReminders: [0, 15], runInBackground: true })
    const next = await s.setSettings({ defaultReminders: [60, 0, 60, -1], runInBackground: false })
    expect(next).toEqual({ defaultReminders: [0, 60], runInBackground: false })
    expect(await new TaskStore(root).getSettings()).toEqual(next)
  })

  it('hands out due reminders once and remembers them across restarts', async () => {
    const s = new TaskStore(root)
    const now = Date.now()
    await s.save({ id: 't', title: 'Call', dueAt: now + 60_000, reminders: [0] })
    expect(await s.takeDueReminders(now, 15_000)).toEqual([])
    const due = await s.takeDueReminders(now + 61_000, 15_000)
    expect(due.map((d) => d.task.id)).toEqual(['t'])
    expect(await new TaskStore(root).takeDueReminders(now + 62_000, 15_000)).toEqual([])
  })

  it('recovers from a corrupt tasks file', async () => {
    await fs.writeFile(path.join(root, 'tasks.json'), '{oops')
    const origError = console.error
    console.error = () => {}
    expect(await new TaskStore(root).list()).toEqual([])
    console.error = origError
  })
})
