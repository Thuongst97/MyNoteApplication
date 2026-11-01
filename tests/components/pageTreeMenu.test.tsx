import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PageTreeItem } from '@/components/Sidebar/PageTreeItem'
import { useAppStore } from '@/stores/useAppStore'
import type { PageMeta } from '@/types'

const page = (id: string, title: string, parentId: string | null, kind: 'doc' | 'whiteboard' = 'doc'): PageMeta => ({
  id,
  kind,
  title,
  icon: null,
  cover: null,
  parentId,
  order: 0,
  createdAt: 0,
  updatedAt: 0,
})

afterEach(() => vi.restoreAllMocks())

describe('sidebar page menu', () => {
  it('opens for pages nested inside a whiteboard (not clipped by the folded group)', async () => {
    const createPage = vi.fn(async () => 'new')
    useAppStore.setState({
      pages: [page('wb', 'Untitled whiteboard', null, 'whiteboard'), page('asd', 'asd', 'wb'), page('child', '', 'asd')],
      expanded: { wb: true, asd: true },
      createPage,
    } as never)
    render(<PageTreeItem page={useAppStore.getState().pages[0]} depth={0} />)

    const nested = screen.getAllByRole('button', { name: 'More actions' })
    expect(nested).toHaveLength(3)
    await userEvent.click(nested[2]) // the "Untitled" page two levels down
    const menu = await screen.findByRole('menu')
    // Rendered outside the sidebar tree, so no overflow:hidden ancestor can hide it.
    expect(menu.parentElement).toBe(document.body)
    expect(menu.closest('[role="group"]')).toBeNull()
    for (const item of ['Add sub-page', 'Add whiteboard inside', 'Copy link to page', 'Rename', 'Delete'])
      expect(within(menu).getByRole('button', { name: new RegExp(item) })).toBeInTheDocument()

    await userEvent.click(within(menu).getByRole('button', { name: /Add sub-page/ }))
    expect(createPage).toHaveBeenCalledWith('child')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('clicking ••• again closes the menu', async () => {
    useAppStore.setState({ pages: [page('a', 'A', null)], expanded: {} } as never)
    render(<PageTreeItem page={useAppStore.getState().pages[0]} depth={0} />)
    const button = screen.getByRole('button', { name: 'More actions' })
    await userEvent.click(button)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.click(button)
    expect(screen.queryByRole('menu')).toBeNull()
    await userEvent.click(button)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
