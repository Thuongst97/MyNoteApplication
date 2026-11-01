import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts'
import { useAppStore } from '@/stores/useAppStore'
import { resetTabs, useTabsStore } from '@/stores/useTabsStore'

function Host() {
  useGlobalShortcuts()
  return null
}

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState({ pages: [], activePageId: null, view: 'page', isLoaded: true, isSearchOpen: false })
  resetTabs()
})
afterEach(() => document.body.classList.remove('whiteboard-open', 'drawing-open'))

describe('global shortcuts', () => {
  it('on a whiteboard: tab shortcuts work, keys the canvas uses (Ctrl+K…) are left to it', () => {
    document.body.classList.add('whiteboard-open')
    render(<Host />)
    fireEvent.keyDown(window, { key: 't', ctrlKey: true })
    expect(useTabsStore.getState().tabs).toHaveLength(2)
    fireEvent.keyDown(window, { key: 'w', ctrlKey: true })
    expect(useTabsStore.getState().tabs).toHaveLength(1)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(useAppStore.getState().isSearchOpen).toBe(false)
  })

  it('full-window editors (drawing, mind map, diagram viewer) keep all their keys', () => {
    document.body.classList.add('drawing-open')
    render(<Host />)
    fireEvent.keyDown(window, { key: 't', ctrlKey: true })
    expect(useTabsStore.getState().tabs).toHaveLength(1)
  })

  it('elsewhere Ctrl+K opens search', () => {
    render(<Host />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(useAppStore.getState().isSearchOpen).toBe(true)
  })
})
