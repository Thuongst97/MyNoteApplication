import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Shown in the message, e.g. "this page". */
  what?: string
  /** Changing this resets the boundary (e.g. the page id). */
  resetKey?: unknown
  /** Smaller message for single blocks inside a page. */
  compact?: boolean
}

interface State {
  error: Error | null
}

/**
 * Contains rendering errors (e.g. from corrupted data) so the rest of the app keeps working.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] rendering failed:', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    const retry = (
      <button
        type="button"
        onClick={() => this.setState({ error: null })}
        className="inline-flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
      >
        <RotateCcw size={12} /> Try again
      </button>
    )
    if (this.props.compact) {
      return (
        <div role="alert" className="my-2 flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={14} /> This block couldn’t be shown. {retry}
        </div>
      )
    }
    return (
      <div role="alert" className="mx-auto mt-24 max-w-md px-6 text-center">
        <AlertTriangle className="mx-auto mb-3 text-red-500" />
        <h2 className="text-lg font-semibold">Something went wrong showing {this.props.what ?? 'this view'}</h2>
        <p className="mt-1 text-sm opacity-60">Your other pages are fine and nothing has been lost. Try again, or open another page.</p>
        <p className="mt-2 break-words font-mono text-xs opacity-40">{this.state.error.message}</p>
        <div className="mt-4">{retry}</div>
      </div>
    )
  }
}

/** Wraps an editor block's view so a broken block doesn't take the whole page down. */
export function withBlockBoundary<P extends { node: { attrs: unknown } }>(View: (props: P) => ReactNode) {
  function SafeBlock(props: P) {
    return (
      <ErrorBoundary compact resetKey={props.node.attrs}>
        <View {...props} />
      </ErrorBoundary>
    )
  }
  SafeBlock.displayName = `Safe(${View.name})`
  return SafeBlock
}
