import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const savePage = vi.fn()
vi.mock('@/lib/api', () => ({ api: { savePage: (...a: unknown[]) => savePage(...a) } }))

const { AutoSaver } = await import('@/lib/autoSave')

describe('AutoSaver', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    savePage.mockReset()
    savePage.mockImplementation(async (u: { id: string }) => ({ id: u.id, updatedAt: 1 }))
  })
  afterEach(() => vi.useRealTimers())

  it('debounces and merges updates per page', async () => {
    const s = new AutoSaver(500)
    s.schedule({ id: 'a', title: 'one' })
    await vi.advanceTimersByTimeAsync(300)
    s.schedule({ id: 'a', content: { type: 'doc' } })
    await vi.advanceTimersByTimeAsync(300)
    expect(savePage).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)
    expect(savePage).toHaveBeenCalledTimes(1)
    expect(savePage).toHaveBeenCalledWith({ id: 'a', title: 'one', content: { type: 'doc' } })
  })

  it('keeps separate timers per page (switching pages never mixes edits)', async () => {
    const s = new AutoSaver(500)
    s.schedule({ id: 'a', title: 'A' })
    s.schedule({ id: 'b', title: 'B' })
    await vi.advanceTimersByTimeAsync(600)
    expect(savePage).toHaveBeenCalledTimes(2)
    expect(savePage.mock.calls.map((c) => c[0].id).sort()).toEqual(['a', 'b'])
  })

  it('flush writes immediately and cancel discards', async () => {
    const s = new AutoSaver(500)
    s.schedule({ id: 'a', title: 'now' })
    await s.flush('a')
    expect(savePage).toHaveBeenCalledTimes(1)
    s.schedule({ id: 'b', title: 'never' })
    s.cancel('b')
    await vi.advanceTimersByTimeAsync(1000)
    expect(savePage).toHaveBeenCalledTimes(1)
    expect(s.hasPending()).toBe(false)
  })

  it('flushAll writes every pending page', async () => {
    const s = new AutoSaver(500)
    s.schedule({ id: 'a', title: '1' })
    s.schedule({ id: 'b', title: '2' })
    await s.flushAll()
    expect(savePage).toHaveBeenCalledTimes(2)
  })

  it('writes for one page in order', async () => {
    const order: string[] = []
    let release: (() => void) | undefined
    savePage.mockImplementationOnce(async (u: { title: string }) => {
      await new Promise<void>((r) => (release = r))
      order.push(u.title)
      return null
    })
    savePage.mockImplementation(async (u: { title: string }) => (order.push(u.title), null))
    const s = new AutoSaver(500)
    s.schedule({ id: 'a', title: 'first' })
    const f1 = s.flush('a')
    s.schedule({ id: 'a', title: 'second' })
    const f2 = s.flush('a')
    // The first write starts on a microtask; wait for it, then let it finish.
    for (let i = 0; i < 10 && !release; i++) await Promise.resolve()
    expect(order).toEqual([]) // second write waits for the first
    release!()
    await Promise.all([f1, f2])
    expect(order).toEqual(['first', 'second'])
  })

  it('reports status and notifies saved listeners', async () => {
    const s = new AutoSaver(500)
    const statuses: string[] = []
    const saved = vi.fn()
    s.subscribe((st) => statuses.push(st))
    s.onSaved(saved)
    s.schedule({ id: 'a', title: 'x' })
    await s.flush('a')
    expect(statuses).toEqual(['pending', 'saving', 'saved'])
    expect(saved).toHaveBeenCalledWith({ id: 'a', updatedAt: 1 })
    expect(s.getStatus()).toBe('saved')
  })

  it('reports errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    savePage.mockRejectedValueOnce(new Error('disk full'))
    const s = new AutoSaver(500)
    s.schedule({ id: 'a', title: 'x' })
    await s.flush('a')
    expect(s.getStatus()).toBe('error')
  })
})
