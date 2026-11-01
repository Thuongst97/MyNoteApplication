import { describe, expect, it } from 'vitest'
import {
  addChild,
  addSibling,
  countNodes,
  findNode,
  findParent,
  layoutMindMap,
  listToMindMap,
  mindMapText,
  mindMapToList,
  moveNode,
  navigate,
  newMindMap,
  newNode,
  normalizeMindMap,
  removeNode,
  reorderNode,
  updateNode,
  wrapText,
  type MindMap,
} from '@/components/Editor/mindmap/mindmapModel'

const measure = (t: string) => t.length * 8
const names = (m: MindMap) => {
  const f = (n: MindMap['root']): string => n.text + (n.children.length ? `(${n.children.map(f).join(',')})` : '')
  return f(m.root)
}
const byText = (m: MindMap, text: string) => {
  let hit: string | null = null
  const walk = (n: MindMap['root']) => (n.text === text ? (hit = n.id) : n.children.forEach(walk))
  walk(m.root)
  return hit!
}
const sample = () => newMindMap('Root', ['A', 'B', 'C'])

describe('mind map edits', () => {
  it('adds children and siblings without mutating the original', () => {
    const m = sample()
    const a = byText(m, 'A')
    const r1 = addChild(m, a, 'A1')
    expect(names(m)).toBe('Root(A,B,C)')
    expect(names(r1.map)).toBe('Root(A(A1),B,C)')
    const r2 = addSibling(r1.map, r1.id, 'A2')
    expect(names(r2.map)).toBe('Root(A(A1,A2),B,C)')
    // a sibling of the root is a child
    expect(names(addSibling(m, m.root.id, 'D').map)).toBe('Root(A,B,C,D)')
  })

  it('adding a child unfolds a collapsed topic', () => {
    let m = sample()
    const a = byText(m, 'A')
    m = addChild(m, a, 'x').map
    m = updateNode(m, a, { collapsed: true })
    expect(findNode(addChild(m, a, 'y').map.root, a)!.collapsed).toBe(false)
  })

  it('updates text, notes and colors (empty note is removed)', () => {
    const m = sample()
    const b = byText(m, 'B')
    const m2 = updateNode(m, b, { text: 'Bee', note: 'details', color: 3 })
    expect(findNode(m2.root, b)).toMatchObject({ text: 'Bee', note: 'details', color: 3 })
    expect(findNode(updateNode(m2, b, { note: '' }).root, b)!.note).toBeUndefined()
  })

  it('removes topics (not the root) and picks the next one to select', () => {
    const m = sample()
    const b = byText(m, 'B')
    const r = removeNode(m, b)
    expect(names(r.map)).toBe('Root(A,C)')
    expect(r.select).toBe(byText(m, 'C'))
    expect(removeNode(m, byText(m, 'C')).select).toBe(b) // last one → previous sibling
    expect(removeNode(m, m.root.id).map).toBe(m)
  })

  it('moves topics, refusing cycles and the root', () => {
    let m = sample()
    const a = byText(m, 'A')
    m = addChild(m, a, 'A1').map
    const a1 = byText(m, 'A1')
    expect(names(moveNode(m, byText(m, 'C'), a1))).toBe('Root(A(A1(C)),B)')
    expect(moveNode(m, a, a1)).toBe(m) // into its own sub-tree
    expect(moveNode(m, m.root.id, a)).toBe(m)
    expect(names(moveNode(m, byText(m, 'C'), m.root.id, 0))).toBe('Root(C,A(A1),B)')
    expect(names(moveNode(m, a, m.root.id, 3))).toBe('Root(B,C,A(A1))') // same parent, index adjusted
  })

  it('reorders siblings', () => {
    const m = sample()
    expect(names(reorderNode(m, byText(m, 'C'), -1))).toBe('Root(A,C,B)')
    expect(reorderNode(m, byText(m, 'A'), -1)).toBe(m)
  })

  it('finds parents, counts and collects text (topics + notes) for search', () => {
    const m = updateNode(sample(), byText(sample(), 'A'), {})
    expect(findParent(m.root, byText(m, 'B'))!.id).toBe(m.root.id)
    expect(countNodes(m.root)).toBe(4)
    const withNote = updateNode(m, byText(m, 'A'), { note: 'remember this' })
    expect(mindMapText(withNote)).toBe('Root\nA\nremember this\nB\nC')
    expect(mindMapText(null)).toBe('')
  })

  it('normalises stored data', () => {
    const m = normalizeMindMap({ root: { text: 'R', children: [{ text: 'x' }, null] }, layout: 'weird' })
    expect(m.layout).toBe('balanced')
    expect(m.root.children).toHaveLength(2)
    expect(m.root.children[0].id).toBeTruthy()
    expect(normalizeMindMap(null).root.text).toBe('Central topic')
  })
})

