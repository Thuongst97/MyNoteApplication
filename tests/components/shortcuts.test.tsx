import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts'
import { useAppStore } from '@/stores/useAppStore'
import { resetTabs, useTabsStore } from '@/stores/useTabsStore'
import { useFindStore } from '@/stores/useFindStore'

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
  it('on a whiteboard: tab shortcuts work, keys the canvas uses (Ctrl+F, Ctrl+K…) are left to it', () => {
    document.body.classList.add('whiteboard-open')
    render(<Host />)
    fireEvent.keyDown(window, { key: 't', ctrlKey: true })
    expect(useTabsStore.getState().tabs).toHaveLength(2)
    fireEvent.keyDown(window, { key: 'w', ctrlKey: true })
    expect(useTabsStore.getState().tabs).toHaveLength(1)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
    expect(useAppStore.getState().isSearchOpen).toBe(false)
    expect(useFindStore.getState().open).toBe(false)
  })

  it('full-window editors (drawing, mind map, diagram viewer) keep all their keys', () => {
    document.body.classList.add('drawing-open')
    render(<Host />)
    fireEvent.keyDown(window, { key: 't', ctrlKey: true })
    expect(useTabsStore.getState().tabs).toHaveLength(1)
  })

  it('Ctrl+Shift+F searches all pages; Ctrl+K no longer does', () => {
    render(<Host />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(useAppStore.getState().isSearchOpen).toBe(false)
    fireEvent.keyDown(window, { key: 'F', ctrlKey: true, shiftKey: true })
    expect(useAppStore.getState().isSearchOpen).toBe(true)
  })

  it('Ctrl+F opens the find bar for the open tab (with the selected text), or all-pages search where there is nothing to find in', () => {
    render(<Host />)
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
    expect(useAppStore.getState().isSearchOpen).toBe(true) // no find target (e.g. Tasks)
    useAppStore.setState({ isSearchOpen: false })
    const provider = { search: () => 0, reveal: () => {}, clear: () => {}, selectedText: () => 'CAN bus' }
    useFindStore.setState({ provider, open: false, query: '' })
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
    expect(useFindStore.getState()).toMatchObject({ open: true, query: 'CAN bus' })
    expect(useAppStore.getState().isSearchOpen).toBe(false)
    useFindStore.setState({ provider: null, open: false, query: '' })
  })
})
