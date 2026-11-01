import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WindowControls } from '@/components/TitleBar/WindowControls'
import { api } from '@/lib/api'

afterEach(() => vi.restoreAllMocks())

describe('window controls', () => {
  it('call the window API without passing the click event', async () => {
    // Passing the React event across Electron's context bridge throws "An object could not be cloned".
    const min = vi.spyOn(api.window, 'minimize').mockImplementation(() => {})
    const max = vi.spyOn(api.window, 'toggleMaximize').mockImplementation(() => {})
    const close = vi.spyOn(api.window, 'close').mockImplementation(() => {})
    render(<WindowControls />)
    await userEvent.click(screen.getByRole('button', { name: 'Minimize' }))
    await userEvent.click(screen.getByRole('button', { name: 'Maximize' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(min).toHaveBeenCalledWith()
    expect(max).toHaveBeenCalledWith()
    expect(close).toHaveBeenCalledWith()
  })

  it('shows Restore when the window reports maximized', async () => {
    vi.spyOn(api.window, 'isMaximized').mockResolvedValue(true)
    render(<WindowControls />)
    expect(await screen.findByRole('button', { name: 'Restore' })).toBeInTheDocument()
  })
})
