import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MindMapEditor } from '@/components/Editor/mindmap/MindMapEditor'
import { newMindMap, type MindMap } from '@/components/Editor/mindmap/mindmapModel'

const names = (m: MindMap) => {
  const f = (n: MindMap['root']): string => n.text + (n.children.length ? `(${n.children.map(f).join(',')})` : '')
  return f(m.root)
}

function setup(map = newMindMap('Plan')) {
  const onClose = vi.fn()
  render(<MindMapEditor initial={map} theme="light" onClose={onClose} />)
  const dialog = screen.getByRole('dialog', { name: 'Mind map editor' })
  const key = (k: string, opts: object = {}) => fireEvent.keyDown(document.activeElement ?? dialog, { key: k, ...opts })
  return { onClose, dialog, key }
}

describe('MindMapEditor', () => {
  it('builds a map with the keyboard (Tab = sub-topic, Enter = topic) and saves', async () => {
    const { onClose, dialog } = setup()
    dialog.focus()
    await userEvent.keyboard('{Tab}Goals{Tab}Revenue{Enter}Users{Escape}{Home}{Tab}Risks{Escape}')
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(names(onClose.mock.calls[0][0])).toBe('Plan(Goals(Revenue,Users),Risks)')
  })

  it('typing on a selected topic replaces its text; F2 edits it', async () => {
    const { onClose, dialog } = setup(newMindMap('Old'))
    dialog.focus()
    await userEvent.keyboard('New name{Enter}')
    await userEvent.keyboard('{F2}{End} v2{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClose.mock.calls[0][0].root.text).toBe('New name v2')
  })

  it('Escape on a new empty topic removes it again', async () => {
    const { onClose, dialog } = setup()
    dialog.focus()
    await userEvent.keyboard('{Tab}{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClose.mock.calls[0][0].root.children).toEqual([])
  })

  it('deletes, undoes and redoes', async () => {
    const { onClose, dialog } = setup(newMindMap('R', ['A', 'B']))
    dialog.focus()
    await userEvent.keyboard('{ArrowRight}') // select first branch
    await userEvent.keyboard('{Delete}')
    await userEvent.keyboard('{Control>}z{/Control}')
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClose.mock.calls[0][0].root.children).toHaveLength(1)
  })

  it('folds a branch with Space and documents topics in the notes panel', async () => {
    let map = newMindMap('R', ['A'])
    map = { ...map, root: { ...map.root, children: [{ ...map.root.children[0], children: [{ id: 'k', text: 'Kid', children: [] }] }] } }
    const { onClose, dialog } = setup(map)
    dialog.focus()
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.type(screen.getByLabelText('Topic notes'), 'Why this matters')
    dialog.focus()
    await userEvent.keyboard(' ')
    expect(screen.getByLabelText('Expand (1 hidden)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const a = onClose.mock.calls[0][0].root.children[0]
    expect(a).toMatchObject({ text: 'A', note: 'Why this matters', collapsed: true })
  })

  it('switches layout and cancels without saving', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { onClose, dialog } = setup(newMindMap('R', ['A']))
    dialog.focus()
    await userEvent.click(screen.getByRole('button', { name: 'Both sides' }))
    expect(screen.getByRole('button', { name: 'Right only' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(window.confirm).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledWith(null)
  })

  it('colors any topic: palette, custom and the central topic; Auto resets', async () => {
    let map = newMindMap('R', ['A', 'B'])
    map = { ...map, root: { ...map.root, children: [{ ...map.root.children[0], children: [{ id: 'k', text: 'Kid', children: [] }] }, map.root.children[1]] } }
    const { onClose, dialog } = setup(map)
    const panel = () => screen.getByRole('complementary')
    dialog.focus()
    // central topic: custom color from the side panel
    fireEvent.change(within(panel()).getByLabelText('Custom color'), { target: { value: '#ff8800' } })
    // a sub-topic: palette color from the toolbar popover
    dialog.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByLabelText('Selected topic')).toHaveValue('Kid')
    await userEvent.click(screen.getByRole('button', { name: 'Topic color' }))
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Mind map editor' }).querySelector('.animate-pop-in') as HTMLElement).getByRole('button', { name: 'Color 5' }))
    // branch B: color then reset with Auto
    dialog.focus()
    await userEvent.keyboard('{Home}')
    const b = map.root.children[1].id
    await userEvent.click(document.querySelector(`[data-topic-id="${b}"]`)!)
    await userEvent.click(within(panel()).getByRole('button', { name: 'Color 3' }))
    await userEvent.click(within(panel()).getByRole('button', { name: 'Auto color' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const saved = onClose.mock.calls[0][0]
    expect(saved.root.color).toBe('#ff8800')
    expect(saved.root.children[0].children[0].color).toBe(4)
    expect(saved.root.children[0].color).toBeUndefined()
    expect(saved.root.children[1].color).toBeUndefined()
  })
})
