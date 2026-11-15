import { describe, expect, it } from 'vitest'
import { useAppStore } from '@/stores/useAppStore'

describe('sidebar side', () => {
  it('is on the left by default, can move right and back, and is saved', () => {
    expect(useAppStore.getState().sidebarSide).toBe('left')
    useAppStore.getState().setSidebarSide('right')
    expect(useAppStore.getState().sidebarSide).toBe('right')
    expect(JSON.parse(localStorage.getItem('notion-clone:prefs') ?? '{}').sidebarSide).toBe('right')
    useAppStore.getState().setSidebarSide('nonsense' as never)
    expect(useAppStore.getState().sidebarSide).toBe('left')
  })
})
