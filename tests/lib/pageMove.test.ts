import { describe, expect, it } from 'vitest'
import { dropPositionAt, isWithin, planMove } from '@/lib/pageMove'
import type { PageMeta } from '@/types'

const pg = (id: string, parentId: string | null, order: number) => ({ id, parentId, order, createdAt: order, title: id, kind: 'page' }) as unknown as PageMeta
// ielts > (writing, speaking > (part1)), notes, guide
const pages = [pg('ielts', null, 10), pg('writing', 'ielts', 1), pg('speaking', 'ielts', 2), pg('part1', 'speaking', 1), pg('notes', null, 20), pg('guide', null, 30)]

describe('moving pages in the sidebar', () => {
  it('reads the drop position from the pointer: edges = before/after, middle = inside', () => {
    expect(dropPositionAt(2, 30)).toBe('before')
    expect(dropPositionAt(15, 30)).toBe('inside')
    expect(dropPositionAt(28, 30)).toBe('after')
  })
  it('knows sub-pages', () => {
    expect(isWithin(pages, 'part1', 'ielts')).toBe(true)
    expect(isWithin(pages, 'notes', 'ielts')).toBe(false)
  })
  it('moves a sub-page into another page (as its last child)', () => {
    expect(planMove(pages, 'writing', 'notes', 'inside')).toMatchObject({ parentId: 'notes' })
    expect(planMove(pages, 'notes', 'speaking', 'inside')).toEqual({ parentId: 'speaking', order: 1001 })
  })
  it('places a page before / after another, between its neighbours', () => {
    expect(planMove(pages, 'guide', 'writing', 'before')).toEqual({ parentId: 'ielts', order: 0 - 999 })
    expect(planMove(pages, 'guide', 'writing', 'after')).toEqual({ parentId: 'ielts', order: 1.5 })
    expect(planMove(pages, 'part1', 'notes', 'before')).toEqual({ parentId: null, order: 15 })
  })
  it('makes a page top-level when dropped on the empty space', () => {
    expect(planMove(pages, 'part1', null, 'after')).toEqual({ parentId: null, order: 1030 })
  })
  it('refuses moves into itself or its own sub-pages, and moves that change nothing', () => {
    expect(planMove(pages, 'ielts', 'part1', 'inside')).toBeNull()
    expect(planMove(pages, 'ielts', 'speaking', 'after')).toBeNull()
    expect(planMove(pages, 'ielts', 'ielts', 'inside')).toBeNull()
    expect(planMove(pages, 'writing', 'speaking', 'before')).toBeNull()
    expect(planMove(pages, 'nope', 'notes', 'inside')).toBeNull()
  })
})
