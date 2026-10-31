import { describe, expect, it, vi } from 'vitest'
import { createRef } from 'react'
import { act, render, screen } from '@testing-library/react'
import { SlashMenu, type SlashMenuHandle } from '@/components/Editor/SlashMenu'
import { PageSuggestMenu, type PageSuggestMenuHandle } from '@/components/Editor/links/PageSuggestMenu'
import { filterSlashCommands } from '@/components/Editor/slashCommands'
import type { PageMeta } from '@/types'

const key = (k: string) => new KeyboardEvent('keydown', { key: k })

describe('SlashMenu', () => {
  it('navigates with arrow keys and runs the selected command with Enter', () => {
    const command = vi.fn()
    const ref = createRef<SlashMenuHandle>()
    const items = filterSlashCommands('heading')
    render(<SlashMenu ref={ref} items={items} command={command} />)
    expect(screen.getByText('Heading 1')).toBeInTheDocument()
    act(() => void ref.current!.onKeyDown(key('ArrowDown')))
    act(() => void ref.current!.onKeyDown(key('Enter')))
    expect(command).toHaveBeenCalledWith(items[1])
    expect(ref.current!.onKeyDown(key('a'))).toBe(false)
  })

  it('shows "No results"', () => {
    render(<SlashMenu items={[]} command={() => {}} />)
    expect(screen.getByText('No results')).toBeInTheDocument()
  })
})

describe('PageSuggestMenu', () => {
  const page = (id: string, title: string): PageMeta => ({ id, kind: 'doc', title, icon: null, cover: null, parentId: null, order: 0, createdAt: 0, updatedAt: 0 })

  it('lists pages with their path and a create option', () => {
    const command = vi.fn()
    const ref = createRef<PageSuggestMenuHandle>()
    const items = [
      { kind: 'page' as const, page: page('a', 'Design Spec'), path: 'Project Alpha' },
      { kind: 'create' as const, title: 'Desi' },
    ]
    render(<PageSuggestMenu ref={ref} items={items} command={command} />)
    expect(screen.getByText('Design Spec')).toBeInTheDocument()
    expect(screen.getByText('Project Alpha')).toBeInTheDocument()
    expect(screen.getByText(/New page/)).toBeInTheDocument()
    act(() => void ref.current!.onKeyDown(key('ArrowUp'))) // wraps to the last item
    act(() => void ref.current!.onKeyDown(key('Enter')))
    expect(command).toHaveBeenCalledWith(items[1])
  })
})
