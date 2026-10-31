import { create } from 'zustand'
import type { Task, TaskSettings, TaskUpdate } from '@/types'
import { api } from '@/lib/api'
import { DEFAULT_TASK_SETTINGS, newTask } from '@/lib/reminders'
import { newId } from '@/lib/utils'

interface TaskState {
  tasks: Task[]
  settings: TaskSettings
  isLoaded: boolean
  showCompleted: boolean

  load: () => Promise<void>
  add: (init: Partial<Task>) => Promise<Task>
  update: (update: TaskUpdate) => Promise<void>
  remove: (id: string) => Promise<void>
  setSettings: (patch: Partial<TaskSettings>) => Promise<void>
  setShowCompleted: (v: boolean) => void
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  settings: DEFAULT_TASK_SETTINGS,
  isLoaded: false,
  showCompleted: localStorage.getItem('notion-clone:show-completed') !== 'false',

  load: async () => {
    const [tasks, settings] = await Promise.all([api.tasks.list(), api.tasks.getSettings()])
    set({ tasks, settings, isLoaded: true })
  },

  add: async (init) => {
    const task = newTask(newId(), init, get().settings)
    set((s) => ({ tasks: [...s.tasks, task] }))
    const { sentReminders: _s, createdAt: _c, updatedAt: _u, ...fields } = task
    const saved = await api.tasks.save(fields)
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === saved.id ? saved : t)) }))
    return saved
  },

  update: async (update) => {
    // Optimistic update, then take the main process's canonical copy.
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === update.id ? { ...t, ...update } : t)) }))
    const saved = await api.tasks.save(update)
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === saved.id ? saved : t)) }))
  },

  remove: async (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    await api.tasks.remove(id)
  },

  setSettings: async (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch } }))
    const settings = await api.tasks.setSettings(patch)
    set({ settings })
  },

  setShowCompleted: (showCompleted) => {
    localStorage.setItem('notion-clone:show-completed', String(showCompleted))
    set({ showCompleted })
  },
}))

// Reload when the main process changed tasks (e.g. marked reminders as sent).
api.tasks.onChanged(() => void useTaskStore.getState().load())
