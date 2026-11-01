import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useTwoWayArrowTool } from '@/components/Whiteboard/twoWayArrow'

function fakeApi() {
  const state = { activeTool: { type: 'selection' }, currentItemStartArrowhead: null as string | null, currentItemEndArrowhead: 'triangle' as string | null }
  return {
    state,
    getAppState: () => state,
    setActiveTool: vi.fn((t: { type: string }) => (state.activeTool = t)),
    updateScene: vi.fn(({ appState }: { appState: Partial<typeof state> }) => Object.assign(state, appState)),
  }
}

let hook!: ReturnType<typeof useTwoWayArrowTool>
function Host({ api }: { api: ReturnType<typeof fakeApi> }) {
  hook = useTwoWayArrowTool(api as never)
  return <>{hook.button}</>
}

beforeEach(() => {
  // A minimal copy of Excalidraw's toolbar: Arrow and Line tools.
  document.body.innerHTML = `
    <div class="excalidraw"><div class="Stack_horizontal">
      <label class="ToolIcon"><input type="radio" data-testid="toolbar-arrow" aria-label="Arrow"></label>
      <label class="ToolIcon"><input type="radio" data-testid="toolbar-line" aria-label="Line"></label>
      <textarea aria-label="text"></textarea>
    </div></div>`
})

describe('two-way arrow tool', () => {
  it('appears right after the arrow tool', () => {
    render(<Host api={fakeApi()} />, { container: document.body.appendChild(document.createElement('div')) })
    const labels = [...document.querySelectorAll('.Stack_horizontal input')].map((i) => i.getAttribute('aria-label'))
    expect(labels).toEqual(['Arrow', 'Two-way arrow', 'Line'])
  })

  it('draws arrows with heads at both ends, then restores the previous arrowheads', () => {
    const api = fakeApi()
    render(<Host api={api} />, { container: document.body.appendChild(document.createElement('div')) })
    fireEvent.click(screen.getByTestId('toolbar-two-way-arrow'))
    expect(api.setActiveTool).toHaveBeenCalledWith({ type: 'arrow' })
    expect(api.state).toMatchObject({ currentItemStartArrowhead: 'arrow', currentItemEndArrowhead: 'arrow' })
    expect(hook.active).toBe(true)
    expect(screen.getByTestId('toolbar-two-way-arrow')).toBeChecked()
    // drawing an arrow returns to the selection tool → two-way mode ends
    act(() => hook.onAppStateChange({ activeTool: { type: 'selection' } }))
    expect(hook.active).toBe(false)
    expect(api.state).toMatchObject({ currentItemStartArrowhead: null, currentItemEndArrowhead: 'triangle' })
  })

  it('stays on while the arrow tool stays active (tool lock)', () => {
    const api = fakeApi()
    render(<Host api={api} />, { container: document.body.appendChild(document.createElement('div')) })
    fireEvent.click(screen.getByTestId('toolbar-two-way-arrow'))
    act(() => hook.onAppStateChange({ activeTool: { type: 'arrow' } }))
    expect(hook.active).toBe(true)
  })

  it('choosing the normal arrow tool (click, A or 5) switches back to one-way arrows', () => {
    const api = fakeApi()
    render(<Host api={api} />, { container: document.body.appendChild(document.createElement('div')) })
    fireEvent.click(screen.getByTestId('toolbar-two-way-arrow'))
    act(() => void fireEvent.pointerDown(screen.getByTestId('toolbar-arrow')))
    expect(hook.active).toBe(false)
    expect(api.state.currentItemStartArrowhead).toBeNull()

    for (const key of ['a', '5']) {
      fireEvent.click(screen.getByTestId('toolbar-two-way-arrow'))
      act(() => void fireEvent.keyDown(document.body, { key }))
      expect(hook.active).toBe(false)
    }
  })

  it('typing "a" in a text box does not switch it off', () => {
    render(<Host api={fakeApi()} />, { container: document.body.appendChild(document.createElement('div')) })
    fireEvent.click(screen.getByTestId('toolbar-two-way-arrow'))
    act(() => void fireEvent.keyDown(screen.getByLabelText('text'), { key: 'a' }))
    expect(hook.active).toBe(true)
  })
})
