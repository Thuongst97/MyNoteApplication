import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { selectChildren, useAppStore, useChildPages } from '@/stores/useAppStore'
import type { PageMeta } from '@/types'

const page = (id: string, parentId: string | null, order: number, title = id): PageMeta => ({ id, kind: 'doc', title, icon: null, cover: null, parentId, order, createdAt: order, updatedAt: 0 })

describe('sidebar children', () => {
  it('groups and sorts children once per page list', () => {
    const pages = [page('b', null, 2), page('a', null, 1), page('a1', 'a', 1)]
    expect(selectChildren(pages, null).map((p) => p.id)).toEqual(['a', 'b'])
    expect(selectChildren(pages, 'a').map((p) => p.id)).toEqual(['a1'])
    expect(selectChildren(pages, 'zzz')).toEqual([])
    expect(selectChildren(pages, null)).toBe(selectChildren(pages, null)) // cached
  })

  it('does not re-render rows when a page is only auto-saved (updatedAt)', () => {
    useAppStore.setState({ pages: [page('a', null, 1), page('a1', 'a', 1)] })
    let renders = 0
    const { result } = renderHook(() => {
      renders++
      return useChildPages('a')
    })
    const first = result.current
    act(() => useAppStore.setState((s) => ({ pages: s.pages.map((p) => ({ ...p, updatedAt: Date.now() })) })))
    expect(result.current).toBe(first)
    expect(renders).toBe(1)
    // A visible change (title) does update the rows.
    act(() => useAppStore.setState((s) => ({ pages: s.pages.map((p) => (p.id === 'a1' ? { ...p, title: 'Renamed' } : p)) })))
    expect(result.current[0].title).toBe('Renamed')
  })
})