describe('layout', () => {
  it('places the root at the center and splits branches over both sides', () => {
    const m = newMindMap('Root', ['A', 'B', 'C', 'D'])
    const l = layoutMindMap(m, measure)
    const root = l.byId.get(m.root.id)!
    expect(root).toMatchObject({ x: 0, y: 0, depth: 0, color: -1 })
    const sides = m.root.children.map((c) => l.byId.get(c.id)!.side)
    expect(sides.filter((s) => s === 1).length).toBe(2)
    expect(sides.filter((s) => s === -1).length).toBe(2)
    // first-level branches get palette colors in order
    expect(m.root.children.map((c) => l.byId.get(c.id)!.color)).toEqual([0, 1, 2, 3])
  })

  it('puts everything on the right in right-only layout and keeps topics from overlapping', () => {
    let m: MindMap = { ...newMindMap('Root', ['A', 'B', 'C']), layout: 'right' }
    m = addChild(m, byText(m, 'A'), 'A1').map
    m = addChild(m, byText(m, 'A'), 'A2').map
    const l = layoutMindMap(m, measure)
    const nodes = l.nodes.filter((n) => n.depth > 0)
    expect(nodes.every((n) => n.side === 1 && n.x > 0)).toBe(true)
    for (const a of nodes)
      for (const b of nodes)
        if (a !== b && a.depth === b.depth) expect(Math.abs(a.y - b.y) >= (a.h + b.h) / 2 - 0.01 || Math.abs(a.x - b.x) > 1).toBe(true)
    // sub-topics inherit their branch color and sit further out
    const a1 = l.byId.get(byText(m, 'A1'))!
    expect(a1.color).toBe(l.byId.get(byText(m, 'A'))!.color)
    expect(a1.x).toBeGreaterThan(l.byId.get(byText(m, 'A'))!.x)
  })

  it('hides children of folded topics and reports how many', () => {
    let m = sample()
    const a = byText(m, 'A')
    m = addChild(m, a, 'A1').map
    m = addChild(m, a, 'A2').map
    m = updateNode(m, a, { collapsed: true })
    const l = layoutMindMap(m, measure)
    expect(l.byId.has(byText(m, 'A1'))).toBe(false)
    expect(l.byId.get(a)!.hiddenChildren).toBe(2)
  })

  it('applies topic colors to sub-topics unless they have their own', () => {
    let m = sample()
    const a = byText(m, 'A')
    m = addChild(m, a, 'A1').map
    m = addChild(m, byText(m, 'A1'), 'A1x').map
    m = addChild(m, a, 'A2').map
    m = updateNode(m, a, { color: 6 })
    m = updateNode(m, byText(m, 'A1'), { color: '#ff8800' })
    const l = layoutMindMap(m, measure)
    const col = (t: string) => l.byId.get(byText(m, t))!.color
    expect(col('A')).toBe(6)
    expect(col('A2')).toBe(6) // inherits from A
    expect(col('A1')).toBe('#ff8800') // own custom color
    expect(col('A1x')).toBe('#ff8800') // inherits from A1
    expect(col('B')).toBe(1) // untouched branches keep palette order
  })

  it('colors the central topic and clears colors with undefined', () => {
    const m = updateNode(sample(), sample().root.id, {})
    const colored = updateNode(m, m.root.id, { color: '#123456' })
    expect(layoutMindMap(colored, measure).byId.get(m.root.id)!.color).toBe('#123456')
    expect(layoutMindMap(m, measure).byId.get(m.root.id)!.color).toBe(-1)
    expect(findNode(updateNode(colored, m.root.id, { color: undefined }).root, m.root.id)!.color).toBeUndefined()
  })

  it('keeps only valid stored colors', () => {
    const m = normalizeMindMap({ root: { text: 'R', color: '#ABCDEF', children: [{ text: 'a', color: 2 }, { text: 'b', color: 'red' }, { text: 'c', color: -1 }] } })
    expect(m.root.color).toBe('#ABCDEF')
    expect(m.root.children.map((c) => c.color)).toEqual([2, undefined, undefined])
  })

  it('wraps long text', () => {
    expect(wrapText('word '.repeat(20).trim(), '14px', measure).length).toBeGreaterThan(1)
  })

  it('navigates with arrow keys by direction', () => {
    let m: MindMap = { ...newMindMap('Root', ['A', 'B']), layout: 'right' }
    m = addChild(m, byText(m, 'A'), 'A1').map
    const l = layoutMindMap(m, measure)
    const [a, b, a1] = ['A', 'B', 'A1'].map((t) => byText(m, t))
    expect(navigate(m, l, m.root.id, 'ArrowRight')).toBe(a)
    expect(navigate(m, l, a, 'ArrowRight')).toBe(a1)
    expect(navigate(m, l, a1, 'ArrowLeft')).toBe(a)
    expect(navigate(m, l, a, 'ArrowDown')).toBe(b)
    expect(navigate(m, l, b, 'ArrowUp')).toBe(a)
    expect(navigate(m, l, a, 'ArrowLeft')).toBe(m.root.id)
  })
})

describe('lists ↔ mind maps', () => {
  const li = (text: string, sub?: unknown) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }, ...(sub ? [sub] : [])] })
  const ul = (...items: unknown[]) => ({ type: 'bulletList', content: items })

  it('turns a nested list into a map under the given root', () => {
    const m = listToMindMap(ul(li('Plan', ul(li('Research'), li('Build'))), li('Launch')) as never, 'My page')
    expect(names(m)).toBe('My page(Plan(Research,Build),Launch)')
  })

  it('uses a single top-level item as the central topic', () => {
    expect(names(listToMindMap(ul(li('Project', ul(li('A'), li('B')))) as never))).toBe('Project(A,B)')
  })

  it('turns a map into a bold root line plus a nested bullet list, and back again', () => {
    let m = newMindMap('Topic', ['One', 'Two'])
    m = addChild(m, byText(m, 'One'), 'Deep').map
    const blocks = mindMapToList(m)
    expect(blocks[0]).toMatchObject({ type: 'paragraph', content: [{ text: 'Topic', marks: [{ type: 'bold' }] }] })
    expect(names(listToMindMap(blocks[1], 'Topic'))).toBe('Topic(One(Deep),Two)')
    expect(mindMapToList({ root: newNode('Alone'), layout: 'balanced' })).toHaveLength(1)
  })
})
