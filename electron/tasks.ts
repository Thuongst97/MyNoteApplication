import fs from 'node:fs/promises'
import path from 'node:path'
import type { Task, TaskSettings, TaskUpdate } from '../src/types'
import { cleanQuadrantBackgrounds, cleanQuadrantColors } from '../src/lib/quadrantColors'
import { applyTaskUpdate, collectDueReminders, DEFAULT_TASK_SETTINGS, type DueNotification } from '../src/lib/reminders'

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') console.error(`[tasks] could not read ${file}:`, err)
    return fallback
  }
}

async function writeJsonAtomic(file: string, data: unknown) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 1), 'utf8')
  await fs.rename(tmp, file)
}

/** Tasks live in `<userData>/tasks.json`, settings in `<userData>/task-settings.json`. */
export class TaskStore {
  private tasks = new Map<string, Task>()
  private settings: TaskSettings = { ...DEFAULT_TASK_SETTINGS }
  private loaded: Promise<void> | null = null
  private writeChain: Promise<unknown> = Promise.resolve()
  private readonly tasksFile: string
  private readonly settingsFile: string

  constructor(root: string) {
    this.tasksFile = path.join(root, 'tasks.json')
    this.settingsFile = path.join(root, 'task-settings.json')
  }

  load() {
    if (!this.loaded) {
      this.loaded = (async () => {
        await fs.mkdir(path.dirname(this.tasksFile), { recursive: true })
        const list = await readJson<Task[]>(this.tasksFile, [])
        for (const t of Array.isArray(list) ? list : []) if (t && typeof t.id === 'string') this.tasks.set(t.id, t)
        this.settings = { ...DEFAULT_TASK_SETTINGS, ...(await readJson<Partial<TaskSettings>>(this.settingsFile, {})) }
        this.settings = withQuadrantColors(this.settings, this.settings.quadrantColors)
        this.settings = withQuadrantBackgrounds(this.settings, this.settings.quadrantBackgrounds)
      })()
    }
    return this.loaded
  }

  private persistTasks() {
    const snapshot = [...this.tasks.values()]
    this.writeChain = this.writeChain.catch(() => undefined).then(() => writeJsonAtomic(this.tasksFile, snapshot))
    return this.writeChain
  }

  async list() {
    await this.load()
    return [...this.tasks.values()]
  }

  async save(update: TaskUpdate): Promise<Task> {
    await this.load()
    if (typeof update?.id !== 'string' || !ID_PATTERN.test(update.id)) throw new Error('Invalid task id')
    const task = applyTaskUpdate(this.tasks.get(update.id) ?? null, update)
    this.tasks.set(task.id, task)
    await this.persistTasks()
    return task
  }

  async remove(id: string) {
    await this.load()
    this.tasks.delete(id)
    await this.persistTasks()
  }

  async getSettings() {
    await this.load()
    return this.settings
  }

  async setSettings(patch: Partial<TaskSettings>) {
    await this.load()
    const next: TaskSettings = { ...this.settings }
    if (Array.isArray(patch.defaultReminders))
      next.defaultReminders = [...new Set(patch.defaultReminders.map(Number).filter((m) => Number.isFinite(m) && m >= 0))].sort((a, b) => a - b)
    if (typeof patch.runInBackground === 'boolean') next.runInBackground = patch.runInBackground
    let withColors = patch.quadrantColors !== undefined ? withQuadrantColors(next, patch.quadrantColors) : next
    if (patch.quadrantBackgrounds !== undefined) withColors = withQuadrantBackgrounds(withColors, patch.quadrantBackgrounds)
    this.settings = withColors
    await writeJsonAtomic(this.settingsFile, this.settings)
    return this.settings
  }

  /** Returns reminders that are due now and records them as sent. */
  async takeDueReminders(now: number, intervalMs: number): Promise<DueNotification[]> {
    await this.load()
    const { notifications, changed } = collectDueReminders([...this.tasks.values()], now, intervalMs)
    if (changed.length) {
      changed.forEach((t) => this.tasks.set(t.id, t))
      await this.persistTasks()
    }
    return notifications
  }
}

/** Stores only valid custom quadrant colors, and no key at all when none are set. */
function withQuadrantColors(settings: TaskSettings, raw: unknown): TaskSettings {
  const { quadrantColors: _old, ...rest } = settings
  const colors = cleanQuadrantColors(raw)
  return Object.keys(colors).length ? { ...rest, quadrantColors: colors } : rest
}

/** Stores only valid quadrant backgrounds, and no key at all when none are set. */
function withQuadrantBackgrounds(settings: TaskSettings, raw: unknown): TaskSettings {
  const { quadrantBackgrounds: _old, ...rest } = settings
  const bgs = cleanQuadrantBackgrounds(raw)
  return Object.keys(bgs).length ? { ...rest, quadrantBackgrounds: bgs } : rest
}
