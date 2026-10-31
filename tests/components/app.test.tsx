import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from '@/components/Sidebar/Sidebar'
import { SearchModal } from '@/components/Search/SearchModal'
import { TopBar } from '@/components/TitleBar/TopBar'
import { Backlinks } from '@/components/Editor/links/Backlinks'
import { GraphView } from '@/components/Graph/GraphView'
import ChartRender from '@/components/Editor/chart/ChartRender'
import { useAppStore } from '@/stores/useAppStore'
import { useTaskStore } from '@/stores/useTaskStore'
import { api } from '@/lib/api'

const initial = useAppStore.getState()
beforeEach(() => {
  localStorage.clear()
  useAppStore.setState({ ...initial, pages: [], activePageId: null, expanded: {}, view: 'page', isSidebarOpen: true, isSearchOpen: false }, true)
  useTaskStore.setState({ tasks: [] })
})
const s = () => useAppStore.getState()

async function seed() {
  const alpha = await s().createPage(null, { title: 'Project Alpha' })
  const spec = await s().createPage(alpha, { title: 'Design Spec' })
  await api.savePage({ id: alpha, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'see ' }, { type: 'mention', attrs: { pageId: spec } }] }] } })
  return { alpha, spec }
}

describe('Sidebar', () => {
  it('shows the page tree and creates pages', async () => {
    await seed()
    render(<Sidebar />)
    const tree = screen.getByRole('tree')
    expect(within(tree).getByText('Project Alpha')).toBeInTheDocument()
    expect(within(tree).getByText('Design Spec')).toBeInTheDocument() // parent expanded
    await userEvent.click(screen.getAllByRole('button', { name: /^New page/ })[0])
    await waitFor(() => expect(s().pages).toHaveLength(3))
  })

  it('renames a page inline (F2) and deletes with confirmation', async () => {
    const { alpha } = await seed()
    render(<Sidebar />)
    const item = screen.getAllByRole('treeitem').find((el) => el.textContent?.includes('Project Alpha'))!
    item.focus()
    await userEvent.keyboard('{F2}')
    const input = within(item).getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'Project Beta{Enter}')
    expect(s().pages.find((p) => p.id === alpha)!.title).toBe('Project Beta')

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await userEvent.click(within(item).getByRole('button', { name: 'More actions' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(s().pages).toEqual([]))
  })

  it('copies a link to a page', async () => {
    const { spec } = await seed()
    render(<Sidebar />)
    const item = screen.getAllByRole('treeitem').find((el) => el.textContent?.includes('Design Spec'))!
    await userEvent.click(within(item).getByRole('button', { name: 'More actions' }))
    await userEvent.click(screen.getByRole('button', { name: 'Copy link to page' }))
    expect(await navigator.clipboard.readText()).toBe(`notionclone://page/${spec}`)
    expect(s().toast?.message).toMatch(/copied/)
  })

  it('opens Tasks, Graph view and new whiteboards, and shows the due badge', async () => {
    useTaskStore.setState({ tasks: [{ ...(await useTaskStore.getState().add({ title: 'Late', dueAt: Date.now() - 1000 })) }] })
    render(<Sidebar />)
    expect(screen.getByTitle(/due today or overdue/)).toHaveTextContent('1')
    await userEvent.click(screen.getByRole('button', { name: /^Graph view/ }))
    expect(s().view).toBe('graph')
    await userEvent.click(screen.getByRole('button', { name: /^Tasks/ }))
    expect(s().view).toBe('tasks')
    await userEvent.click(screen.getByRole('button', { name: 'New whiteboard' }))
    await waitFor(() => expect(s().pages.some((p) => p.kind === 'whiteboard')).toBe(true))
  })
})

describe('SearchModal', () => {
  it('finds pages by title and content and opens the chosen one', async () => {
    const { spec } = await seed()
    await api.savePage({ id: spec, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'login must be fast' }] }] } })
    s().setSearchOpen(true)
    render(<SearchModal />)
    await userEvent.type(screen.getByPlaceholderText('Search pages…'), 'login')
    expect(await screen.findByText('login must be fast')).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    expect(s().activePageId).toBe(spec)
    expect(s().isSearchOpen).toBe(false)
  })
})

describe('TopBar', () => {
  it('shows breadcrumbs for nested pages', async () => {
    const { spec } = await seed()
    s().setActivePage(spec)
    render(<TopBar />)
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(nav).toHaveTextContent('Project Alpha')
    expect(nav).toHaveTextContent('Design Spec')
  })
})

describe('Backlinks', () => {
  it('lists pages linking here', async () => {
    const { alpha, spec } = await seed()
    render(<Backlinks pageId={spec} />)
    expect(await screen.findByText(/Linked from 1 page/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Project Alpha' }))
    expect(s().activePageId).toBe(alpha)
  })
})

describe('GraphView', () => {
  it('counts pages and links', async () => {
    await seed()
    render(<GraphView />)
    expect(await screen.findByText('2 pages · 1 links')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Graph of 2 pages' })).toBeInTheDocument()
  })
})

describe('ChartRender', () => {
  it('renders parts of a whole with a legend and accessible labels', () => {
    render(
      <ChartRender
        theme="light"
        spec={{ type: 'parts', title: 'Budget', labels: ['Eng', 'Sales'], series: [{ name: 'Budget', values: [300, 100] }] }}
      />,
    )
    expect(screen.getByText('400')).toBeInTheDocument()
    expect(screen.getByLabelText('Eng: 300 (75.0%)')).toBeInTheDocument()
    expect(screen.getByText('Sales')).toBeInTheDocument()
  })
})
