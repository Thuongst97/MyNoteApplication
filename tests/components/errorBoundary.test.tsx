import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary, withBlockBoundary } from '@/components/ui/ErrorBoundary'

let shouldThrow = true
function Boom() {
  if (shouldThrow) throw new Error('corrupted data')
  return <p>All good</p>
}

describe('ErrorBoundary', () => {
  it('shows a message instead of crashing, and can try again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    shouldThrow = true
    render(
      <div>
        <p>Sidebar still here</p>
        <ErrorBoundary what="this page">
          <Boom />
        </ErrorBoundary>
      </div>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong showing this page')
    expect(screen.getByText('corrupted data')).toBeInTheDocument()
    expect(screen.getByText('Sidebar still here')).toBeInTheDocument()
    shouldThrow = false
    await userEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('contains a broken block inside a page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    shouldThrow = true
    const Safe = withBlockBoundary((_: { node: { attrs: unknown } }) => <Boom />)
    render(
      <div>
        <p>Text before</p>
        <Safe node={{ attrs: {} }} />
        <p>Text after</p>
      </div>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('This block couldn’t be shown')
    expect(screen.getByText('Text after')).toBeInTheDocument()
  })
})
