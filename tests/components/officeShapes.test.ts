import { describe, expect, it } from 'vitest'
import { fillForTool, isTypingKey, OFFICE_SHAPE_DEFAULTS, SHAPE_FILL } from '@/components/Whiteboard/officeShapes'

const st = (type: string, bg: string) => ({ activeTool: { type } as never, currentItemBackgroundColor: bg })
const key = (k: string, mods: Partial<KeyboardEvent> = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...mods })

describe('PowerPoint-like shapes', () => {
  it('new shapes are filled solid by default', () => {
    expect(OFFICE_SHAPE_DEFAULTS).toEqual({ currentItemBackgroundColor: SHAPE_FILL, currentItemFillStyle: 'solid' })
  })
  it('the pen draws without fill, and shapes get their fill back afterwards', () => {
    const stash = { fill: null as string | null }
    expect(fillForTool(st('rectangle', SHAPE_FILL), stash)).toBeUndefined()
    expect(fillForTool(st('freedraw', SHAPE_FILL), stash)).toBe('transparent')
    expect(stash.fill).toBe(SHAPE_FILL)
    expect(fillForTool(st('freedraw', 'transparent'), stash)).toBeUndefined()
    expect(fillForTool(st('ellipse', 'transparent'), stash)).toBe(SHAPE_FILL)
    expect(stash.fill).toBeNull()
    // A fill the user set to none for shapes stays none.
    expect(fillForTool(st('rectangle', 'transparent'), stash)).toBeUndefined()
  })
  it('only plain characters start typing into a shape (shortcuts keep working)', () => {
    expect(isTypingKey(key('a'))).toBe(true)
    expect(isTypingKey(key('Ä'))).toBe(true)
    expect(isTypingKey(key('7'))).toBe(true)
    expect(isTypingKey(key('Enter'))).toBe(false)
    expect(isTypingKey(key(' '))).toBe(false)
    expect(isTypingKey(key('c', { ctrlKey: true }))).toBe(false)
    expect(isTypingKey(key('z', { metaKey: true }))).toBe(false)
  })
})
