import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TabBar } from '@/components/Tabs/TabBar'
import { useAppStore } from '@/stores/useAppStore'
import { resetTabs } from '@/stores/useTabsStore'
import type { PageMeta } from '@/types'

const wb: PageMeta = { id: 'wb', kind: 'whiteboard', title: 'Untitled whiteboard', icon: null, cover: null, parentId: null, order: 0, createdAt: 0, updatedAt: 0 }

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState({ pages: [wb], activePageId: 'wb', view: 'page', isLoaded: true })
  resetTabs()
})

describe('TabBar', () => {
  it('renames the page by double-clicking its tab (Enter saves, Esc cancels)', () => {
    render(<TabBar />)
    const tab = screen.getByRole('tab', { selected: true })
    expect(tab).toHaveTextContent('Untitled whiteboard')
    fireEvent.doubleClick(tab)
    const input = screen.getByRole('textbox', { name: 'Rename page' })
    fireEvent.change(input, { target: { value: 'Writing plan' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useAppStore.getState().pages[0].title).toBe('Writing plan')
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Writing plan')

    fireEvent.doubleClick(screen.getByRole('tab', { selected: true }))
    const again = screen.getByRole('textbox', { name: 'Rename page' })
    fireEvent.change(again, { target: { value: 'Nope' } })
    fireEvent.keyDown(again, { key: 'Escape' })
    expect(useAppStore.getState().pages[0].title).toBe('Writing plan')
  })
})
