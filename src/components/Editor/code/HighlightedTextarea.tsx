import { forwardRef, useMemo, useRef, type ReactNode } from 'react'
import { lowlight } from './codeHighlight'
import { cn } from '@/lib/utils'

type HastNode = { type: string; value?: string; tagName?: string; properties?: { className?: string[] }; children?: HastNode[] }

/** React elements from lowlight's tree (text only: nothing can inject markup). */
function toReact(node: HastNode, key: string): ReactNode {
  if (node.type === 'text') return node.value ?? ''
  const kids = (node.children ?? []).map((c, i) => toReact(c, `${key}.${i}`))
  if (node.type !== 'element') return kids
  return (
    <span key={key} className={node.properties?.className?.join(' ')}>
      {kids}
    </span>
  )
}

/**
 * A plain textarea with syntax colors: the code is drawn, highlighted, behind a transparent
 * textarea with the same font and wrapping (typing, undo, selection stay native).
 * `language`: a highlight.js language ('xml' for HTML, with its CSS and JavaScript).
 */
export const HighlightedTextarea = forwardRef<
  HTMLTextAreaElement,
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> & { value: string; language: string; wrapperClassName?: string }
>(function HighlightedTextarea({ value, language, className, wrapperClassName, onScroll, ...rest }, ref) {
  const backRef = useRef<HTMLPreElement>(null)
  const colored = useMemo(() => {
    if (!lowlight.registered(language) || value.length > 300_000) return value
    return toReact(lowlight.highlight(language, value) as unknown as HastNode, 'h')
  }, [value, language])
  // Both layers share these (any difference would make the caret drift from the text).
  // (code-hl-layer in index.css: page styles for <pre> must not change these)
  const shared = 'code-hl-layer'
  return (
    <div className={cn('code-hl-wrap relative min-h-0 overflow-hidden', wrapperClassName)}>
      <pre ref={backRef} aria-hidden className={cn('code-hl pointer-events-none absolute inset-0 overflow-hidden', shared)}>
        <code>{colored}</code>
        {/* A trailing newline needs a line to exist. */}
        {'\n'}
      </pre>
      <textarea
        ref={ref}
        value={value}
        spellCheck={false}
        onScroll={(e) => {
          if (backRef.current) {
            backRef.current.scrollTop = e.currentTarget.scrollTop
            backRef.current.scrollLeft = e.currentTarget.scrollLeft
          }
          onScroll?.(e)
        }}
        className={cn('relative block h-full w-full resize-none bg-transparent outline-none selection:bg-blue-500/30', shared, className)}
        {...rest}
      />
    </div>
  )
})

/** Formats HTML (with its CSS and JavaScript) like Prettier; loaded the first time it's used. */
export async function formatHtml(source: string): Promise<string> {
  const [prettier, html, postcss, babel, estree] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/html'),
    import('prettier/plugins/postcss'),
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ])
  return prettier.format(source, {
    parser: 'html',
    plugins: [html, postcss, babel, estree] as never,
    printWidth: 100,
    tabWidth: 2,
    htmlWhitespaceSensitivity: 'ignore',
  })
}
