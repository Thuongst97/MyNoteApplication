import { useMemo } from 'react'
import type { NodeViewProps } from '@tiptap/react'
import { Sigma } from 'lucide-react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { SourceBlockView, type SourceKind } from '../markdown/SourceBlockView'

export const EQUATION_TEMPLATE = String.raw`E = mc^2 \qquad \int_0^1 x^2\,dx = \frac{1}{3} \qquad \sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}`

/** Typeset LaTeX (KaTeX output is safe: no raw HTML, \href etc. are off). Errors show inline. */
export function EquationRender({ source, className }: { source: string; className?: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(source, { displayMode: true, throwOnError: true, trust: false, output: 'htmlAndMathml', strict: 'ignore' })
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err)
      return `<div class="equation-error">${msg.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)}</div>`
    }
  }, [source])
  return <div className={`equation-render ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />
}

export const EQUATION_KIND: SourceKind = {
  name: 'Equation',
  icon: Sigma,
  hint: 'Block equation — LaTeX, the formula updates as you type',
  help: { url: 'https://katex.org/docs/supported.html', label: 'Supported functions' },
  template: EQUATION_TEMPLATE,
  Render: EquationRender,
}

export function EquationView(props: NodeViewProps) {
  return <SourceBlockView {...props} kind={EQUATION_KIND} />
}
