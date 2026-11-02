import { useEffect, useMemo, useRef } from 'react'
import { sanitizeHtml } from '@/lib/html'

/** Base look inside the block, with zero specificity (:where) so any rule of the user's wins. */
const BASE_CSS = `
:host { display: block; }
:where(.html-root) { overflow-wrap: anywhere; line-height: 1.6; }
:where(.html-root) :where(img, video, svg) { max-width: 100%; height: auto; }
:where(.html-root) :where(table) { border-collapse: collapse; }
:where(.html-root) :where(td, th) { border: 1px solid rgba(127,127,127,.3); padding: 4px 8px; }
:where(.html-root) :where(a) { color: #2383e2; }
:where(.html-root) :where(pre) { white-space: pre-wrap; }
`

/** Sanitized HTML shown in a Shadow DOM, so the block's CSS can't change the rest of the app. */
export function HtmlRender({ source, className }: { source: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const html = useMemo(() => sanitizeHtml(source), [source])
  useEffect(() => {
    const host = ref.current
    if (!host) return
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    root.innerHTML = `<style>${BASE_CSS}</style><div class="html-root">${html}</div>`
  }, [html])
  // The wrapper is outside the block's style scope, so the block's own CSS can't undo it:
  // `contain: paint` keeps everything the block draws (even position: fixed) inside its box,
  // so a shared page can't cover the app with a fake screen.
  return (
    <div className="html-block-frame" style={{ contain: 'layout paint', overflow: 'hidden', position: 'relative', isolation: 'isolate' }}>
      <div ref={ref} className={className} data-html-block="" />
    </div>
  )
}
